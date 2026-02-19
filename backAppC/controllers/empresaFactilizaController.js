const sql = require('mssql');
const dbConfig = require('../dbconfig');
const factilizaRepository = require('../repositories/factiliza.repository');

/** Solo Administrador (dueño del sistema / super admin) */
function requireAdmin(req, res) {
  if (!req.user || req.user.rol !== 'Administrador') {
    res.status(403).json({ message: 'Solo el administrador del sistema puede acceder' });
    return false;
  }
  return true;
}

/**
 * GET /api/factiliza/servicios
 * Lista nombres de servicios (FactilizaConfig) para la UI. Solo Administrador.
 */
async function getServicios(req, res) {
  if (!requireAdmin(req, res)) return;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const servicios = await factilizaRepository.getServiciosFactiliza(pool);
    res.json({ data: servicios });
  } catch (err) {
    console.error('empresaFactilizaController getServicios:', err.message);
    res.status(500).json({ message: 'Error al listar servicios' });
  } finally {
    if (pool) try { pool.close(); } catch (_) {}
  }
}

/**
 * GET /api/factiliza/empresas-servicios
 * Empresas, lista de servicios y asignaciones (matriz empresa × servicio). Solo Administrador.
 */
async function getEmpresasServicios(req, res) {
  if (!requireAdmin(req, res)) return;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await factilizaRepository.getEmpresasServicios(pool);
    res.json({ data: result });
  } catch (err) {
    console.error('empresaFactilizaController getEmpresasServicios:', err.message);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'39a89e'},body:JSON.stringify({sessionId:'39a89e',location:'empresaFactilizaController.js:getEmpresasServicios',message:'getEmpresasServicios error',data:{errMessage:err.message,errCode:err.code},timestamp:Date.now(),hypothesisId:'table-or-column'})}).catch(()=>{});
    // #endregion
    res.status(500).json({ message: 'Error al cargar empresas y servicios' });
  } finally {
    if (pool) try { pool.close(); } catch (_) {}
  }
}

/**
 * POST /api/factiliza/empresas-servicios
 * Body: { asignaciones: [ { idEmpresa, nombreServicio, puedeUsar } ] }
 * Solo Administrador.
 */
async function guardarEmpresasServicios(req, res) {
  if (!requireAdmin(req, res)) return;
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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'39a89e'},body:JSON.stringify({sessionId:'39a89e',location:'empresaFactilizaController.js:guardarEmpresasServicios',message:'guardarEmpresasServicios error',data:{errMessage:err.message,errCode:err.code},timestamp:Date.now(),hypothesisId:'merge-table'})}).catch(()=>{});
    // #endregion
    res.status(500).json({ message: 'Error al guardar asignaciones' });
  } finally {
    if (pool) try { pool.close(); } catch (_) {}
  }
}

module.exports = {
  getServicios,
  getEmpresasServicios,
  guardarEmpresasServicios
};
