// repositories/ventas.repository.js
const sql = require('mssql');
const { getFechaSoloSQLString } = require('../utils/fechaHoraLocal.util');
const { interpretarBooleanoConfig } = require('../utils/configBoolean.util');

/** IN (@p0,@p1,...) para UUIDs en requests de consulta PDF / multiempresa */
const bindUniqueIdentifiersIn = (request, idsEmpresa, prefix) => {
  const list = (Array.isArray(idsEmpresa) ? idsEmpresa : [idsEmpresa]).filter(Boolean);
  return list.map((id, i) => {
    const k = `${prefix}${i}`;
    request.input(k, sql.UniqueIdentifier, id);
    return `@${k}`;
  }).join(', ');
};

exports.insertar = async (transaction, datosVenta, idEmpresa, idUsuario) => {
  const {
    idSucursal,
    serie,
    numero,
    compVenta,
    idComprobante,
    fEmision,
    fVencimiento,
    idCliente,
    idMoneda,
    tCambio,
    subtotal,
    igv,
    exonerado,
    gratuito,
    otrosCargos,
    descuentos,
    total,
    idMediosPago,
    idEstadoPedido,
    idEstadoPago,
    idEstadoSunat,
    compRelacionado,
    observaciones,
    idVentaAgrupada
  } = datosVenta;

  const compRelacionadoVal = (compRelacionado == null)
    ? ''
    : String(compRelacionado).trim().slice(0, 30);
  const observacionesVal = (observaciones == null)
    ? ''
    : String(observaciones).trim().slice(0, 500);

  const fVencimientoVal = fVencimiento != null ? fVencimiento : fEmision;
  const idEstadoPedidoVal = idEstadoPedido != null ? parseInt(idEstadoPedido, 10) : 1;
  const idEstadoPagoVal = idEstadoPago != null ? parseInt(idEstadoPago, 10) : 1;

  const req = transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('serie', sql.VarChar(4), serie)
    .input('numero', sql.VarChar(8), numero)
    .input('compVenta', sql.VarChar(13), compVenta)
    .input('idComprobante', sql.Int, idComprobante)
    .input('fEmision', sql.VarChar(23), fEmision)
    .input('fVencimiento', sql.VarChar(23), fVencimientoVal)
    .input('idCliente', sql.Int, idCliente)
    .input('idMoneda', sql.Int, idMoneda)
    .input('tCambio', sql.Decimal(10, 4), tCambio)
    .input('subtotal', sql.Decimal(18, 2), subtotal)
    .input('igv', sql.Decimal(18, 2), igv)
    .input('exonerado', sql.Decimal(18, 2), exonerado)
    .input('gratuito', sql.Decimal(18, 2), gratuito)
    .input('otrosCargos', sql.Decimal(18, 2), otrosCargos)
    .input('descuentos', sql.Decimal(18, 2), descuentos)
    .input('total', sql.Decimal(18, 2), total)
    .input('idMediosPago', sql.VarChar(20), idMediosPago)
    .input('idEstadoPedido', sql.Int, idEstadoPedidoVal)
    .input('idEstadoPago', sql.Int, idEstadoPagoVal)
    .input('idEstadoSunat', sql.Int, idEstadoSunat)
    .input('compRelacionado', sql.VarChar(30), compRelacionadoVal)
    .input('observaciones', sql.VarChar(500), observacionesVal)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario);

  if (idVentaAgrupada) {
    req.input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada);
    return await req.query(`
      DECLARE @ins TABLE (idVenta INT);
      INSERT INTO Ventas
      (idEmpresa, idSucursal, serie, numero, compVenta, idComprobante, fEmision, fVencimiento, idCliente, idMoneda, tCambio, subtotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, idEstadoPedido, idEstadoPago, idEstadoSunat, compRelacionado, observaciones, idUsuario, idVentaAgrupada)
      OUTPUT INSERTED.idVenta INTO @ins
      VALUES
      (@idEmpresa, @idSucursal, @serie, @numero, @compVenta, @idComprobante, @fEmision, @fVencimiento, @idCliente, @idMoneda, @tCambio, @subtotal, @igv, @exonerado, @gratuito, @otrosCargos, @descuentos, @total, @idMediosPago, @idEstadoPedido, @idEstadoPago, @idEstadoSunat, @compRelacionado, @observaciones, @idUsuario, @idVentaAgrupada);
      SELECT idVenta FROM @ins;`);
  }

  return await req.query(`
    DECLARE @ins TABLE (idVenta INT);
    INSERT INTO Ventas
    (idEmpresa, idSucursal, serie, numero, compVenta, idComprobante, fEmision, fVencimiento, idCliente, idMoneda, tCambio, subtotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, idEstadoPedido, idEstadoPago, idEstadoSunat, compRelacionado, observaciones, idUsuario)
    OUTPUT INSERTED.idVenta INTO @ins
    VALUES
    (@idEmpresa, @idSucursal, @serie, @numero, @compVenta, @idComprobante, @fEmision, @fVencimiento, @idCliente, @idMoneda, @tCambio, @subtotal, @igv, @exonerado, @gratuito, @otrosCargos, @descuentos, @total, @idMediosPago, @idEstadoPedido, @idEstadoPago, @idEstadoSunat, @compRelacionado, @observaciones, @idUsuario);
    SELECT idVenta FROM @ins;`);
};

/** Actualiza el número correlativo del comprobante usado en la venta (incrementa en BD para la siguiente). */
exports.actualizarNumeroComprobante = async (transaction, idEmpresa, idComprobante, numeroUsado) => {
  const num = parseInt(String(numeroUsado || '0').replace(/^0+/, '') || '0', 10);
  if (isNaN(num) || num < 0) return;
  await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idComprobante', sql.Int, idComprobante)
    .input('numero', sql.Int, num)
    .query('UPDATE Comprobantes SET numero = @numero WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante');
};

/** Obtiene y reserva el siguiente número para el comprobante usando SP con UPDLOCK/HOLDLOCK (concurrencia segura). */
exports.obtenerSiguienteNumeroComprobante = async (transaction, idEmpresa, idComprobante) => {
  const result = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idComprobante', sql.Int, idComprobante)
    .output('serieOut', sql.VarChar(4))
    .output('numeroOut', sql.VarChar(8))
    .execute('sp_ObtenerSiguienteCorrelativo');
  const serie = (result.output.serieOut || '0000').substring(0, 4);
  const numero = result.output.numeroOut || '00000001';
  return { numero, serie };
};

/** Inserta el desglose de pagos de una venta (ej: 40 efectivo + 40 yape). Requiere tabla DetallePagoVenta.
 *  FK DetallePagoVenta.idMediosPago -> MediosPago.idMediosPago. Mapea idFormaPago (FormasPago) a MediosPago cuando haga falta.
 */
exports.insertarDetallePagoVenta = async (transaction, idVenta, detallePago) => {
  if (!detallePago || detallePago.length === 0) return;
  const { normalizarDetallePagoIdMediosPago } = require('../utils/detallePagoNormalizar.util');
  const detalleNorm = await normalizarDetallePagoIdMediosPago(transaction, detallePago);
  const validIdsResult = await transaction.request().query('SELECT idMediosPago FROM MediosPago');
  const validIds = new Set((validIdsResult.recordset || []).map(r => Number(r.idMediosPago)).filter(n => !Number.isNaN(n)));
  const idMediosPagoDefault = validIds.size > 0 ? Math.min(...validIds) : null;
  if (idMediosPagoDefault == null) return;
  for (const pago of detalleNorm) {
    let idMediosPago = pago.idMediosPago != null ? Number(pago.idMediosPago) : null;
    if (idMediosPago == null || !validIds.has(idMediosPago)) idMediosPago = idMediosPagoDefault;
    const monto = Number(pago.monto);
    if (monto <= 0) continue;
    await transaction.request()
      .input('idVenta', sql.Int, idVenta)
      .input('idMediosPago', sql.Int, idMediosPago)
      .input('monto', sql.Decimal(18, 2), monto)
      .query('INSERT INTO DetallePagoVenta (idVenta, idMediosPago, monto) VALUES (@idVenta, @idMediosPago, @monto)');
  }
};

