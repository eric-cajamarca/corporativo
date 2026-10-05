const sql = require('mssql');

async function contarUsuariosActivos(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS total
      FROM dbo.UsuarioWeb
      WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
    `);
  return Number(r.recordset[0]?.total || 0);
}

/** Cuentas de usuario que ocupan plaza (incluye pendientes de activación). */
async function contarUsuariosPlazas(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS total
      FROM dbo.UsuarioWeb
      WHERE idEmpresa = @idEmpresa
    `);
  return Number(r.recordset[0]?.total || 0);
}

async function contarSucursales(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS total
      FROM dbo.Sucursal
      WHERE idEmpresa = @idEmpresa
    `);
  return Number(r.recordset[0]?.total || 0);
}

async function contarDireccionesEmpresa(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS total
      FROM dbo.DireccionEmpresa
      WHERE idEmpresa = @idEmpresa
    `);
  return Number(r.recordset[0]?.total || 0);
}

async function contarProductosActivos(pool, idEmpresa) {
  try {
    const r = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT COUNT(*) AS total
        FROM dbo.Productos
        WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
      `);
    return Number(r.recordset[0]?.total || 0);
  } catch (err) {
    console.error('contexto: contarProductosActivos', err);
    return 0;
  }
}

async function contarUso(pool, idEmpresa) {
  const [usuariosActivos, usuariosPlazas, sucursales, direccionesEmpresa, productosActivos] =
    await Promise.all([
      contarUsuariosActivos(pool, idEmpresa),
      contarUsuariosPlazas(pool, idEmpresa),
      contarSucursales(pool, idEmpresa),
      contarDireccionesEmpresa(pool, idEmpresa),
      contarProductosActivos(pool, idEmpresa)
    ]);
  return { usuariosActivos, usuariosPlazas, sucursales, direccionesEmpresa, productosActivos };
}

/**
 * Reconstruye el total de documentos SUNAT que cuentan para cuota (histórico + actual):
 * comprobantes electrónicos aceptados (1,3) o con baja aceptada (EstadosSunat 08), guías aceptadas y RA aceptadas.
 */
async function contarComprobantesSunatDesdeTablas(pool, idEmpresa) {
  if (!idEmpresa) return 0;
  try {
    const r = await pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa).query(`
      SELECT
        ISNULL((
          SELECT COUNT_BIG(*)
          FROM dbo.ComprobantesElectronicos ce
          WHERE ce.idEmpresa = @idEmpresa
            AND (
              ce.idEstadoSunat IN (1, 3)
              OR EXISTS (
                SELECT 1 FROM dbo.EstadosSunat es
                WHERE es.idEstadoSunat = ce.idEstadoSunat AND es.codigo = '08'
              )
            )
        ), 0)
        + ISNULL((
          SELECT COUNT_BIG(*)
          FROM dbo.GuiasElectronicasEmitidas g
          WHERE g.idEmpresa = @idEmpresa AND g.idEstadoSunat IN (1, 3)
        ), 0)
        + ISNULL((
          SELECT COUNT_BIG(*)
          FROM dbo.ComunicacionesBaja c
          WHERE c.idEmpresa = @idEmpresa AND c.idEstadoSunat IN (1, 3)
        ), 0)
        AS total
    `);
    const n = r.recordset && r.recordset[0] != null ? Number(r.recordset[0].total) : 0;
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  } catch (err) {
    console.error('contexto: contarComprobantesSunatDesdeTablas', err);
    return 0;
  }
}

/**
 * Conteos operativos para super usuario / dueño: notas de venta emitidas
 * y comprobantes electrónicos pendientes de envío a SUNAT (estado 7).
 */
async function contarIndicadoresOperativos(pool, idEmpresa) {
  if (!idEmpresa) {
    return { notasVenta: 0, comprobantesSinEnviarSunat: 0 };
  }
  try {
    const r = await pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa).query(`
      SELECT
        ISNULL((
          SELECT COUNT(*)
          FROM dbo.Ventas v
          INNER JOIN dbo.Comprobantes c
            ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
          WHERE v.idEmpresa = @idEmpresa
            AND ISNULL(v.eliminado, 0) = 0
            AND UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) = 'NV'
        ), 0) AS notasVenta,
        ISNULL((
          SELECT COUNT(*)
          FROM dbo.ComprobantesElectronicos ce
          INNER JOIN dbo.Ventas v ON v.idVenta = ce.idVenta AND v.idEmpresa = ce.idEmpresa
          WHERE ce.idEmpresa = @idEmpresa
            AND ce.idEstadoSunat = 7
            AND ce.tipoComprobante IN ('01', '03', '07', '08')
            AND ISNULL(v.eliminado, 0) = 0
        ), 0) AS comprobantesSinEnviarSunat
    `);
    const row = r.recordset && r.recordset[0] ? r.recordset[0] : {};
    const notas = Number(row.notasVenta);
    const pend = Number(row.comprobantesSinEnviarSunat);
    return {
      notasVenta: Number.isFinite(notas) ? Math.max(0, Math.floor(notas)) : 0,
      comprobantesSinEnviarSunat: Number.isFinite(pend) ? Math.max(0, Math.floor(pend)) : 0
    };
  } catch (err) {
    console.error('contexto: contarIndicadoresOperativos', err);
    return { notasVenta: 0, comprobantesSinEnviarSunat: 0 };
  }
}

async function obtenerMetricasOnboarding(pool, idEmpresa) {
  const r = await pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa).query(`
    SELECT
      ISNULL((
        SELECT COUNT(1)
        FROM dbo.ConfiguracionFacturacionElectronica c
        INNER JOIN dbo.Empresas e ON e.idEmpresa = c.idEmpresa
        WHERE c.idEmpresa = @idEmpresa
          AND ISNULL(LTRIM(RTRIM(e.ruc)), '') <> ''
          AND ISNULL(LTRIM(RTRIM(c.usuarioSunat)), '') <> ''
          AND ISNULL(LTRIM(RTRIM(c.claveSunat)), '') <> ''
      ), 0) AS tieneConfigSunat,
      (
        SELECT MIN(ce.fechaRespuesta)
        FROM dbo.ComprobantesElectronicos ce
        WHERE ce.idEmpresa = @idEmpresa
          AND (
            ce.idEstadoSunat IN (1, 3)
            OR EXISTS (
              SELECT 1
              FROM dbo.EstadosSunat es
              WHERE es.idEstadoSunat = ce.idEstadoSunat
                AND es.codigo = '08'
            )
          )
      ) AS fechaPrimerComprobante
  `);
  return r.recordset && r.recordset[0] ? r.recordset[0] : null;
}

module.exports = {
  contarUsuariosActivos,
  contarUsuariosPlazas,
  contarSucursales,
  contarDireccionesEmpresa,
  contarProductosActivos,
  contarUso,
  contarComprobantesSunatDesdeTablas,
  contarIndicadoresOperativos,
  obtenerMetricasOnboarding
};
