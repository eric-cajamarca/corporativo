const sql = require('mssql');

/**
 * Obtiene la configuración global de Factiliza (primera fila activa)
 */
async function getConfig(pool) {
  const result = await pool.request().query(`
    SELECT TOP 1 idFactilizaConfig, nombre, urlApi, tokenDefault, estado
    FROM FactilizaConfig
    WHERE estado = 1
  `);
  return result.recordset.length > 0 ? result.recordset[0] : null;
}

/**
 * Obtiene la configuración de Factiliza por nombre del servicio (ej. 'Factiliza SUNAT', 'Factiliza WHATSAPP').
 * Incluye parametroRuta para APIs que usan un segmento en la URL (ej. nombre-instancia en WhatsApp).
 */
async function getConfigByNombre(pool, nombre) {
  const result = await pool.request()
    .input('nombre', sql.VarChar(100), nombre)
    .query(`
      SELECT TOP 1 idFactilizaConfig, nombre, urlApi, tokenDefault, parametroRuta, estado
      FROM FactilizaConfig
      WHERE nombre = @nombre AND estado = 1
    `);
  return result.recordset.length > 0 ? result.recordset[0] : null;
}

/**
 * Obtiene el acceso Factiliza de una empresa (token, usuario SOL, etc.)
 */
async function getEmpresaFactiliza(pool, idEmpresa) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idEmpresaFactiliza, idEmpresa, puedeUsar, tokenFactiliza, usuarioSol, passwordSol, rucEmpresa, numeroWhatsApp, activo
      FROM EmpresaFactiliza
      WHERE idEmpresa = @idEmpresa AND activo = 1
    `);
  return result.recordset.length > 0 ? result.recordset[0] : null;
}

/**
 * Obtiene token a usar para una empresa: primero el de la empresa, si no el token por defecto de config
 */
async function getTokenParaEmpresa(pool, idEmpresa) {
  const config = await getConfig(pool);
  const empresaFactiliza = await getEmpresaFactiliza(pool, idEmpresa);
  if (!empresaFactiliza || !empresaFactiliza.puedeUsar) return { token: null, puedeUsar: false };
  const token = empresaFactiliza.tokenFactiliza || (config && config.tokenDefault) || null;
  return {
    token,
    puedeUsar: true,
    urlApi: config ? config.urlApi : 'https://api.factiliza.com/v1/sunat/xml',
    usuarioSol: empresaFactiliza.usuarioSol,
    passwordSol: empresaFactiliza.passwordSol,
    rucEmpresa: empresaFactiliza.rucEmpresa
  };
}

/**
 * Lista los nombres de servicios (FactilizaConfig) para la UI de asignación.
 */
async function getServiciosFactiliza(pool) {
  const result = await pool.request().query(`
    SELECT nombre FROM FactilizaConfig WHERE estado = 1 ORDER BY nombre
  `);
  return (result.recordset || []).map(r => r.nombre);
}

/**
 * Indica si una empresa puede usar un servicio. Si existe fila en empresaFaciliza se usa;
 * si no, se usa EmpresaFactiliza.puedeUsar (retrocompatibilidad).
 */
async function puedeUsarServicio(pool, idEmpresa, nombreServicio) {
  const row = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('nombreServicio', sql.VarChar(100), nombreServicio)
    .query(`
      SELECT puedeUsar FROM empresaFaciliza
      WHERE idEmpresa = @idEmpresa AND nombreServicio = @nombreServicio
    `);
  if (row.recordset && row.recordset.length > 0) {
    return !!row.recordset[0].puedeUsar;
  }
  const ef = await getEmpresaFactiliza(pool, idEmpresa);
  return !!(ef && ef.puedeUsar);
}

/**
 * Para admin: lista empresas (idEmpresa, razon_Social, ruc) y todas las asignaciones empresaFaciliza.
 */
async function getEmpresasServicios(pool) {
  const empresas = await pool.request().query(`
    SELECT idEmpresa, razon_Social AS razonSocial, ruc FROM Empresas ORDER BY razon_Social
  `);
  const asignaciones = await pool.request().query(`
    SELECT idEmpresa, nombreServicio, puedeUsar FROM empresaFaciliza
  `);
  const servicios = await getServiciosFactiliza(pool);
  const map = {};
  (asignaciones.recordset || []).forEach(a => {
    const key = `${a.idEmpresa}`;
    if (!map[key]) map[key] = {};
    map[key][a.nombreServicio] = !!a.puedeUsar;
  });
  return {
    empresas: empresas.recordset || [],
    servicios,
    asignaciones: map
  };
}

/**
 * Guarda o actualiza una asignación empresa-servicio.
 */
async function guardarEmpresaServicio(pool, idEmpresa, nombreServicio, puedeUsar) {
  await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('nombreServicio', sql.VarChar(100), nombreServicio)
    .input('puedeUsar', sql.Bit, puedeUsar ? 1 : 0)
    .query(`
      MERGE empresaFaciliza AS t
      USING (SELECT @idEmpresa AS idEmpresa, @nombreServicio AS nombreServicio, @puedeUsar AS puedeUsar) AS s
      ON t.idEmpresa = s.idEmpresa AND t.nombreServicio = s.nombreServicio
      WHEN MATCHED THEN UPDATE SET t.puedeUsar = s.puedeUsar, t.fModificacion = GETDATE()
      WHEN NOT MATCHED THEN INSERT (idEmpresa, nombreServicio, puedeUsar) VALUES (s.idEmpresa, s.nombreServicio, s.puedeUsar);
    `);
}

module.exports = {
  getConfig,
  getConfigByNombre,
  getEmpresaFactiliza,
  getTokenParaEmpresa,
  getServiciosFactiliza,
  getEmpresasServicios,
  puedeUsarServicio,
  guardarEmpresaServicio
};