/** Lista comprobantes de venta de la empresa con nombre de comprobante, cliente e idComprobanteElectronico para envío SUNAT. */
exports.listarPorEmpresa = async (pool, idEmpresa) => {
  let result;
  try {
    result = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT
          v.idVenta,
          v.compVenta,
          CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
          v.total,
          v.idEstadoSunat,
          es.codigo AS codigoEstadoSunat,
          v.serie,
          v.numero,
          v.idComprobante,
          v.idCliente,
          v.idMediosPago,
          ISNULL(mp.descripcion, CAST(v.idMediosPago AS VARCHAR(20))) AS condicionPago,
          c.nombre AS nombreComprobante,
          c.codigo AS codigoComprobante,
          COALESCE(LTRIM(RTRIM(cl.rSocial)), (SELECT TOP 1 LTRIM(RTRIM(c2.rSocial)) FROM Clientes c2 WHERE c2.idCliente = v.idCliente), '') AS clienteRazonSocial,
          COALESCE(cl.ruc, (SELECT TOP 1 c2.ruc FROM Clientes c2 WHERE c2.idCliente = v.idCliente), '') AS clienteRuc,
          ce.idComprobanteElectronico,
          ce.tipoComprobante,
          e.ruc AS rucEmpresa,
          ISNULL(v.eliminado, 0) AS eliminado,
          CASE
            WHEN aggfp.codigos IS NULL OR LTRIM(RTRIM(aggfp.codigos)) = '' THEN '{}'
            ELSE '{' + aggfp.codigos + '}'
          END AS formaPago
        FROM Ventas v
        LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
        LEFT JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta AND ce.idEmpresa = v.idEmpresa
        LEFT JOIN Empresas e ON e.idEmpresa = v.idEmpresa
        LEFT JOIN MediosPago mp ON mp.idMediosPago = TRY_CAST(v.idMediosPago AS INT)
        OUTER APPLY (
          SELECT STUFF((
            SELECT ',' + d.sigla
            FROM (
              SELECT DISTINCT UPPER(LEFT(LTRIM(RTRIM(ISNULL(fp2.descripcion, ''))), 3)) AS sigla
              FROM MovimientosCaja mc
              INNER JOIN FormasPago fp2 ON fp2.idFormaPago = mc.idMediosPago
              WHERE mc.idVenta = v.idVenta AND mc.idEmpresa = v.idEmpresa
            ) d
            WHERE NULLIF(LTRIM(RTRIM(d.sigla)), '') IS NOT NULL
            FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS codigos
        ) aggfp
        WHERE v.idEmpresa = @idEmpresa
        ORDER BY v.fEmision DESC, v.idVenta DESC
      `);
  } catch (err) {
    if (err.message && (err.message.includes('MediosPago') || err.message.includes('FormasPago') || err.message.includes('MovimientosCaja') || err.message.includes('Invalid object'))) {
      result = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          SELECT
            v.idVenta,
            v.compVenta,
            CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
            v.total,
            v.idEstadoSunat,
            es.codigo AS codigoEstadoSunat,
            v.serie,
            v.numero,
            v.idComprobante,
            v.idCliente,
            v.idMediosPago AS condicionPago,
            c.nombre AS nombreComprobante,
            c.codigo AS codigoComprobante,
            COALESCE(LTRIM(RTRIM(cl.rSocial)), (SELECT TOP 1 LTRIM(RTRIM(c2.rSocial)) FROM Clientes c2 WHERE c2.idCliente = v.idCliente), '') AS clienteRazonSocial,
            COALESCE(cl.ruc, (SELECT TOP 1 c2.ruc FROM Clientes c2 WHERE c2.idCliente = v.idCliente), '') AS clienteRuc,
            ce.idComprobanteElectronico,
            ce.tipoComprobante,
            e.ruc AS rucEmpresa,
            ISNULL(v.eliminado, 0) AS eliminado,
            '' AS formaPago
          FROM Ventas v
          LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
          LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
          LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
          LEFT JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta AND ce.idEmpresa = v.idEmpresa
          LEFT JOIN Empresas e ON e.idEmpresa = v.idEmpresa
          WHERE v.idEmpresa = @idEmpresa
          ORDER BY v.fEmision DESC, v.idVenta DESC
        `);
    } else {
      throw err;
    }
  }
  const rows = result.recordset || [];
  return rows.map((r) => ({
    ...r,
    idComprobanteElectronico: r.idComprobanteElectronico != null ? String(r.idComprobanteElectronico) : null,
    tipoComprobante: r.tipoComprobante != null ? String(r.tipoComprobante).trim() : null,
    rucEmpresa: r.rucEmpresa != null ? String(r.rucEmpresa).trim() : null,
    condicionPago: r.condicionPago != null ? String(r.condicionPago).trim() : (r.idMediosPago != null ? String(r.idMediosPago) : ''),
    clienteRazonSocial: r.clienteRazonSocial != null ? String(r.clienteRazonSocial).trim() : '',
    clienteRuc: r.clienteRuc != null ? String(r.clienteRuc).trim() : '',
    eliminado: !!r.eliminado,
    formaPago: r.formaPago != null ? String(r.formaPago).trim() : '{}',
    codigoEstadoSunat: r.codigoEstadoSunat != null ? String(r.codigoEstadoSunat).trim() : null
  }));
};

/**
 * Lista comprobantes de venta para varias empresas (gestora + gestionadas).
 * Misma forma que listarPorEmpresa, con idEmpresa y razonSocialEmpresa.
 */
exports.listarPorIdsEmpresas = async (pool, idsEmpresa) => {
  const ids = (Array.isArray(idsEmpresa) ? idsEmpresa : [idsEmpresa]).filter(Boolean);
  if (ids.length === 0) return [];
  if (ids.length === 1) {
    const rows = await exports.listarPorEmpresa(pool, ids[0]);
    return rows.map((r) => ({ ...r, idEmpresa: ids[0], razonSocialEmpresa: '' }));
  }
  const req = pool.request();
  const inList = bindUniqueIdentifiersIn(req, ids, 'empV');
  let result;
  try {
    result = await req.query(`
      SELECT
        v.idEmpresa,
        v.idVenta,
        v.compVenta,
        CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
        v.total,
        v.idEstadoSunat,
        es.codigo AS codigoEstadoSunat,
        v.serie,
        v.numero,
        v.idComprobante,
        v.idCliente,
        v.idMediosPago,
        ISNULL(mp.descripcion, CAST(v.idMediosPago AS VARCHAR(20))) AS condicionPago,
        c.nombre AS nombreComprobante,
        c.codigo AS codigoComprobante,
        COALESCE(LTRIM(RTRIM(cl.rSocial)), (SELECT TOP 1 LTRIM(RTRIM(c2.rSocial)) FROM Clientes c2 WHERE c2.idCliente = v.idCliente AND c2.idEmpresa = v.idEmpresa), '') AS clienteRazonSocial,
        COALESCE(cl.ruc, (SELECT TOP 1 c2.ruc FROM Clientes c2 WHERE c2.idCliente = v.idCliente AND c2.idEmpresa = v.idEmpresa), '') AS clienteRuc,
        ce.idComprobanteElectronico,
        ce.tipoComprobante,
        e.ruc AS rucEmpresa,
        ISNULL(e.razon_Social, '') AS razonSocialEmpresa,
        ISNULL(v.eliminado, 0) AS eliminado,
        CASE
          WHEN aggfp.codigos IS NULL OR LTRIM(RTRIM(aggfp.codigos)) = '' THEN '{}'
          ELSE '{' + aggfp.codigos + '}'
        END AS formaPago
      FROM Ventas v
      LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
      LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
      LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
      LEFT JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta AND ce.idEmpresa = v.idEmpresa
      LEFT JOIN Empresas e ON e.idEmpresa = v.idEmpresa
      LEFT JOIN MediosPago mp ON mp.idMediosPago = TRY_CAST(v.idMediosPago AS INT)
      OUTER APPLY (
        SELECT STUFF((
          SELECT ',' + d.sigla
          FROM (
            SELECT DISTINCT UPPER(LEFT(LTRIM(RTRIM(ISNULL(fp2.descripcion, ''))), 3)) AS sigla
            FROM MovimientosCaja mc
            INNER JOIN FormasPago fp2 ON fp2.idFormaPago = mc.idMediosPago
            WHERE mc.idVenta = v.idVenta AND mc.idEmpresa = v.idEmpresa
          ) d
          WHERE NULLIF(LTRIM(RTRIM(d.sigla)), '') IS NOT NULL
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS codigos
      ) aggfp
      WHERE v.idEmpresa IN (${inList})
      ORDER BY v.fEmision DESC, v.idVenta DESC
    `);
  } catch (err) {
    if (err.message && (err.message.includes('MediosPago') || err.message.includes('FormasPago') || err.message.includes('MovimientosCaja') || err.message.includes('Invalid object'))) {
      const reqFb = pool.request();
      const inListFb = bindUniqueIdentifiersIn(reqFb, ids, 'empV');
      result = await reqFb.query(`
        SELECT
          v.idEmpresa,
          v.idVenta,
          v.compVenta,
          CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
          v.total,
          v.idEstadoSunat,
          es.codigo AS codigoEstadoSunat,
          v.serie,
          v.numero,
          v.idComprobante,
          v.idCliente,
          v.idMediosPago AS condicionPago,
          c.nombre AS nombreComprobante,
          c.codigo AS codigoComprobante,
          COALESCE(LTRIM(RTRIM(cl.rSocial)), (SELECT TOP 1 LTRIM(RTRIM(c2.rSocial)) FROM Clientes c2 WHERE c2.idCliente = v.idCliente AND c2.idEmpresa = v.idEmpresa), '') AS clienteRazonSocial,
          COALESCE(cl.ruc, (SELECT TOP 1 c2.ruc FROM Clientes c2 WHERE c2.idCliente = v.idCliente AND c2.idEmpresa = v.idEmpresa), '') AS clienteRuc,
          ce.idComprobanteElectronico,
          ce.tipoComprobante,
          e.ruc AS rucEmpresa,
          ISNULL(e.razon_Social, '') AS razonSocialEmpresa,
          ISNULL(v.eliminado, 0) AS eliminado,
          '' AS formaPago
        FROM Ventas v
        LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
        LEFT JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta AND ce.idEmpresa = v.idEmpresa
        LEFT JOIN Empresas e ON e.idEmpresa = v.idEmpresa
        WHERE v.idEmpresa IN (${inListFb})
        ORDER BY v.fEmision DESC, v.idVenta DESC
      `);
    } else {
      throw err;
    }
  }
  const rows = result.recordset || [];
  return rows.map((r) => ({
    ...r,
    idEmpresa: r.idEmpresa != null ? String(r.idEmpresa) : null,
    idComprobanteElectronico: r.idComprobanteElectronico != null ? String(r.idComprobanteElectronico) : null,
    tipoComprobante: r.tipoComprobante != null ? String(r.tipoComprobante).trim() : null,
    rucEmpresa: r.rucEmpresa != null ? String(r.rucEmpresa).trim() : null,
    razonSocialEmpresa: r.razonSocialEmpresa != null ? String(r.razonSocialEmpresa).trim() : '',
    condicionPago: r.condicionPago != null ? String(r.condicionPago).trim() : (r.idMediosPago != null ? String(r.idMediosPago) : ''),
    clienteRazonSocial: r.clienteRazonSocial != null ? String(r.clienteRazonSocial).trim() : '',
    clienteRuc: r.clienteRuc != null ? String(r.clienteRuc).trim() : '',
    eliminado: !!r.eliminado,
    formaPago: r.formaPago != null ? String(r.formaPago).trim() : '{}',
    codigoEstadoSunat: r.codigoEstadoSunat != null ? String(r.codigoEstadoSunat).trim() : null
  }));
};

