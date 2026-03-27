const sql = require('mssql');
const dbConfig = require('../dbconfig');
const factilizaRepository = require('../repositories/factiliza.repository');
const { puedeAccesoListadoPlataformaEmpresas } = require('../utils/plataformaEmpresa.util');

/** Igual que listado de empresas / política 2FA: superAdmin + empresa principal (EMPRESA_PRINCIPAL_ID). */
function requireSuperAdminPlataforma(req, res) {
  if (!req.user) {
    res.status(401).json({ message: 'No autorizado' });
    return false;
  }
  if (!puedeAccesoListadoPlataformaEmpresas(req)) {
    res.status(403).json({
      message: 'Solo el superAdmin de la plataforma (empresa principal) puede acceder a esta función.'
    });
    return false;
  }
  return true;
}

/**
 * GET /api/factiliza/servicios
 * Lista nombres de servicios (FactilizaConfig) para la UI. Solo superAdmin plataforma.
 */
async function getServicios(req, res) {
  if (!requireSuperAdminPlataforma(req, res)) return;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const servicios = await factilizaRepository.getServiciosFactiliza(pool);
    res.json({ data: servicios });
  } catch (err) {
    console.error('empresaFactilizaController getServicios:', err.message);
    res.status(500).json({ message: 'Error al listar servicios' });
  } finally {
    // No cerrar pool global (rompe otras peticiones concurrentes).
  }
}

/**
 * GET /api/factiliza/empresas-servicios
 * Empresas, lista de servicios y asignaciones (matriz empresa × servicio). Solo superAdmin plataforma.
 */
async function getEmpresasServicios(req, res) {
  if (!requireSuperAdminPlataforma(req, res)) return;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await factilizaRepository.getEmpresasServicios(pool);
    res.json({ data: result });
  } catch (err) {
    console.error('empresaFactilizaController getEmpresasServicios:', err.message);
    res.status(500).json({ message: 'Error al cargar empresas y servicios' });
  } finally {
    // No cerrar pool global (rompe otras peticiones concurrentes).
  }
}

/**
 * POST /api/factiliza/empresas-servicios
 * Body: { asignaciones: [ { idEmpresa, nombreServicio, puedeUsar } ] }
 * Solo superAdmin plataforma.
 */
async function guardarEmpresasServicios(req, res) {
  if (!requireSuperAdminPlataforma(req, res)) return;
  const asignaciones = req.body?.asignaciones;
  if (!Array.isArray(asignaciones)) {
    return res.status(400).json({ message: 'Se requiere asignaciones (array)' });
  }
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    for (const a of asignaciones) {
      if (a.idEmpresa && a.nombreServicio != null) {
        await factilizaRepository.guardarEmpresaServicio(
          pool,
          a.idEmpresa,
          String(a.nombreServicio).trim(),
          !!a.puedeUsar
        );
      }
    }
    res.json({ message: 'Asignaciones guardadas correctamente' });
  } catch (err) {
    console.error('empresaFactilizaController guardarEmpresasServicios:', err.message);
    res.status(500).json({ message: 'Error al guardar asignaciones' });
  } finally {
    // No cerrar pool global (rompe otras peticiones concurrentes).
  }
}

module.exports = {
  getServicios,
  getEmpresasServicios,
  guardarEmpresasServicios
};
