const factilizaRepository = require('../repositories/factiliza.repository');
const { puedeAccesoListadoPlataformaEmpresas } = require('../utils/plataformaEmpresa.util');
const { withPool } = require('../utils/dbPool.util');

/** Acceso plataforma: superAdmin + empresa dueña (EMPRESA_PRINCIPAL_ID). */
function requireSuperAdminPlataforma(req, res) {
  if (!req.user) {
    res.status(401).json({ message: 'No autorizado' });
    return false;
  }
  if (!puedeAccesoListadoPlataformaEmpresas(req)) {
    res.status(403).json({
      message: 'No tiene permisos para acceder a esta función.'
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
  try {
    const servicios = await withPool((pool) => factilizaRepository.getServiciosFactiliza(pool));
    res.json({ data: servicios });
  } catch (err) {
    console.error('empresaFactilizaController getServicios:', err.message);
    res.status(500).json({ message: 'Error al listar servicios' });
  }
}

/**
 * GET /api/factiliza/empresas-servicios
 * Empresas, lista de servicios y asignaciones (matriz empresa × servicio). Solo superAdmin plataforma.
 */
async function getEmpresasServicios(req, res) {
  if (!requireSuperAdminPlataforma(req, res)) return;
  try {
    const result = await withPool((pool) => factilizaRepository.getEmpresasServicios(pool));
    res.json({ data: result });
  } catch (err) {
    console.error('empresaFactilizaController getEmpresasServicios:', err.message);
    res.status(500).json({ message: 'Error al cargar empresas y servicios' });
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
  try {
    await withPool(async (pool) => {
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
    });
    res.json({ message: 'Asignaciones guardadas correctamente' });
  } catch (err) {
    console.error('empresaFactilizaController guardarEmpresasServicios:', err.message);
    res.status(500).json({ message: 'Error al guardar asignaciones' });
  }
}

module.exports = {
  getServicios,
  getEmpresasServicios,
  guardarEmpresasServicios
};