/**
 * Lista paginada de ventas que son nota de crédito o débito (códigos F7/B7/F8/B8 o legado 07/08).
 * @param {import('mssql').ConnectionPool} pool
 * @param {string|string[]} idsEmpresa - Una empresa o varias (gestora + gestionadas)
 * @param {{ buscar?: string, pagina?: number, porPagina?: number }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
exports.listarVentasNotasCreditoDebitoRepo = async (pool, idsEmpresa, opts = {}) => {
  const ids = (Array.isArray(idsEmpresa) ? idsEmpresa : [idsEmpresa]).filter(Boolean);
  if (ids.length === 0) return { rows: [], total: 0 };

  const buscarRaw = opts.buscar != null ? String(opts.buscar).trim() : "";
  const pagina = Math.max(1, parseInt(String(opts.pagina), 10) || 1);
  const porPagina = Math.min(100, Math.max(1, parseInt(String(opts.porPagina), 10) || 20));
  const offset = (pagina - 1) * porPagina;

  const reqCount = pool.request();
  const inList = bindUniqueIdentifiersIn(reqCount, ids, "notaEmp");
  let whereBuscar = "";
  if (buscarRaw.length > 0) {
    const pat = `%${buscarRaw.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    reqCount.input("buscar", sql.NVarChar(200), pat);
    whereBuscar = ` AND (
      v.compVenta LIKE @buscar ESCAPE '\\'
      OR v.serie LIKE @buscar ESCAPE '\\'
      OR CAST(v.numero AS NVARCHAR(20)) LIKE @buscar ESCAPE '\\'
      OR cl.rSocial LIKE @buscar ESCAPE '\\'
      OR cl.ruc LIKE @buscar ESCAPE '\\'
    )`;
  }

  const countSql = `
    SELECT COUNT(*) AS total
    FROM Ventas v
    INNER JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
    LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
    WHERE v.idEmpresa IN (${inList})
      AND ISNULL(v.eliminado, 0) = 0
      AND UPPER(LTRIM(RTRIM(c.codigo))) IN ('F7','B7','F8','B8','07','08')
    ${whereBuscar}
  `;
  const countRes = await reqCount.query(countSql);
  const total = countRes.recordset && countRes.recordset[0] ? Number(countRes.recordset[0].total) || 0 : 0;

  const reqData = pool.request();
  const inListData = bindUniqueIdentifiersIn(reqData, ids, "notaD");
  reqData.input("offset", sql.Int, offset);
  reqData.input("limite", sql.Int, porPagina);
  if (buscarRaw.length > 0) {
    const pat = `%${buscarRaw.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    reqData.input("buscar", sql.NVarChar(200), pat);
  }

  const dataSql = `
    SELECT
      v.idEmpresa,
      v.idVenta,
      v.compVenta,
      CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
      v.total,
      v.idEstadoSunat,
      es.codigo AS codigoEstadoSunat,
      v.serie,
      v.numero,
      UPPER(LTRIM(RTRIM(c.codigo))) AS codigoComprobante,
      ce.idComprobanteElectronico,
      COALESCE(LTRIM(RTRIM(cl.rSocial)), '') AS clienteRazonSocial
    FROM Ventas v
    LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
    INNER JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
    LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
    LEFT JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta AND ce.idEmpresa = v.idEmpresa
    WHERE v.idEmpresa IN (${inListData})
      AND ISNULL(v.eliminado, 0) = 0
      AND UPPER(LTRIM(RTRIM(c.codigo))) IN ('F7','B7','F8','B8','07','08')
    ${whereBuscar}
    ORDER BY v.fEmision DESC, v.idVenta DESC
    OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY
  `;

  const dataRes = await reqData.query(dataSql);
  const rows = (dataRes.recordset || []).map((r) => ({
    idEmpresa: r.idEmpresa != null ? String(r.idEmpresa) : null,
    idVenta: r.idVenta,
    compVenta: r.compVenta != null ? String(r.compVenta).trim() : "",
    fEmision: r.fEmision != null ? String(r.fEmision).trim() : "",
    total: r.total != null ? Number(r.total) : 0,
    idEstadoSunat: r.idEstadoSunat != null ? Number(r.idEstadoSunat) : null,
    codigoEstadoSunat: r.codigoEstadoSunat != null ? String(r.codigoEstadoSunat).trim() : null,
    serie: r.serie != null ? String(r.serie).trim() : "",
    numero: r.numero != null ? String(r.numero).trim() : "",
    codigoComprobante: r.codigoComprobante != null ? String(r.codigoComprobante).trim().toUpperCase() : "",
    idComprobanteElectronico: r.idComprobanteElectronico != null ? String(r.idComprobanteElectronico) : null,
    clienteRazonSocial: r.clienteRazonSocial != null ? String(r.clienteRazonSocial).trim() : ""
  }));

  return { rows, total };
};

/** Datos completos de una venta para generar comprobante PDF. idsEmpresa: JWT + gestionadas (gestora) o [una empresa].
 *  Logo, impuestos y productos corresponden a v.idEmpresa de la venta encontrada. */
