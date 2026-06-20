const sql = require('mssql');
const { isSaas } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('./empresaSuscripcion.repository');
const saasPlanAccesoRepository = require('./saasPlanAcceso.repository');

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

const SELECT_EMPRESA_FACTILIZA_CAMPOS = `
      idEmpresaFactiliza, idEmpresa, puedeUsar, tokenFactiliza, usuarioSol, passwordSol, rucEmpresa, numeroWhatsApp, activo
`;

/**
 * Acceso Factiliza por empresa (token, SOL, RUC).
 * Orden de resolución:
 * 1) Tabla canónica EmpresaFactiliza
 * 2) Misma proyección sobre empresaFaciliza (instalaciones que crearon la tabla con nombre legado pero mismas columnas)
 * 3) Solo si options.sinteticoDesdePermisos: empresaFaciliza estrecha (idEmpresa, nombreServicio, puedeUsar) —
 *    agrega permiso global para poder usar tokenDefault de FactilizaConfig (no sustituye fila por servicio en puedeUsarServicio).
 */
async function getEmpresaFactiliza(pool, idEmpresa, options = {}) {
  const sinteticoDesdePermisos = options.sinteticoDesdePermisos === true;

  let row = null;
  try {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
      SELECT ${SELECT_EMPRESA_FACTILIZA_CAMPOS}
      FROM EmpresaFactiliza
      WHERE idEmpresa = @idEmpresa AND activo = 1
    `);
    if (result.recordset.length > 0) row = result.recordset[0];
  } catch (e) {
    if (!(e && e.number === 208 && /EmpresaFactiliza/i.test(String(e.message || '')))) throw e;
  }
  if (row) return row;

  try {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
      SELECT TOP 1 ${SELECT_EMPRESA_FACTILIZA_CAMPOS}
      FROM empresaFaciliza
      WHERE idEmpresa = @idEmpresa
    `);
    if (result.recordset.length > 0) row = result.recordset[0];
  } catch (e) {
    const msg = String(e.message || '');
    const tablaAusente = e.number === 208 && /empresaFaciliza/i.test(msg);
    const columnasIncompatibles = e.number === 207 || /Invalid column name/i.test(msg);
    if (!tablaAusente && !columnasIncompatibles) throw e;
  }
  if (row) return row;

  if (!sinteticoDesdePermisos) return null;

  try {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
      SELECT
        CAST(NULL AS UNIQUEIDENTIFIER) AS idEmpresaFactiliza,
        @idEmpresa AS idEmpresa,
        CAST(MAX(CAST(puedeUsar AS INT)) AS BIT) AS puedeUsar,
        CAST(NULL AS NVARCHAR(MAX)) AS tokenFactiliza,
        CAST(NULL AS VARCHAR(100)) AS usuarioSol,
        CAST(NULL AS NVARCHAR(MAX)) AS passwordSol,
        CAST(NULL AS VARCHAR(11)) AS rucEmpresa,
        CAST(NULL AS VARCHAR(20)) AS numeroWhatsApp,
        CAST(1 AS BIT) AS activo
      FROM empresaFaciliza
      WHERE idEmpresa = @idEmpresa
    `);
    const agg = result.recordset[0];
    if (!agg || agg.puedeUsar == null || !agg.puedeUsar) return null;
    return agg;
  } catch (e) {
    if (e.number === 208 && /empresaFaciliza/i.test(String(e.message || ''))) return null;
    throw e;
  }
}

/**
 * Obtiene token a usar para una empresa: primero el de la empresa, si no el token por defecto de config
 */
async function getTokenParaEmpresa(pool, idEmpresa) {
  const config = await getConfig(pool);
  const empresaFactiliza = await getEmpresaFactiliza(pool, idEmpresa, { sinteticoDesdePermisos: true });
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
 * Indica si una empresa puede usar un servicio.
 * SaaS: solo importa si el plan incluye el servicio (SaasPlanFactilizaServicio); no usa empresaFaciliza.
 * Enterprise / legado: empresaFaciliza o EmpresaFactiliza.puedeUsar.
 */
async function puedeUsarServicio(pool, idEmpresa, nombreServicio) {
  let planCode = 'profesional';
  if (isSaas()) {
    const sub = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
    if (sub) {
      const st = String(sub.estado || '')
        .trim()
        .toUpperCase();
      if (st === 'ACTIVA' || st === 'DEMO') {
        planCode = String(sub.planCode || 'demo')
          .trim()
          .toLowerCase();
      }
    }
  }
  const incluidoPlan = await saasPlanAccesoRepository.planPermiteFactilizaServicioNombre(pool, planCode, nombreServicio);
  if (!incluidoPlan) {
    return false;
  }

  if (isSaas()) {
    return true;
  }

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

  const ef = await getEmpresaFactiliza(pool, idEmpresa, { sinteticoDesdePermisos: false });
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