exports.obtenerComprobanteParaPdf = async (pool, idVenta, idsEmpresa, baseUrl = 'http://localhost:3000') => {
  const idsPermitidos = (Array.isArray(idsEmpresa) ? idsEmpresa : [idsEmpresa]).filter(Boolean);
  if (idsPermitidos.length === 0) return null;

  const inEmp = (req) => bindUniqueIdentifiersIn(req, idsPermitidos, 'pdfEmp');

  let cabecera;
  try {
    const reqCab = pool.request().input('idVenta', sql.Int, idVenta);
    const inList = inEmp(reqCab);
    cabecera = await reqCab.query(`
        SELECT
          v.idEmpresa,
          v.idVenta, v.compVenta, v.serie, v.numero, v.idEstadoSunat, v.idSucursal, v.idComprobante,
          v.idVentaAgrupada,
          CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
          CONVERT(VARCHAR(10), v.fVencimiento, 120) AS fVencimiento,
          v.subtotal, v.igv,
          ISNULL(v.exonerado, 0) AS exonerado,
          ISNULL(v.gratuito, 0) AS gratuito,
          ISNULL(v.otrosCargos, 0) AS otrosCargos,
          ISNULL(v.descuentos, 0) AS descuentos, v.total,
          ISNULL(v.eliminado, 0) AS eliminado,
          v.compRelacionado, v.observaciones, v.tipoComprobanteRef, v.codigoMotivoNotaCredito,
          c.nombre AS nombreComprobante, c.codigo AS codigoComprobante,
          ISNULL(mp.descripcion, ISNULL(fp.descripcion, 'Contado')) AS condicionPago,
          ISNULL(mp.codigo, '009') AS codigoCondicionPago,
          cl.idCliente AS idCliente,
          cl.rSocial AS clienteRazonSocial, cl.ruc AS clienteRuc, cl.idDocumento AS clienteTipoDoc,
          ISNULL(cl.celular, '') AS clienteCelular,
          (SELECT TOP 1 ISNULL(direccion, '') FROM DireccionClientes WHERE idCliente = cl.idCliente AND idEmpresa = cl.idEmpresa ORDER BY idDireccionClientes) AS clienteDireccion
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        LEFT JOIN FormasPago fp ON fp.idFormaPago = TRY_CAST(v.idMediosPago AS INT)
        LEFT JOIN MediosPago mp ON mp.idMediosPago = TRY_CAST(v.idMediosPago AS INT)
        LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
        WHERE v.idVenta = @idVenta AND v.idEmpresa IN (${inList})
      `);
  } catch (err) {
    if (err.message && (err.message.includes('MediosPago') || err.message.includes('Invalid object'))) {
      const reqCab2 = pool.request().input('idVenta', sql.Int, idVenta);
      const inList2 = inEmp(reqCab2);
      cabecera = await reqCab2.query(`
        SELECT
          v.idEmpresa,
          v.idVenta, v.compVenta, v.serie, v.numero, v.idEstadoSunat, v.idSucursal, v.idComprobante,
          v.idVentaAgrupada,
          CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
          CONVERT(VARCHAR(10), v.fVencimiento, 120) AS fVencimiento,
          v.subtotal, v.igv,
          ISNULL(v.exonerado, 0) AS exonerado,
          ISNULL(v.gratuito, 0) AS gratuito,
          ISNULL(v.otrosCargos, 0) AS otrosCargos,
          ISNULL(v.descuentos, 0) AS descuentos, v.total,
          ISNULL(v.eliminado, 0) AS eliminado,
          v.compRelacionado, v.observaciones, v.tipoComprobanteRef, v.codigoMotivoNotaCredito,
          c.nombre AS nombreComprobante, c.codigo AS codigoComprobante,
          'Contado' AS condicionPago,
          '009' AS codigoCondicionPago,
          cl.idCliente AS idCliente,
          cl.rSocial AS clienteRazonSocial, cl.ruc AS clienteRuc, cl.idDocumento AS clienteTipoDoc,
          ISNULL(cl.celular, '') AS clienteCelular,
          (SELECT TOP 1 ISNULL(direccion, '') FROM DireccionClientes WHERE idCliente = cl.idCliente AND idEmpresa = cl.idEmpresa ORDER BY idDireccionClientes) AS clienteDireccion
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
        WHERE v.idVenta = @idVenta AND v.idEmpresa IN (${inList2})
      `);
    } else {
      throw err;
    }
  }

  const cab = cabecera.recordset && cabecera.recordset[0] ? cabecera.recordset[0] : null;
  if (!cab || !cab.idEmpresa) return null;
  const idEmpresaVenta = cab.idEmpresa;

  let empresaResult;
  try {
    empresaResult = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
      .query(`
        SELECT e.razon_Social AS nombre, e.ruc, e.Logo AS logoArchivo,
          ISNULL(e.rubro, '') AS rubro,
          ISNULL(e.celular, '') AS celular,
          ISNULL(e.correo, '') AS correo,
          ISNULL(de.direccion, '') AS direccion,
          ISNULL(de.ubigeo, '') AS ubigeo,
          ISNULL(de.region, '') AS region,
          ISNULL(de.provincia, '') AS provincia,
          ISNULL(de.distrito, '') AS distrito,
          ISNULL(de.urbanizacion, '') AS urbanizacion
        FROM Empresas e
        LEFT JOIN DireccionEmpresa de ON e.idEmpresa = de.idEmpresa AND de.principal = 1
        WHERE e.idEmpresa = @idEmpresa
      `);
  } catch (err) {
    empresaResult = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
      .query(`
        SELECT razon_Social AS nombre, ruc, Logo AS logoArchivo
        FROM Empresas WHERE idEmpresa = @idEmpresa
      `);
  }

  const items = await pool
    .request()
    .input('idVenta', sql.Int, idVenta)
    .input('idEmpresaVenta', sql.UniqueIdentifier, idEmpresaVenta)
    .query(`
      SELECT dv.idDetalle, dv.idProducto, dv.cantidad, ISNULL(dv.cantEntregada, 0) AS cantEntregada, dv.pVenta, dv.subtotal, dv.total,
        ISNULL(p.permiteDescripcionEnVenta, 0) AS permiteDescripcionEnVenta,
        p.descripcion AS descripcionProducto,
        CASE
          WHEN NULLIF(LTRIM(RTRIM(ISNULL(dv.descripcionLinea, ''))), '') IS NOT NULL
          THEN LTRIM(RTRIM(dv.descripcionLinea))
          ELSE p.descripcion
        END AS descripcion,
        p.codigo
      FROM DetalleVenta dv
      INNER JOIN Productos p ON p.idProducto = dv.idProducto AND p.idEmpresa = @idEmpresaVenta
      WHERE dv.idVenta = @idVenta
    `);

  const hashResult = await pool
    .request()
    .input('idVenta', sql.Int, idVenta)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
    .query(`
      SELECT TOP 1 hash AS resumenHash FROM ComprobantesElectronicos
      WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
    `);

  let cuotasVenta = [];
  const codigoComprobante = cab ? String((cab.codigoComprobante || '01').trim()) : '01';
  if (codigoComprobante === '01' || codigoComprobante === '03') {
    try {
      const cuotasResult = await pool
        .request()
        .input('idVenta', sql.Int, idVenta)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
        .query(`
          SELECT cu.numeroCuota,
            CONVERT(VARCHAR(10), cu.fechaVencimiento, 120) AS fechaPago,
            cu.montoCuota AS total
          FROM CuotasCredito cu
          INNER JOIN CreditosClientes cc ON cc.idCredito = cu.idCredito AND cc.idEmpresa = cu.idEmpresa
          WHERE cc.idVenta = @idVenta AND cc.idEmpresa = @idEmpresa
          ORDER BY cu.numeroCuota
        `);
      cuotasVenta = (cuotasResult.recordset || []).map(r => ({
        numeroCuota: r.numeroCuota,
        fechaPago: r.fechaPago ? String(r.fechaPago).trim().slice(0, 10) : '',
        total: r.total != null ? Number(r.total) : 0
      }));
    } catch (_) {
      cuotasVenta = [];
    }
  }

  const impuestosResult = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
    .query(`
      SELECT idImpuesto, descripcion, ISNULL(codigoSunat, '') AS codigoSunat,
        CONVERT(DECIMAL(5,2), porcentaje) AS porcentaje, pIncluyeIGV
      FROM Impuestos
      WHERE idEmpresa = @idEmpresa AND estado = 1
      ORDER BY descripcion
    `);
  const impuestos = (impuestosResult.recordset || []).map(r => ({
    idImpuesto: r.idImpuesto,
    descripcion: r.descripcion,
    codigoSunat: String(r.codigoSunat || '').trim(),
    porcentaje: r.porcentaje,
    pIncluyeIGV: !!r.pIncluyeIGV
  }));

  const emp = empresaResult.recordset && empresaResult.recordset[0] ? empresaResult.recordset[0] : null;
  let configPdf = [];
  try {
    const configRes = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
      .query(`
        SELECT clave, valor
        FROM ConfiguracionEmpresa
        WHERE idEmpresa = @idEmpresa
          AND clave IN (
            'PDF_CUENTAS_BANCARIAS',
            'PDF_TEMA_COLOR_ACTIVO',
            'PDF_COLOR_PRIMARIO',
            'VENTAS_USAR_DESCUENTO_EN_TOTAL'
          )
      `);
    configPdf = configRes.recordset || [];
  } catch (_) {
    configPdf = [];
  }
  const cfgMap = configPdf.reduce((acc, row) => {
    acc[String(row.clave || '').trim()] = row.valor != null ? String(row.valor).trim() : '';
    return acc;
  }, {});
  const usarDescuentoEnTotalPdf = interpretarBooleanoConfig(
    cfgMap.VENTAS_USAR_DESCUENTO_EN_TOTAL || 'true',
    true
  );
  const detalle = items.recordset || [];
  const hashRow = hashResult.recordset && hashResult.recordset[0] ? hashResult.recordset[0] : null;
  const resumenHash = hashRow && (hashRow.resumenHash || hashRow.resumenhash) ? String(hashRow.resumenHash || hashRow.resumenhash).trim() : '';

  let clienteDireccion = (cab.clienteDireccion != null && String(cab.clienteDireccion).trim() !== '') ? String(cab.clienteDireccion).trim() : '';
  if (!clienteDireccion && cab.idCliente != null) {
    try {
      const dirClienteResult = await pool
        .request()
        .input('idCliente', sql.Int, cab.idCliente)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
        .query(`SELECT TOP 1 ISNULL(direccion, '') AS direccion FROM DireccionClientes WHERE idCliente = @idCliente AND idEmpresa = @idEmpresa ORDER BY idDireccionClientes`);
      const dirRow = dirClienteResult.recordset && dirClienteResult.recordset[0];
      if (dirRow && dirRow.direccion) clienteDireccion = String(dirRow.direccion).trim();
    } catch (_) {}
  }

  const base = (baseUrl || '').replace(/\/$/, '');
  const logoFileName = emp && (
    emp.logoArchivo ?? emp.logoarchivo ?? emp.logo ?? emp.Logo ?? ''
  );
  const logoFile = typeof logoFileName === 'string' && String(logoFileName).trim() !== '';
  const logoUrl = logoFile ? `${base}/logos/${String(logoFileName).trim()}` : `${base}/assets/img/01.jpg`;

  const tipoDocCliente = cab.clienteTipoDoc != null ? String(cab.clienteTipoDoc).trim() : '';
  const tipoDocSunat = (tipoDocCliente === '6' || (cab.clienteRuc && String(cab.clienteRuc).length === 11)) ? '6' : '1';

  const exonerado = cab.exonerado != null ? Number(cab.exonerado) : 0;
  const gratuito = cab.gratuito != null ? Number(cab.gratuito) : 0;
  const otrosCargos = cab.otrosCargos != null ? Number(cab.otrosCargos) : 0;
  const descuentosCabeceraNum = cab.descuentos != null ? Number(cab.descuentos) : 0;
  const descuentosImpresion = usarDescuentoEnTotalPdf ? descuentosCabeceraNum : 0;

  const empresaPayload = emp
    ? {
        nombre: emp.nombre,
        ruc: emp.ruc,
        direccion: (emp.direccion != null && String(emp.direccion).trim()) ? String(emp.direccion).trim() : '',
        ubigeo: (emp.ubigeo != null && String(emp.ubigeo).trim()) ? String(emp.ubigeo).trim() : '',
        region: (emp.region != null && String(emp.region).trim()) ? String(emp.region).trim() : '',
        provincia: (emp.provincia != null && String(emp.provincia).trim()) ? String(emp.provincia).trim() : '',
        distrito: (emp.distrito != null && String(emp.distrito).trim()) ? String(emp.distrito).trim() : '',
        urbanizacion: (emp.urbanizacion != null && String(emp.urbanizacion).trim()) ? String(emp.urbanizacion).trim() : '',
        telefono: (emp.celular != null && String(emp.celular).trim()) ? String(emp.celular).trim() : '',
        rubro: (emp.rubro != null && String(emp.rubro).trim()) ? String(emp.rubro).trim() : '',
        correo: (emp.correo != null && String(emp.correo).trim()) ? String(emp.correo).trim() : '',
        logo: logoUrl,
        cuentasBancarias: cfgMap.PDF_CUENTAS_BANCARIAS || '',
        pdfUsarColor: String(cfgMap.PDF_TEMA_COLOR_ACTIVO || 'true').toLowerCase() !== 'false',
        pdfColorPrimario: cfgMap.PDF_COLOR_PRIMARIO || '#0B5FA5'
      }
    : {
        nombre: '',
        ruc: '',
        direccion: '',
        telefono: '',
        rubro: '',
        correo: '',
        logo: `${base}/assets/img/01.jpg`,
        cuentasBancarias: cfgMap.PDF_CUENTAS_BANCARIAS || '',
        pdfUsarColor: String(cfgMap.PDF_TEMA_COLOR_ACTIVO || 'true').toLowerCase() !== 'false',
        pdfColorPrimario: cfgMap.PDF_COLOR_PRIMARIO || '#0B5FA5'
      };

  return {
    venta: {
      idVenta: cab.idVenta,
      idEmpresa: cab.idEmpresa,
      idVentaAgrupada: cab.idVentaAgrupada != null ? String(cab.idVentaAgrupada).trim() : null,
      idEstadoSunat: cab.idEstadoSunat != null ? cab.idEstadoSunat : null,
      idSucursal: cab.idSucursal,
      idComprobante: cab.idComprobante,
      idCliente: cab.idCliente,
      compVenta: cab.compVenta,
      nombreComprobante: cab.nombreComprobante,
      codigoComprobante: cab.codigoComprobante != null ? String(cab.codigoComprobante).trim() : '01',
      condicionPago: cab.condicionPago != null ? String(cab.condicionPago).trim() : 'Contado',
      codigoCondicionPago: cab.codigoCondicionPago != null ? String(cab.codigoCondicionPago).trim() : '009',
      fEmision: cab.fEmision,
      fVencimiento: cab.fVencimiento != null ? String(cab.fVencimiento).trim().slice(0, 10) : '',
      subtotal: cab.subtotal,
      igv: cab.igv,
      exonerado,
      gratuito,
      otrosCargos,
      descuentos: cab.descuentos,
      descuentosImpresion,
      total: cab.total,
      resumenHash,
      cuotas: cuotasVenta,
      compRelacionado: cab.compRelacionado != null ? String(cab.compRelacionado).trim() : '',
      observaciones: cab.observaciones != null ? String(cab.observaciones).trim() : '',
      tipoComprobanteRef: cab.tipoComprobanteRef != null ? String(cab.tipoComprobanteRef).trim() : '',
      codigoMotivoNotaCredito: cab.codigoMotivoNotaCredito != null ? String(cab.codigoMotivoNotaCredito).trim() : '',
      eliminado: !!cab.eliminado
    },
    empresa: empresaPayload,
    cliente: {
      rSocial: cab.clienteRazonSocial,
      razonSocial: cab.clienteRazonSocial,
      ruc: cab.clienteRuc,
      celular: (cab.clienteCelular != null && String(cab.clienteCelular).trim() !== '') ? String(cab.clienteCelular).trim() : '',
      direccion: clienteDireccion,
      tipoDocSunat: tipoDocSunat
    },
    items: detalle.map(d => ({
      idDetalle: d.idDetalle,
      idProducto: d.idProducto,
      codigo: d.codigo,
      descripcion: d.descripcion,
      descripcionProducto: d.descripcionProducto != null ? String(d.descripcionProducto) : '',
      permiteDescripcionEnVenta: !!(d.permiteDescripcionEnVenta === true || d.permiteDescripcionEnVenta === 1),
      cantidad: d.cantidad,
      cantEntregada: d.cantEntregada != null ? Number(d.cantEntregada) : 0,
      pVenta: d.pVenta,
      subtotal: d.subtotal,
      total: d.total
    })),
    impuestos
  };
};

/** Actualiza cabecera y detalle de una venta. Solo permitir cuando idEstadoSunat no sea Aceptado (1,2,3). Cotización (CT): solo dentro de 24 h de emisión. */
exports.actualizarVentaCompleta = async (pool, idVenta, idEmpresa, cabecera, detalles) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const chk = await transaction.request()
      .input('idVenta', sql.Int, idVenta)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT ISNULL(v.eliminado, 0) AS eliminado, v.idEstadoSunat, c.codigo AS codigoComprobante, v.fEmision
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        WHERE v.idVenta = @idVenta AND v.idEmpresa = @idEmpresa
      `);
    const rowChk = chk.recordset && chk.recordset[0];
    if (!rowChk) {
      await transaction.rollback();
      return { ok: false, error: 'Venta no encontrada.' };
    }
    if (rowChk.eliminado) {
      await transaction.rollback();
      return { ok: false, error: 'No se puede editar: el comprobante fue anulado.' };
    }
    const idEstadoSunat = rowChk.idEstadoSunat;
    const codComp = String(rowChk.codigoComprobante || '').trim().toUpperCase();
    const esNotaVentaSinSunat = codComp === 'NV';
    if (!esNotaVentaSinSunat && (idEstadoSunat === 1 || idEstadoSunat === 2 || idEstadoSunat === 3)) {
      await transaction.rollback();
      return { ok: false, error: 'No se puede editar: el comprobante ya fue enviado o aceptado en SUNAT.' };
    }
    if (codComp === 'CT' || codComp === 'NV') {
      const fEm = rowChk.fEmision;
      const tEm = fEm instanceof Date ? fEm.getTime() : new Date(fEm).getTime();
      if (Number.isFinite(tEm) && Date.now() - tEm > 24 * 60 * 60 * 1000) {
        await transaction.rollback();
        return { ok: false, error: 'No se puede editar: la cotización/nota de venta solo admite edición dentro de las 24 horas posteriores a su emisión.' };
      }
    }
    const fEmisionRaw = cabecera.fEmision || null;
    const fEmision = fEmisionRaw != null ? (getFechaSoloSQLString(fEmisionRaw) || String(fEmisionRaw).trim().slice(0, 19).replace('T', ' ') + (String(fEmisionRaw).length <= 10 ? ' 00:00:00.000' : '.000')) : null;
    const idCliente = cabecera.idCliente != null ? Number(cabecera.idCliente) : null;
    const subtotal = Number(cabecera.subtotal) || 0;
    const igv = Number(cabecera.igv) || 0;
    const descuentos = Number(cabecera.descuentos) || 0;
    const total = Number(cabecera.total) || 0;
    if (idCliente != null && idCliente > 0) {
      await transaction.request()
        .input('idVenta', sql.Int, idVenta)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('fEmision', sql.VarChar(23), fEmision)
        .input('idCliente', sql.Int, idCliente)
        .input('subtotal', sql.Decimal(18, 2), subtotal)
        .input('igv', sql.Decimal(18, 2), igv)
        .input('descuentos', sql.Decimal(18, 2), descuentos)
        .input('total', sql.Decimal(18, 2), total)
        .query(`
          UPDATE Ventas SET fEmision = @fEmision, idCliente = @idCliente, subtotal = @subtotal, igv = @igv, descuentos = @descuentos, total = @total
          WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
        `);
    } else {
      await transaction.request()
        .input('idVenta', sql.Int, idVenta)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('fEmision', sql.VarChar(23), fEmision)
        .input('subtotal', sql.Decimal(18, 2), subtotal)
        .input('igv', sql.Decimal(18, 2), igv)
        .input('descuentos', sql.Decimal(18, 2), descuentos)
        .input('total', sql.Decimal(18, 2), total)
        .query(`
          UPDATE Ventas SET fEmision = @fEmision, subtotal = @subtotal, igv = @igv, descuentos = @descuentos, total = @total
          WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
        `);
    }
    await transaction.request()
      .input('idVenta', sql.Int, idVenta)
      .query('DELETE FROM DetalleVenta WHERE idVenta = @idVenta');
    for (const d of detalles) {
      const idProducto = d.idProducto;
      const cantidad = Number(d.cantidad) || 0;
      const pVenta = Number(d.pVenta) || 0;
      const totalItem = Number(d.total) != null ? Number(d.total) : cantidad * pVenta;
      const subtotalItem = cantidad * pVenta;
      const descuento = Number(d.descuento) || 0;
      const igv = d.igv != null ? (d.igv ? 1 : 0) : 0;
      const isc = d.isc != null ? (d.isc ? 1 : 0) : 0;
      let costoUnitario = Number(d.costoUnitario) || 0;
      let costoTotal = Number(d.costoTotal) || 0;
      const rawLinea = d.descripcionLinea != null ? d.descripcionLinea : d.descripcionVenta;
      let descripcionLineaIns = null;
      if (rawLinea != null) {
        const t = String(rawLinea).trim();
        descripcionLineaIns = t ? (t.length > 500 ? t.slice(0, 500) : t) : null;
      }
      if (costoTotal === 0 && cantidad > 0) {
        const rLote = await transaction.request()
          .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
          .input('idProducto', sql.UniqueIdentifier, idProducto)
          .query(`
            SELECT TOP 1 ISNULL(costoUnitario, 0) AS costoUnitario
            FROM Lotes
            WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND cantidadDisponible > 0
            ORDER BY fechaIngreso DESC
          `);
        costoUnitario = Number((rLote.recordset[0] || {}).costoUnitario || 0);
        costoTotal = cantidad * costoUnitario;
      } else if (costoTotal > 0 && costoUnitario === 0 && cantidad > 0) {
        costoUnitario = costoTotal / cantidad;
      }
      await transaction.request()
        .input('idVenta', sql.Int, idVenta)
        .input('idProducto', sql.UniqueIdentifier, idProducto)
        .input('cantidad', sql.Decimal(18, 3), cantidad)
        .input('pVenta', sql.Decimal(18, 5), pVenta)
        .input('descuento', sql.Decimal(18, 2), descuento)
        .input('subtotal', sql.Decimal(18, 2), subtotalItem)
        .input('igv', sql.Bit, igv)
        .input('isc', sql.Bit, isc)
        .input('total', sql.Decimal(18, 2), totalItem)
        .input('cantEntregada', sql.Decimal(18, 3), 0)
        .input('idEstadoPedido', sql.Int, 1)
        .input('costoUnitario', sql.Decimal(18, 6), costoUnitario)
        .input('costoTotal', sql.Decimal(18, 6), costoTotal)
        .input('descripcionLinea', sql.NVarChar(500), descripcionLineaIns)
        .query(`
          INSERT INTO DetalleVenta (idVenta, idProducto, cantidad, pVenta, descuento, subtotal, igv, isc, total, cantEntregada, idEstadoPedido, costoUnitario, costoTotal, descripcionLinea)
          VALUES (@idVenta, @idProducto, @cantidad, @pVenta, @descuento, @subtotal, @igv, @isc, @total, @cantEntregada, @idEstadoPedido, @costoUnitario, @costoTotal, @descripcionLinea)
        `);
    }
    await transaction.commit();
    return { ok: true };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/** Lista ventas pendientes de pago (idEstadoPago = 1). Filtros opcionales: idVenta, cliente (nombre o RUC). */
exports.listarPendientesPago = async (pool, idEmpresa, filtros = {}) => {
  const { idVenta, cliente } = filtros;
  const request = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  let whereClause = `v.idEmpresa = @idEmpresa AND v.idEstadoPago = 1
    AND NOT (
      UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('01', '03')
      AND (
        RTRIM(LTRIM(ISNULL(mp.codigo, ''))) IN ('010', '10')
        OR (
          (LOWER(ISNULL(mp.descripcion, '')) LIKE '%credito%' OR LOWER(ISNULL(mp.descripcion, '')) LIKE N'%crédito%')
          AND LOWER(ISNULL(mp.descripcion, '')) NOT LIKE '%tarjeta%'
        )
      )
    )`;
  if (idVenta != null && String(idVenta).trim() !== '') {
    request.input('idVenta', sql.Int, parseInt(idVenta, 10));
    whereClause += ' AND v.idVenta = @idVenta';
  }
  if (cliente != null && String(cliente).trim() !== '') {
    request.input('cliente', sql.VarChar(100), '%' + String(cliente).trim() + '%');
    whereClause += ' AND (cl.rSocial LIKE @cliente OR cl.ruc LIKE @cliente)';
  }
  const result = await request.query(`
    SELECT
      v.idVenta,
      v.compVenta,
      v.serie,
      v.numero,
      CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
      v.total,
      v.idEstadoPago,
      cl.rSocial AS clienteRazonSocial,
      cl.ruc AS clienteRuc
    FROM Ventas v
    LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
    LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
    LEFT JOIN MediosPago mp ON (
      mp.idMediosPago = TRY_CAST(v.idMediosPago AS INT)
      OR CAST(mp.idMediosPago AS VARCHAR(20)) = RTRIM(LTRIM(ISNULL(v.idMediosPago, '')))
    )
    WHERE ${whereClause}
    ORDER BY v.fEmision DESC
  `);
  return result.recordset || [];
};

/** Anula/elimina lógicamente una venta (eliminado=1). Restaura stock, elimina movimientos caja. No permitido si ya enviado a SUNAT. */
exports.anularVentaRepo = async (pool, idVenta, idEmpresa) => {
  const stockRepository = require('./stock.repository');
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const ventaRow = await transaction.request()
      .input('idVenta', sql.Int, idVenta)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT v.idVenta, v.idEstadoSunat, v.idSucursal, v.compVenta, ISNULL(v.eliminado, 0) AS eliminado,
          UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        WHERE v.idVenta = @idVenta AND v.idEmpresa = @idEmpresa
      `);
    const venta = ventaRow.recordset && ventaRow.recordset[0];
    if (!venta) {
      await transaction.rollback();
      return { ok: false, error: 'Venta no encontrada.' };
    }
    if (venta.eliminado) {
      await transaction.rollback();
      return { ok: false, error: 'El comprobante ya fue anulado.' };
    }
    const codAnular = String(venta.codigoComprobante || '').trim().toUpperCase();
    const esNotaVentaAnular = codAnular === 'NV';
    if (!esNotaVentaAnular && (venta.idEstadoSunat === 1 || venta.idEstadoSunat === 2 || venta.idEstadoSunat === 3)) {
      await transaction.rollback();
      return { ok: false, error: 'No se puede eliminar: el comprobante ya fue enviado o aceptado en SUNAT.' };
    }
    const idSucursal = venta.idSucursal;
    const detalleRows = await transaction.request()
      .input('idVenta', sql.Int, idVenta)
      .query(`
        SELECT idProducto, cantidad FROM DetalleVenta WHERE idVenta = @idVenta
      `);
    const detalles = detalleRows.recordset || [];
    for (const d of detalles) {
      const cant = parseFloat(d.cantidad) || 0;
      if (cant > 0 && d.idProducto) {
        await stockRepository.restaurarStockEnLotes(transaction, {
          idEmpresa,
          idSucursal,
          idProducto: d.idProducto,
          cantidad: cant
        });
      }
    }
    await transaction.request()
      .input('idVenta', sql.Int, idVenta)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query('DELETE FROM MovimientosCaja WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa');
    await transaction.request()
      .input('idVenta', sql.Int, idVenta)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        DELETE FROM DetallePagoVenta WHERE idVenta = @idVenta;
        UPDATE Ventas SET eliminado = 1 WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
      `);
    await transaction.commit();
    return { ok: true };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/** Actualiza estado de pago de una venta (ej: 2 = Pagado). */
exports.actualizarEstadoPagoVenta = async (transaction, idVenta, idEmpresa, idEstadoPago) => {
  const req = transaction.request();
  await req
    .input('idVenta', sql.Int, idVenta)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idEstadoPago', sql.Int, idEstadoPago)
    .query('UPDATE Ventas SET idEstadoPago = @idEstadoPago WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa');
};

/** Inserta cabecera de venta agrupada corporativa con comprobante VA. */
exports.insertarVentaAgrupada = async (transaction, datos) => {
  const {
    idEmpresaCobradora,
    idSucursal,
    idCliente,
    fEmision,
    subtotal,
    igv,
    descuentos,
    total,
    idEstadoPago,
    idUsuario,
    serie,
    numero,
    compVenta,
    tipoComprobanteDestino,
    idComprobante,
    observaciones
  } = datos;
  const observacionesVal = (observaciones == null) ? '' : String(observaciones).trim().slice(0, 500);
  const result = await transaction.request()
    .input('idEmpresaCobradora', sql.UniqueIdentifier, idEmpresaCobradora)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idCliente', sql.Int, idCliente)
    .input('fEmision', sql.VarChar(23), fEmision)
    .input('subtotal', sql.Decimal(18, 2), subtotal)
    .input('igv', sql.Decimal(18, 2), igv)
    .input('descuentos', sql.Decimal(18, 2), descuentos)
    .input('total', sql.Decimal(18, 2), total)
    .input('idEstadoPago', sql.Int, idEstadoPago)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('serie', sql.VarChar(4), serie || null)
    .input('numero', sql.VarChar(8), numero || null)
    .input('compVenta', sql.VarChar(13), compVenta || null)
    .input('tipoComprobanteDestino', sql.VarChar(2), tipoComprobanteDestino || 'NV')
    .input('idComprobante', sql.Int, idComprobante || null)
    .input('observaciones', sql.VarChar(500), observacionesVal)
    .query(`
      INSERT INTO VentaAgrupada (
        idEmpresaCobradora, idSucursal, idCliente, fEmision,
        subtotal, igv, descuentos, total, idEstadoPago, idUsuario,
        serie, numero, compVenta, tipoComprobanteDestino, idComprobante, observaciones
      )
      OUTPUT INSERTED.idVentaAgrupada
      VALUES (
        @idEmpresaCobradora, @idSucursal, @idCliente, @fEmision,
        @subtotal, @igv, @descuentos, @total, @idEstadoPago, @idUsuario,
        @serie, @numero, @compVenta, @tipoComprobanteDestino, @idComprobante, @observaciones
      )
    `);
  return result.recordset && result.recordset[0];
};

/** Inserta una linea de detalle del comprobante VA. */
exports.insertarDetalleVentaAgrupada = async (transaction, datos) => {
  const {
    idVentaAgrupada, idProducto, idEmpresaProducto, aliasEmpresa,
    sucursal, cantidad, pVenta, descuento, subtotal, igv, total,
    descripcionProducto, codigoProducto
  } = datos;
  await transaction.request()
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idEmpresaProducto', sql.UniqueIdentifier, idEmpresaProducto)
    .input('aliasEmpresa', sql.VarChar(10), aliasEmpresa || null)
    .input('sucursal', sql.VarChar(50), sucursal || null)
    .input('cantidad', sql.Decimal(18, 3), cantidad)
    .input('pVenta', sql.Decimal(18, 5), pVenta)
    .input('descuento', sql.Decimal(18, 2), descuento || 0)
    .input('subtotal', sql.Decimal(18, 2), subtotal)
    .input('igv', sql.Bit, igv ? 1 : 0)
    .input('total', sql.Decimal(18, 2), total)
    .input('descripcionProducto', sql.VarChar(200), descripcionProducto || null)
    .input('codigoProducto', sql.VarChar(20), codigoProducto || null)
    .query(`
      INSERT INTO DetalleVentaAgrupada (
        idVentaAgrupada, idProducto, idEmpresaProducto, aliasEmpresa,
        sucursal, cantidad, pVenta, descuento, subtotal, igv, total,
        descripcionProducto, codigoProducto
      ) VALUES (
        @idVentaAgrupada, @idProducto, @idEmpresaProducto, @aliasEmpresa,
        @sucursal, @cantidad, @pVenta, @descuento, @subtotal, @igv, @total,
        @descripcionProducto, @codigoProducto
      )
    `);
};

/** Inserta registro de auditoria/conciliacion en VentaAgrupadaLog. */
exports.insertarVentaAgrupadaLog = async (transaction, datos) => {
  const { idVentaAgrupada, evento, compVA, totalVA, sumaVentasHijas, idUsuario, detalle } = datos;
  const diferencia = (totalVA != null && sumaVentasHijas != null)
    ? Number(totalVA) - Number(sumaVentasHijas) : null;
  const estadoConciliacion = diferencia != null && Math.abs(diferencia) <= 0.01 ? 'OK' : 'PENDIENTE';
  await transaction.request()
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .input('evento', sql.VarChar(30), evento)
    .input('compVA', sql.VarChar(13), compVA || null)
    .input('totalVA', sql.Decimal(18, 2), totalVA || 0)
    .input('sumaVentasHijas', sql.Decimal(18, 2), sumaVentasHijas || 0)
    .input('diferencia', sql.Decimal(18, 2), diferencia || 0)
    .input('estadoConciliacion', sql.VarChar(10), estadoConciliacion)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario || null)
    .input('detalle', sql.VarChar(500), detalle || null)
    .query(`
      INSERT INTO VentaAgrupadaLog (
        idVentaAgrupada, evento, compVA, totalVA, sumaVentasHijas,
        diferencia, estadoConciliacion, idUsuario, detalle
      ) VALUES (
        @idVentaAgrupada, @evento, @compVA, @totalVA, @sumaVentasHijas,
        @diferencia, @estadoConciliacion, @idUsuario, @detalle
      )
    `);
};

/** Inserta cabecera de venta por empresa (corporativa). */
exports.insertarVentaEmpresa = async (transaction, datos) => {
  const {
    idVentaAgrupada,
    idEmpresa,
    idVenta,
    idComprobante,
    serie,
    numero,
    compVenta,
    fEmision,
    fVencimiento,
    idCliente,
    idMoneda,
    tCambio,
    subtotal,
    igv,
    exonerado,
    gratuito,
    otrosCargos,
    descuentos,
    total,
    idMediosPago,
    idEstadoPedido,
    idEstadoPago,
    idEstadoSunat,
    tipoComprobante,
    compRelacionado,
    observaciones,
    idUsuario
  } = datos;
  const compRelacionadoVal = (compRelacionado == null)
    ? ''
    : String(compRelacionado).trim().slice(0, 30);
  const observacionesVal = (observaciones == null)
    ? ''
    : String(observaciones).trim().slice(0, 500);
  const result = await transaction.request()
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idVenta', sql.Int, idVenta)
    .input('idComprobante', sql.Int, idComprobante)
    .input('serie', sql.VarChar(4), serie)
    .input('numero', sql.VarChar(8), numero)
    .input('compVenta', sql.VarChar(13), compVenta)
    .input('fEmision', sql.VarChar(23), fEmision)
    .input('fVencimiento', sql.VarChar(23), fVencimiento)
    .input('idCliente', sql.Int, idCliente)
    .input('idMoneda', sql.Int, idMoneda)
    .input('tCambio', sql.Decimal(10, 4), tCambio)
    .input('subtotal', sql.Decimal(18, 2), subtotal)
    .input('igv', sql.Decimal(18, 2), igv)
    .input('exonerado', sql.Decimal(18, 2), exonerado)
    .input('gratuito', sql.Decimal(18, 2), gratuito)
    .input('otrosCargos', sql.Decimal(18, 2), otrosCargos)
    .input('descuentos', sql.Decimal(18, 2), descuentos)
    .input('total', sql.Decimal(18, 2), total)
    .input('idMediosPago', sql.VarChar(20), idMediosPago)
    .input('idEstadoPedido', sql.Int, idEstadoPedido)
    .input('idEstadoPago', sql.Int, idEstadoPago)
    .input('idEstadoSunat', sql.Int, idEstadoSunat)
    .input('tipoComprobante', sql.VarChar(2), tipoComprobante)
    .input('compRelacionado', sql.VarChar(30), compRelacionadoVal)
    .input('observaciones', sql.VarChar(500), observacionesVal)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .query(`
      INSERT INTO VentaEmpresa (
        idVentaAgrupada, idEmpresa, idVenta, idComprobante, serie, numero, compVenta,
        fEmision, fVencimiento, idCliente, idMoneda, tCambio, subtotal, igv, exonerado,
        gratuito, otrosCargos, descuentos, total, idMediosPago, idEstadoPedido,
        idEstadoPago, idEstadoSunat, tipoComprobante, compRelacionado, observaciones, idUsuario
      )
      OUTPUT INSERTED.idVentaEmpresa
      VALUES (
        @idVentaAgrupada, @idEmpresa, @idVenta, @idComprobante, @serie, @numero, @compVenta,
        @fEmision, @fVencimiento, @idCliente, @idMoneda, @tCambio, @subtotal, @igv, @exonerado,
        @gratuito, @otrosCargos, @descuentos, @total, @idMediosPago, @idEstadoPedido,
        @idEstadoPago, @idEstadoSunat, @tipoComprobante, @compRelacionado, @observaciones, @idUsuario
      )
    `);
  return result.recordset && result.recordset[0];
};

/** Inserta detalle de venta por empresa (corporativa). */
exports.insertarDetalleVentaEmpresa = async (transaction, datos) => {
  const {
    idVentaEmpresa,
    idProducto,
    cantidad,
    pVenta,
    descuento,
    subtotal,
    igv,
    isc,
    total,
    cantEntregada,
    idEstadoPedido,
    costoUnitario,
    costoTotal
  } = datos;
  await transaction.request()
    .input('idVentaEmpresa', sql.UniqueIdentifier, idVentaEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('cantidad', sql.Decimal(18, 3), cantidad)
    .input('pVenta', sql.Decimal(18, 5), pVenta)
    .input('descuento', sql.Decimal(18, 2), descuento)
    .input('subtotal', sql.Decimal(18, 2), subtotal)
    .input('igv', sql.Bit, igv)
    .input('isc', sql.Bit, isc)
    .input('total', sql.Decimal(18, 2), total)
    .input('cantEntregada', sql.Decimal(18, 3), cantEntregada)
    .input('idEstadoPedido', sql.Int, idEstadoPedido)
    .input('costoUnitario', sql.Decimal(18, 6), costoUnitario)
    .input('costoTotal', sql.Decimal(18, 6), costoTotal)
    .query(`
      INSERT INTO DetalleVentaEmpresa (
        idVentaEmpresa, idProducto, cantidad, pVenta, descuento, subtotal, igv, isc, total,
        cantEntregada, idEstadoPedido, costoUnitario, costoTotal
      )
      VALUES (
        @idVentaEmpresa, @idProducto, @cantidad, @pVenta, @descuento, @subtotal, @igv, @isc, @total,
        @cantEntregada, @idEstadoPedido, @costoUnitario, @costoTotal
      )
    `);
};

/** Obtiene cliente por idEmpresa e idCliente. */
exports.obtenerClientePorId = async (transaction, idEmpresa, idCliente) => {
  const result = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, idCliente)
    .query(`
      SELECT TOP 1 idCliente, idDocumento, ruc, rSocial, correo, celular, condicion
      FROM Clientes
      WHERE idEmpresa = @idEmpresa AND idCliente = @idCliente
    `);
  return result.recordset && result.recordset[0];
};

/** Obtiene cliente por idCliente en un conjunto de empresas permitidas. */
exports.obtenerClientePorIdEnEmpresas = async (transaction, idCliente, idsEmpresa) => {
  const ids = (idsEmpresa || []).filter(Boolean);
  if (!idCliente || ids.length === 0) return null;
  const request = transaction.request().input('idCliente', sql.Int, idCliente);
  const placeholders = ids.map((id, index) => {
    const key = `idEmpresa${index}`;
    request.input(key, sql.UniqueIdentifier, id);
    return `@${key}`;
  });
  const result = await request.query(`
    SELECT TOP 1 idCliente, idEmpresa, idDocumento, ruc, rSocial, correo, celular, condicion
    FROM Clientes
    WHERE idCliente = @idCliente AND idEmpresa IN (${placeholders.join(', ')})
  `);
  return result.recordset && result.recordset[0];
};

/** Busca cliente por documento (RUC/DNI) en una empresa. */
exports.buscarClientePorDocumento = async (transaction, idEmpresa, ruc) => {
  const result = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('ruc', sql.VarChar(11), ruc)
    .query(`
      SELECT TOP 1 idCliente, idDocumento, ruc, rSocial, correo, celular, condicion
      FROM Clientes
      WHERE idEmpresa = @idEmpresa AND ruc = @ruc
    `);
  return result.recordset && result.recordset[0];
};

/** Inserta cliente en empresa destino replicando datos básicos. */
exports.crearClienteEnEmpresa = async (transaction, idEmpresa, clienteBase) => {
  const result = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idDocumento', sql.VarChar(1), clienteBase.idDocumento)
    .input('ruc', sql.VarChar(11), clienteBase.ruc)
    .input('rSocial', sql.VarChar(200), clienteBase.rSocial)
    .input('correo', sql.VarChar(100), clienteBase.correo || null)
    .input('celular', sql.VarChar(50), clienteBase.celular || null)
    .input('condicion', sql.VarChar(50), clienteBase.condicion || null)
    .query(`
      INSERT INTO Clientes (idEmpresa, idDocumento, ruc, rSocial, correo, celular, condicion, estado)
      OUTPUT INSERTED.idCliente
      VALUES (@idEmpresa, @idDocumento, @ruc, @rSocial, @correo, @celular, @condicion, 1)
    `);
  return result.recordset && result.recordset[0];
};

/** Lista ventas agrupadas por empresa cobradora con datos del comprobante VA. */
exports.listarVentasAgrupadas = async (pool, idEmpresaCobradora) => {
  const result = await pool.request()
    .input('idEmpresaCobradora', sql.UniqueIdentifier, idEmpresaCobradora)
    .query(`
      SELECT
        va.idVentaAgrupada,
        CONVERT(VARCHAR(19), va.fEmision, 120) AS fEmision,
        va.total,
        va.idEstadoPago,
        va.idSucursal,
        ISNULL(s.nombre, '') AS sucursal,
        va.idCliente,
        ISNULL(cl.rSocial, '') AS clienteRazonSocial,
        ISNULL(cl.ruc, '') AS clienteRuc,
        va.serie,
        va.numero,
        va.compVenta,
        ISNULL(va.tipoComprobanteDestino, 'NV') AS tipoComprobanteDestino,
        va.observaciones
      FROM VentaAgrupada va
      LEFT JOIN Sucursal s ON s.idSucursal = va.idSucursal
      LEFT JOIN Clientes cl ON cl.idCliente = va.idCliente AND cl.idEmpresa = va.idEmpresaCobradora
      WHERE va.idEmpresaCobradora = @idEmpresaCobradora AND ISNULL(va.eliminado, 0) = 0
      ORDER BY va.fEmision DESC
    `);
  return result.recordset || [];
};

/** Lista ventas agrupadas pendientes de pago (idEstadoPago = 1). Busca por idVentaAgrupada o compVenta VA. */
exports.listarPendientesPagoAgrupado = async (pool, idEmpresaCobradora, filtros = {}) => {
  const { idVentaAgrupada, cliente } = filtros;
  const request = pool.request().input('idEmpresaCobradora', sql.UniqueIdentifier, idEmpresaCobradora);
  let whereClause = 'va.idEmpresaCobradora = @idEmpresaCobradora AND va.idEstadoPago = 1 AND ISNULL(va.eliminado, 0) = 0';
  if (idVentaAgrupada != null && String(idVentaAgrupada).trim() !== '') {
    const filtro = String(idVentaAgrupada).trim();
    request.input('filtroVA', sql.VarChar(100), '%' + filtro + '%');
    whereClause += ' AND (CAST(va.idVentaAgrupada AS VARCHAR(36)) LIKE @filtroVA OR ISNULL(va.compVenta, \'\') LIKE @filtroVA)';
  }
  if (cliente != null && String(cliente).trim() !== '') {
    request.input('cliente', sql.VarChar(100), '%' + String(cliente).trim() + '%');
    whereClause += ' AND (cl.rSocial LIKE @cliente OR cl.ruc LIKE @cliente)';
  }
  const result = await request.query(`
    SELECT
      va.idVentaAgrupada,
      CONVERT(VARCHAR(19), va.fEmision, 120) AS fEmision,
      va.total,
      va.idEstadoPago,
      cl.rSocial AS clienteRazonSocial,
      cl.ruc AS clienteRuc,
      va.compVenta,
      va.serie,
      va.numero,
      ISNULL(va.tipoComprobanteDestino, 'NV') AS tipoComprobanteDestino
    FROM VentaAgrupada va
    LEFT JOIN Clientes cl ON cl.idCliente = va.idCliente AND cl.idEmpresa = va.idEmpresaCobradora
    WHERE ${whereClause}
    ORDER BY va.fEmision DESC
  `);
  return result.recordset || [];
};

/** Actualiza estado de pago en venta agrupada. */
exports.actualizarEstadoPagoVentaAgrupada = async (transaction, idVentaAgrupada, idEmpresaCobradora, idEstadoPago) => {
  await transaction.request()
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .input('idEmpresaCobradora', sql.UniqueIdentifier, idEmpresaCobradora)
    .input('idEstadoPago', sql.Int, idEstadoPago)
    .query(`
      UPDATE VentaAgrupada
      SET idEstadoPago = @idEstadoPago
      WHERE idVentaAgrupada = @idVentaAgrupada AND idEmpresaCobradora = @idEmpresaCobradora
    `);
};

/** Lista ventas por empresa asociadas a una venta agrupada (total + sucursal de Ventas para caja multiempresa). */
exports.listarVentasEmpresaPorAgrupada = async (transaction, idVentaAgrupada) => {
  const result = await transaction.request()
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .query(`
      SELECT
        ve.idVenta,
        ve.idEmpresa,
        ve.compVenta,
        ve.total,
        ve.idCliente,
        v.idSucursal,
        UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante
      FROM VentaEmpresa ve
      LEFT JOIN Ventas v ON v.idVenta = ve.idVenta AND v.idEmpresa = ve.idEmpresa
      LEFT JOIN Comprobantes c ON c.idComprobante = ve.idComprobante AND c.idEmpresa = ve.idEmpresa
      WHERE ve.idVentaAgrupada = @idVentaAgrupada
      ORDER BY ve.fEmision ASC, ve.idVenta ASC
    `);
  return result.recordset || [];
};

/** Lista comprobantes por venta agrupada (para modal de detalle). */
exports.listarComprobantesPorAgrupada = async (pool, idEmpresaCobradora, idVentaAgrupada) => {
  const result = await pool.request()
    .input('idEmpresaCobradora', sql.UniqueIdentifier, idEmpresaCobradora)
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .query(`
      SELECT
        ve.idVenta,
        ve.compVenta,
        ve.serie,
        ve.numero,
        ve.idComprobante,
        c.nombre AS nombreComprobante,
        c.codigo AS codigoComprobante,
        e.razon_Social AS empresaRazonSocial,
        e.ruc AS empresaRuc,
        CONVERT(VARCHAR(19), ve.fEmision, 120) AS fEmision,
        ve.total
      FROM VentaEmpresa ve
      INNER JOIN VentaAgrupada va ON va.idVentaAgrupada = ve.idVentaAgrupada
      INNER JOIN Empresas e ON e.idEmpresa = ve.idEmpresa
      LEFT JOIN Comprobantes c ON c.idComprobante = ve.idComprobante AND c.idEmpresa = ve.idEmpresa
      WHERE ve.idVentaAgrupada = @idVentaAgrupada
        AND va.idEmpresaCobradora = @idEmpresaCobradora
      ORDER BY ve.fEmision ASC
    `);
  return result.recordset || [];
};

/** Lista ventas por empresa (corporativas). */
exports.listarVentasEmpresa = async (pool, idEmpresa) => {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        ve.idVentaEmpresa,
        ve.idVentaAgrupada,
        ve.compVenta,
        CONVERT(VARCHAR(19), ve.fEmision, 120) AS fEmision,
        ve.total,
        ve.idEstadoSunat,
        ve.serie,
        ve.numero,
        ve.idComprobante,
        ve.idCliente,
        ve.idMediosPago,
        c.nombre AS nombreComprobante,
        c.codigo AS codigoComprobante,
        COALESCE(LTRIM(RTRIM(cl.rSocial)), '') AS clienteRazonSocial,
        COALESCE(cl.ruc, '') AS clienteRuc,
        ISNULL(ve.eliminado, 0) AS eliminado
      FROM VentaEmpresa ve
      LEFT JOIN Comprobantes c ON c.idComprobante = ve.idComprobante AND c.idEmpresa = ve.idEmpresa
      LEFT JOIN Clientes cl ON cl.idCliente = ve.idCliente AND cl.idEmpresa = ve.idEmpresa
      WHERE ve.idEmpresa = @idEmpresa AND ISNULL(ve.eliminado, 0) = 0
      ORDER BY ve.fEmision DESC
    `);
  return result.recordset || [];
};

/** Datos del comprobante VA para generar PDF (cabecera, empresa gestora, cliente, items con alias empresa). */
exports.obtenerComprobanteVAParaPdf = async (pool, idEmpresaCobradora, idVentaAgrupada, baseUrl = 'http://localhost:3000') => {
  const cabResult = await pool.request()
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .input('idEmpresaCobradora', sql.UniqueIdentifier, idEmpresaCobradora)
    .query(`
      SELECT
        va.idVentaAgrupada, va.compVenta, va.serie, va.numero,
        CONVERT(VARCHAR(19), va.fEmision, 120) AS fEmision,
        va.subtotal, va.igv, va.descuentos, va.total,
        va.idEstadoPago, va.tipoComprobanteDestino, va.observaciones,
        va.idCliente, va.idSucursal,
        ISNULL(s.nombre, '') AS sucursal,
        ISNULL(cl.rSocial, '') AS clienteRazonSocial,
        ISNULL(cl.ruc, '') AS clienteRuc,
        ISNULL(cl.idDocumento, '1') AS clienteTipoDoc,
        ISNULL(cl.celular, '') AS clienteCelular,
        (SELECT TOP 1 ISNULL(direccion, '') FROM DireccionClientes WHERE idCliente = cl.idCliente AND idEmpresa = cl.idEmpresa ORDER BY idDireccionClientes) AS clienteDireccion
      FROM VentaAgrupada va
      LEFT JOIN Sucursal s ON s.idSucursal = va.idSucursal
      LEFT JOIN Clientes cl ON cl.idCliente = va.idCliente AND cl.idEmpresa = va.idEmpresaCobradora
      WHERE va.idVentaAgrupada = @idVentaAgrupada AND va.idEmpresaCobradora = @idEmpresaCobradora
    `);
  const cab = cabResult.recordset && cabResult.recordset[0];
  if (!cab) return null;

  const empResult = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresaCobradora)
    .query(`
      SELECT e.razon_Social AS nombre, e.ruc, e.Logo AS logoArchivo,
        ISNULL(e.rubro, '') AS rubro, ISNULL(e.celular, '') AS celular,
        ISNULL(e.correo, '') AS correo,
        ISNULL(de.direccion, '') AS direccion
      FROM Empresas e
      LEFT JOIN DireccionEmpresa de ON e.idEmpresa = de.idEmpresa AND de.principal = 1
      WHERE e.idEmpresa = @idEmpresa
    `);
  const emp = empResult.recordset && empResult.recordset[0];

  const itemsResult = await pool.request()
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .query(`
      SELECT
        dva.idDetalleVA, dva.idProducto, dva.cantidad, dva.pVenta,
        dva.descuento, dva.subtotal, dva.total,
        dva.descripcionProducto, dva.codigoProducto,
        dva.aliasEmpresa, dva.sucursal, dva.idEmpresaProducto
      FROM DetalleVentaAgrupada dva
      WHERE dva.idVentaAgrupada = @idVentaAgrupada
      ORDER BY dva.idDetalleVA
    `);

  const base = (baseUrl || '').replace(/\/$/, '');
  const logoFileName = emp && (emp.logoArchivo ?? emp.logo ?? '');
  const logoUrl = (typeof logoFileName === 'string' && logoFileName.trim())
    ? `${base}/logos/${logoFileName.trim()}`
    : `${base}/assets/img/01.jpg`;

  let usarDescVa = true;
  try {
    const cfgVa = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresaCobradora)
      .query(`
        SELECT valor FROM ConfiguracionEmpresa
        WHERE idEmpresa = @idEmpresa AND clave = 'VENTAS_USAR_DESCUENTO_EN_TOTAL'
      `);
    const rowV = cfgVa.recordset && cfgVa.recordset[0];
    if (rowV && rowV.valor != null) {
      usarDescVa = interpretarBooleanoConfig(rowV.valor, true);
    }
  } catch (_) {
    usarDescVa = true;
  }
  const descVaNum = cab.descuentos != null ? Number(cab.descuentos) : 0;
  const descuentosImpresionVa = usarDescVa ? descVaNum : 0;

  const tipoDestLabels = { 'NV': 'Nota de Venta', '01': 'Factura', '03': 'Boleta' };

  return {
    venta: {
      idVentaAgrupada: cab.idVentaAgrupada,
      compVenta: cab.compVenta,
      serie: cab.serie,
      numero: cab.numero,
      fEmision: cab.fEmision,
      subtotal: cab.subtotal,
      igv: cab.igv,
      descuentos: cab.descuentos,
      descuentosImpresion: descuentosImpresionVa,
      total: cab.total,
      idEstadoPago: cab.idEstadoPago,
      tipoComprobanteDestino: cab.tipoComprobanteDestino,
      tipoComprobanteDestinoNombre: tipoDestLabels[cab.tipoComprobanteDestino] || cab.tipoComprobanteDestino,
      observaciones: cab.observaciones || '',
      sucursal: cab.sucursal
    },
    empresa: emp ? {
      nombre: emp.nombre,
      ruc: emp.ruc,
      direccion: (emp.direccion || '').trim(),
      telefono: (emp.celular || '').trim(),
      rubro: (emp.rubro || '').trim(),
      correo: (emp.correo || '').trim(),
      logo: logoUrl
    } : { nombre: '', ruc: '', direccion: '', telefono: '', logo: `${base}/assets/img/01.jpg` },
    cliente: {
      rSocial: cab.clienteRazonSocial,
      razonSocial: cab.clienteRazonSocial,
      ruc: cab.clienteRuc,
      celular: (cab.clienteCelular || '').trim(),
      direccion: (cab.clienteDireccion || '').trim(),
      tipoDocSunat: (cab.clienteTipoDoc === '6' || (cab.clienteRuc && String(cab.clienteRuc).length === 11)) ? '6' : '1'
    },
    items: (itemsResult.recordset || []).map(d => ({
      idDetalleVA: d.idDetalleVA,
      idProducto: d.idProducto,
      codigo: d.codigoProducto,
      descripcion: d.descripcionProducto,
      cantidad: d.cantidad,
      pVenta: d.pVenta,
      descuento: d.descuento,
      subtotal: d.subtotal,
      total: d.total,
      aliasEmpresa: d.aliasEmpresa || '',
      sucursal: d.sucursal || '',
      idEmpresaProducto: d.idEmpresaProducto
    }))
  };
};

/** Obtiene detalle de una venta agrupada (para despacho/caja). */
exports.obtenerDetalleVentaAgrupada = async (pool, idEmpresaCobradora, idVentaAgrupada) => {
  const result = await pool.request()
    .input('idEmpresaCobradora', sql.UniqueIdentifier, idEmpresaCobradora)
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .query(`
      SELECT
        ve.idEmpresa,
        ve.idVentaEmpresa,
        dv.idProducto,
        p.codigo,
        p.descripcion,
        dv.cantidad,
        dv.pVenta,
        dv.subtotal,
        dv.total
      FROM VentaAgrupada va
      INNER JOIN VentaEmpresa ve ON ve.idVentaAgrupada = va.idVentaAgrupada
      INNER JOIN DetalleVentaEmpresa dv ON dv.idVentaEmpresa = ve.idVentaEmpresa
      INNER JOIN Productos p ON p.idProducto = dv.idProducto
      WHERE va.idVentaAgrupada = @idVentaAgrupada
        AND va.idEmpresaCobradora = @idEmpresaCobradora
    `);
  return result.recordset || [];
};