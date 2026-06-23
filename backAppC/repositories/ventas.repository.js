// repositories/ventas.repository.js
const sql = require('mssql');
const { parseFEmisionCabeceraSQL, mergeFEmisionNvCtSiMedianocheInnecessario } = require('../utils/fechaHoraLocal.util');
const {
  interpretarBooleanoConfig,
  leerPermitirVentasNegativas,
  crearLectorConfiguracionEmpresa
} = require('../utils/configBoolean.util');
const { appendAgentDebugNdjson } = require('../utils/debugAgentLog.util');
const { extraerDireccionClienteDesdeXmlUbl } = require('../utils/extraerDireccionClienteXmlUbl.util');
const { direccionClienteLegiblePdf } = require('../utils/direccionClientePdf.util');
const { ventasTieneColumnaIdDireccionClientes } = require('../utils/ventasColumnaDireccion.util');
const {
  SQL_SELECT_USUARIO_VENTAS,
  SQL_JOIN_USUARIO_VENTAS
} = require('../utils/documentoTrazabilidad.util');
const gestoresRepository = require('./gestores.repository');

/** Normaliza RUC/DNI a solo dígitos para cruzar con Clientes. No registrar el valor en logs. */
function documentoSoloDigitosPdf(valor) {
  if (valor == null) return '';
  return String(valor).replace(/\D/g, '');
}

/**
 * PDF comprobante: solo calle (dc.direccion). distrito/provincia/region en BD suelen ser IDs/ubigeo, no nombres.
 */
const SQL_DC_LINEA_DIRECCION_READABLE = `LTRIM(RTRIM(ISNULL(dc.direccion, '')))`;

/**
 * Dirección en PDF de venta (solo `DireccionClientes`).
 * `empresasInList` es la lista SQL ya enlazada, p. ej. `@pdfEmp0,@pdfEmp1` (gestora + gestionadas).
 * Requiere alias `v` y `cl` en el SELECT exterior.
 */
function buildSqlExprClienteDireccionPdfVenta(tieneColVentas, empresasInList) {
  const empIn = `IN (${empresasInList})`;
  if (tieneColVentas) {
    return `COALESCE(
  NULLIF(LTRIM(RTRIM((
    SELECT TOP 1 ${SQL_DC_LINEA_DIRECCION_READABLE}
    FROM DireccionClientes dc
    WHERE v.idDireccionClientes IS NOT NULL
      AND dc.idDireccionClientes = v.idDireccionClientes
      AND dc.idEmpresa ${empIn}
      AND dc.idCliente = v.idCliente
      AND NULLIF(${SQL_DC_LINEA_DIRECCION_READABLE}, '') IS NOT NULL
  ))), ''),
  ISNULL((
    SELECT TOP 1 ${SQL_DC_LINEA_DIRECCION_READABLE}
    FROM DireccionClientes dc
    INNER JOIN Clientes cl2 ON cl2.idCliente = dc.idCliente
    WHERE cl2.idEmpresa ${empIn}
      AND NULLIF(${SQL_DC_LINEA_DIRECCION_READABLE}, '') IS NOT NULL
      AND (
        dc.idCliente = cl.idCliente
        OR (
          LEN(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(cl.ruc,''))), '-', ''), ' ', ''), '.', '')) >= 8
          AND REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(cl2.ruc,''))), '-', ''), ' ', ''), '.', '')
              = REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(cl.ruc,''))), '-', ''), ' ', ''), '.', '')
        )
      )
    ORDER BY
      CASE WHEN dc.idCliente = cl.idCliente THEN 0 ELSE 1 END,
      CASE WHEN ISNULL(dc.principal, 0) = 1 THEN 0 ELSE 1 END,
      dc.idDireccionClientes ASC
  ), ''),
  ''
)`;
  }
  return `ISNULL((
    SELECT TOP 1 ${SQL_DC_LINEA_DIRECCION_READABLE}
    FROM DireccionClientes dc
    INNER JOIN Clientes cl2 ON cl2.idCliente = dc.idCliente
    WHERE cl2.idEmpresa ${empIn}
      AND NULLIF(${SQL_DC_LINEA_DIRECCION_READABLE}, '') IS NOT NULL
      AND (
        dc.idCliente = cl.idCliente
        OR (
          LEN(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(cl.ruc,''))), '-', ''), ' ', ''), '.', '')) >= 8
          AND REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(cl2.ruc,''))), '-', ''), ' ', ''), '.', '')
              = REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(cl.ruc,''))), '-', ''), ' ', ''), '.', '')
        )
      )
    ORDER BY
      CASE WHEN dc.idCliente = cl.idCliente THEN 0 ELSE 1 END,
      CASE WHEN ISNULL(dc.principal, 0) = 1 THEN 0 ELSE 1 END,
      dc.idDireccionClientes ASC
  ), '')`;
}

function sqlSelectIdDireccionClientesVenta(tieneColVentas) {
  return tieneColVentas
    ? 'v.idDireccionClientes AS idDireccionClientesVenta'
    : 'CAST(NULL AS INT) AS idDireccionClientesVenta';
}

/** Dirección al enriquecer NC/ND desde comprobante origen (empresas del mismo alcance JWT). */
function buildSqlExprClienteDireccionNotaOrigen(empresasInList) {
  return `ISNULL((
    SELECT TOP 1 ${SQL_DC_LINEA_DIRECCION_READABLE}
    FROM DireccionClientes dc
    WHERE dc.idCliente = cl.idCliente AND dc.idEmpresa IN (${empresasInList})
      AND NULLIF(${SQL_DC_LINEA_DIRECCION_READABLE}, '') IS NOT NULL
    ORDER BY CASE WHEN ISNULL(dc.principal, 0) = 1 THEN 0 ELSE 1 END, dc.idDireccionClientes
), '')`;
}

/** IN (@p0,@p1,...) para UUIDs en requests de consulta PDF / multiempresa */
const bindUniqueIdentifiersIn = (request, idsEmpresa, prefix) => {
  const list = (Array.isArray(idsEmpresa) ? idsEmpresa : [idsEmpresa]).filter(Boolean);
  return list.map((id, i) => {
    const k = `${prefix}${i}`;
    request.input(k, sql.UniqueIdentifier, id);
    return `@${k}`;
  }).join(', ');
};

/** Impuesto activo en catálogo (bit/int o textos Activ/Inactiv). Alineado al criterio del POS. */
function normalizarEstadoImpuestoCatalogo(val) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0 || val == null) return false;
  const s = String(val).trim().toLowerCase();
  if (s === '0' || s === 'false' || s === 'inactivo' || s === 'inactiva' || s === 'no') return false;
  if (s === '1' || s === 'true' || s === 'activo' || s === 'activa' || s === 'si' || s === 'sí') return true;
  return !!val;
}

/** Comprobante de venta NC/ND (catálogo interno B7/F7/B8/F8, no el tipo SUNAT 07/08). */
const CODIGOS_VENTA_NOTA_CREDITO_DEBITO = new Set(["B7", "F7", "B8", "F8"]);

/**
 * Copia cliente desde la factura/boleta indicada en compRelacionado cuando la NC/ND no tiene receptor válido.
 * Evita enviar 00000000 si la boleta original sí tenía cliente en BD.
 */
async function enriquecerClienteDesdeVentaOrigenSiNota(pool, cab, idsEmpresaPermitidas) {
  if (!cab || !cab.idEmpresa) return;
  const cod = String(cab.codigoComprobante || "").trim().toUpperCase();
  if (!CODIGOS_VENTA_NOTA_CREDITO_DEBITO.has(cod)) return;
  const rel = String(cab.compRelacionado || "").trim();
  const dash = rel.indexOf("-");
  if (dash < 1) return;
  const serieOrigen = rel.slice(0, dash).trim();
  const numPart = rel.slice(dash + 1).replace(/\D/g, "");
  if (!serieOrigen || !numPart) return;
  const numInt = parseInt(numPart, 10);
  if (!Number.isFinite(numInt) || numInt < 0) return;
  const rucN = String(cab.clienteRuc ?? "").replace(/\D/g, "");
  const sinClienteValido = cab.idCliente == null || !rucN || rucN === "00000000";
  if (!sinClienteValido) return;
  try {
    const idsPerm =
      (Array.isArray(idsEmpresaPermitidas) ? idsEmpresaPermitidas : [idsEmpresaPermitidas]).filter(Boolean);
    const ids = idsPerm.length > 0 ? idsPerm : [cab.idEmpresa];
    const reqNota = pool.request();
    const inList = bindUniqueIdentifiersIn(reqNota, ids, "notaOrigenEmp");
    const exprDirNota = buildSqlExprClienteDireccionNotaOrigen(inList);
    reqNota.input("serie", sql.VarChar(20), serieOrigen.slice(0, 20));
    reqNota.input("numero", sql.Int, numInt);
    const q = await reqNota.query(`
        SELECT TOP 1
          cl.idCliente,
          cl.rSocial AS clienteRazonSocial,
          cl.ruc AS clienteRuc,
          cl.idDocumento AS clienteTipoDoc,
          ${exprDirNota} AS clienteDireccion
        FROM Ventas v
        INNER JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa IN (${inList})
        WHERE v.idEmpresa IN (${inList})
          AND LTRIM(RTRIM(v.serie)) = LTRIM(RTRIM(@serie))
          AND v.numero = @numero
          AND c.codigo IN (N'01', N'03')
        ORDER BY v.idVenta DESC
      `);
    const row = q.recordset && q.recordset[0];
    if (!row || !String(row.clienteRuc || "").trim()) return;
    cab.idCliente = row.idCliente != null ? row.idCliente : cab.idCliente;
    cab.clienteRazonSocial = row.clienteRazonSocial || cab.clienteRazonSocial;
    cab.clienteRuc = row.clienteRuc || cab.clienteRuc;
    cab.clienteTipoDoc = row.clienteTipoDoc != null ? String(row.clienteTipoDoc).trim() : cab.clienteTipoDoc;
    if (row.clienteDireccion != null && String(row.clienteDireccion).trim() !== "") {
      cab.clienteDireccion = direccionClienteLegiblePdf(String(row.clienteDireccion).trim());
    }
  } catch (err) {
    console.error("enriquecerClienteDesdeVentaOrigenSiNota:", err);
  }
}

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

  const idDireccionClientesVal =
    datosVenta.idDireccionClientes != null && Number(datosVenta.idDireccionClientes) > 0
      ? Number(datosVenta.idDireccionClientes)
      : null;

  const compRelacionadoVal = (compRelacionado == null)
    ? ''
    : String(compRelacionado).trim().slice(0, 30);
  const observacionesVal = (observaciones == null)
    ? ''
    : String(observaciones).trim().slice(0, 500);

  const fVencimientoVal = fVencimiento != null ? fVencimiento : fEmision;
  const idEstadoPedidoVal = idEstadoPedido != null ? parseInt(idEstadoPedido, 10) : 1;
  const idEstadoPagoVal = idEstadoPago != null ? parseInt(idEstadoPago, 10) : 1;

  const tieneDirVentas = await ventasTieneColumnaIdDireccionClientes(transaction);

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

  if (tieneDirVentas) {
    req.input('idDireccionClientes', sql.Int, idDireccionClientesVal);
  }

  if (idVentaAgrupada) {
    req.input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada);
    if (tieneDirVentas) {
      return await req.query(`
      DECLARE @ins TABLE (idVenta INT);
      INSERT INTO Ventas
      (idEmpresa, idSucursal, serie, numero, compVenta, idComprobante, fEmision, fVencimiento, idCliente, idMoneda, tCambio, subtotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, idEstadoPedido, idEstadoPago, idEstadoSunat, compRelacionado, observaciones, idUsuario, idVentaAgrupada, idDireccionClientes)
      OUTPUT INSERTED.idVenta INTO @ins
      VALUES
      (@idEmpresa, @idSucursal, @serie, @numero, @compVenta, @idComprobante, @fEmision, @fVencimiento, @idCliente, @idMoneda, @tCambio, @subtotal, @igv, @exonerado, @gratuito, @otrosCargos, @descuentos, @total, @idMediosPago, @idEstadoPedido, @idEstadoPago, @idEstadoSunat, @compRelacionado, @observaciones, @idUsuario, @idVentaAgrupada, @idDireccionClientes);
      SELECT idVenta FROM @ins;`);
    }
    return await req.query(`
      DECLARE @ins TABLE (idVenta INT);
      INSERT INTO Ventas
      (idEmpresa, idSucursal, serie, numero, compVenta, idComprobante, fEmision, fVencimiento, idCliente, idMoneda, tCambio, subtotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, idEstadoPedido, idEstadoPago, idEstadoSunat, compRelacionado, observaciones, idUsuario, idVentaAgrupada)
      OUTPUT INSERTED.idVenta INTO @ins
      VALUES
      (@idEmpresa, @idSucursal, @serie, @numero, @compVenta, @idComprobante, @fEmision, @fVencimiento, @idCliente, @idMoneda, @tCambio, @subtotal, @igv, @exonerado, @gratuito, @otrosCargos, @descuentos, @total, @idMediosPago, @idEstadoPedido, @idEstadoPago, @idEstadoSunat, @compRelacionado, @observaciones, @idUsuario, @idVentaAgrupada);
      SELECT idVenta FROM @ins;`);
  }

  if (tieneDirVentas) {
    return await req.query(`
    DECLARE @ins TABLE (idVenta INT);
    INSERT INTO Ventas
    (idEmpresa, idSucursal, serie, numero, compVenta, idComprobante, fEmision, fVencimiento, idCliente, idMoneda, tCambio, subtotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, idEstadoPedido, idEstadoPago, idEstadoSunat, compRelacionado, observaciones, idUsuario, idDireccionClientes)
    OUTPUT INSERTED.idVenta INTO @ins
    VALUES
    (@idEmpresa, @idSucursal, @serie, @numero, @compVenta, @idComprobante, @fEmision, @fVencimiento, @idCliente, @idMoneda, @tCambio, @subtotal, @igv, @exonerado, @gratuito, @otrosCargos, @descuentos, @total, @idMediosPago, @idEstadoPedido, @idEstadoPago, @idEstadoSunat, @compRelacionado, @observaciones, @idUsuario, @idDireccionClientes);
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

/**
 * Primera dirección del cliente con texto (principal primero). Para `Ventas.idDireccionClientes` cuando el front no envía id.
 * @param {import('mssql').Transaction} transaction
 * @param {string|string[]} idsEmpresa - Empresa de la venta o lista (gestora + gestionadas): `DireccionClientes.idEmpresa` debe estar en el conjunto.
 * @param {number} idCliente
 * @param {string|null} [idEmpresaPreferente] - Prioriza dirección registrada en esta empresa (p. ej. `Ventas.idEmpresa`).
 */
exports.obtenerIdDireccionClientePreferidoParaVenta = async (
  transaction,
  idsEmpresa,
  idCliente,
  idEmpresaPreferente = null
) => {
  if (idCliente == null || Number(idCliente) <= 0) return undefined;
  let ids = (Array.isArray(idsEmpresa) ? idsEmpresa : [idsEmpresa]).filter(Boolean);
  if (ids.length === 0 && idEmpresaPreferente) ids = [idEmpresaPreferente];
  if (ids.length === 0) return undefined;

  const req = transaction.request().input('idCliente', sql.Int, Number(idCliente));
  const inList = bindUniqueIdentifiersIn(req, ids, 'dirPrefEmp');
  let orderPref = '';
  if (idEmpresaPreferente) {
    req.input('idEmpresaPrefDir', sql.UniqueIdentifier, idEmpresaPreferente);
    orderPref = 'CASE WHEN idEmpresa = @idEmpresaPrefDir THEN 0 ELSE 1 END, ';
  }
  const r = await req.query(`
      SELECT TOP 1 idDireccionClientes
      FROM DireccionClientes
      WHERE idEmpresa IN (${inList})
        AND idCliente = @idCliente
        AND NULLIF(LTRIM(RTRIM(ISNULL(direccion, ''))), '') IS NOT NULL
      ORDER BY ${orderPref}CASE WHEN ISNULL(principal, 0) = 1 THEN 0 ELSE 1 END, idDireccionClientes ASC
    `);
  const id = r.recordset[0]?.idDireccionClientes;
  return id != null && Number(id) > 0 ? Number(id) : undefined;
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
exports.listarPorEmpresa = async (pool, idEmpresa, opts = {}) => {
  const idSucursalFiltro = opts.idSucursal && String(opts.idSucursal).trim() ? String(opts.idSucursal).trim() : null;
  const whereSuc = idSucursalFiltro ? " AND v.idSucursal = @idSucF" : "";
  let result;
  try {
    const req = pool.request().input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
    if (idSucursalFiltro) req.input("idSucF", sql.UniqueIdentifier, idSucursalFiltro);
    result = await req.query(`
        SELECT
          v.idVenta,
          v.idSucursal,
          ISNULL(s.nombre, '') AS nombreSucursal,
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
          ISNULL(LTRIM(RTRIM(v.compRelacionado)), '') AS compRelacionado,
          ISNULL(mp.descripcion, CAST(v.idMediosPago AS VARCHAR(20))) AS condicionPago,
          c.nombre AS nombreComprobante,
          c.codigo AS codigoComprobante,
          COALESCE(LTRIM(RTRIM(cl.rSocial)), (SELECT TOP 1 LTRIM(RTRIM(c2.rSocial)) FROM Clientes c2 WHERE c2.idCliente = v.idCliente AND c2.idEmpresa = v.idEmpresa), '') AS clienteRazonSocial,
          COALESCE(cl.ruc, (SELECT TOP 1 c2.ruc FROM Clientes c2 WHERE c2.idCliente = v.idCliente AND c2.idEmpresa = v.idEmpresa), '') AS clienteRuc,
          ce.idComprobanteElectronico,
          ce.tipoComprobante,
          e.ruc AS rucEmpresa,
          ISNULL(v.eliminado, 0) AS eliminado,
          CASE
            WHEN aggfp.codigos IS NULL OR LTRIM(RTRIM(aggfp.codigos)) = '' THEN '{}'
            ELSE '{' + aggfp.codigos + '}'
          END AS formaPago,
          ${SQL_SELECT_USUARIO_VENTAS}
        FROM Ventas v
        LEFT JOIN Sucursal s ON s.idSucursal = v.idSucursal AND s.idEmpresa = v.idEmpresa
        LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
        LEFT JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta AND ce.idEmpresa = v.idEmpresa
        LEFT JOIN Empresas e ON e.idEmpresa = v.idEmpresa
        LEFT JOIN MediosPago mp ON mp.idMediosPago = TRY_CAST(v.idMediosPago AS INT)
        ${SQL_JOIN_USUARIO_VENTAS}
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
        WHERE v.idEmpresa = @idEmpresa${whereSuc}
        ORDER BY v.fEmision DESC, v.idVenta DESC
      `);
  } catch (err) {
    if (err.message && (err.message.includes('MediosPago') || err.message.includes('FormasPago') || err.message.includes('MovimientosCaja') || err.message.includes('Invalid object'))) {
      const reqFb = pool.request().input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
      if (idSucursalFiltro) reqFb.input("idSucF", sql.UniqueIdentifier, idSucursalFiltro);
      result = await reqFb.query(`
          SELECT
            v.idVenta,
            v.idSucursal,
            ISNULL(s.nombre, '') AS nombreSucursal,
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
            ISNULL(LTRIM(RTRIM(v.compRelacionado)), '') AS compRelacionado,
            c.nombre AS nombreComprobante,
            c.codigo AS codigoComprobante,
            COALESCE(LTRIM(RTRIM(cl.rSocial)), (SELECT TOP 1 LTRIM(RTRIM(c2.rSocial)) FROM Clientes c2 WHERE c2.idCliente = v.idCliente AND c2.idEmpresa = v.idEmpresa), '') AS clienteRazonSocial,
            COALESCE(cl.ruc, (SELECT TOP 1 c2.ruc FROM Clientes c2 WHERE c2.idCliente = v.idCliente AND c2.idEmpresa = v.idEmpresa), '') AS clienteRuc,
            ce.idComprobanteElectronico,
            ce.tipoComprobante,
            e.ruc AS rucEmpresa,
            ISNULL(v.eliminado, 0) AS eliminado,
            '' AS formaPago,
            ${SQL_SELECT_USUARIO_VENTAS}
          FROM Ventas v
          LEFT JOIN Sucursal s ON s.idSucursal = v.idSucursal AND s.idEmpresa = v.idEmpresa
          LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
          LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
          LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
          LEFT JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta AND ce.idEmpresa = v.idEmpresa
          LEFT JOIN Empresas e ON e.idEmpresa = v.idEmpresa
          ${SQL_JOIN_USUARIO_VENTAS}
          WHERE v.idEmpresa = @idEmpresa${whereSuc}
          ORDER BY v.fEmision DESC, v.idVenta DESC
        `);
    } else {
      throw err;
    }
  }
  const rows = result.recordset || [];
  return rows.map((r) => ({
    ...r,
    idSucursal: r.idSucursal != null ? String(r.idSucursal) : null,
    nombreSucursal: r.nombreSucursal != null ? String(r.nombreSucursal).trim() : "",
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
exports.listarPorIdsEmpresas = async (pool, idsEmpresa, opts = {}) => {
  const ids = (Array.isArray(idsEmpresa) ? idsEmpresa : [idsEmpresa]).filter(Boolean);
  if (ids.length === 0) return [];
  if (ids.length === 1) {
    const rows = await exports.listarPorEmpresa(pool, ids[0], opts);
    return rows.map((r) => ({ ...r, idEmpresa: ids[0], razonSocialEmpresa: '' }));
  }
  const idSucursalFiltro = opts.idSucursal && String(opts.idSucursal).trim() ? String(opts.idSucursal).trim() : null;
  const whereSuc = idSucursalFiltro ? " AND v.idSucursal = @idSucF" : "";
  const req = pool.request();
  const inList = bindUniqueIdentifiersIn(req, ids, 'empV');
  if (idSucursalFiltro) req.input("idSucF", sql.UniqueIdentifier, idSucursalFiltro);
  let result;
  try {
    result = await req.query(`
      SELECT
        v.idEmpresa,
        v.idVenta,
        v.idSucursal,
        ISNULL(s.nombre, '') AS nombreSucursal,
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
        ISNULL(LTRIM(RTRIM(v.compRelacionado)), '') AS compRelacionado,
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
        END AS formaPago,
        ${SQL_SELECT_USUARIO_VENTAS}
      FROM Ventas v
      LEFT JOIN Sucursal s ON s.idSucursal = v.idSucursal AND s.idEmpresa = v.idEmpresa
      LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
      LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
      LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
      LEFT JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta AND ce.idEmpresa = v.idEmpresa
      LEFT JOIN Empresas e ON e.idEmpresa = v.idEmpresa
      LEFT JOIN MediosPago mp ON mp.idMediosPago = TRY_CAST(v.idMediosPago AS INT)
      ${SQL_JOIN_USUARIO_VENTAS}
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
      WHERE v.idEmpresa IN (${inList})${whereSuc}
      ORDER BY v.fEmision DESC, v.idVenta DESC
    `);
  } catch (err) {
    if (err.message && (err.message.includes('MediosPago') || err.message.includes('FormasPago') || err.message.includes('MovimientosCaja') || err.message.includes('Invalid object'))) {
      const reqFb = pool.request();
      const inListFb = bindUniqueIdentifiersIn(reqFb, ids, 'empV');
      if (idSucursalFiltro) reqFb.input("idSucF", sql.UniqueIdentifier, idSucursalFiltro);
      result = await reqFb.query(`
        SELECT
          v.idEmpresa,
          v.idVenta,
          v.idSucursal,
          ISNULL(s.nombre, '') AS nombreSucursal,
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
          ISNULL(LTRIM(RTRIM(v.compRelacionado)), '') AS compRelacionado,
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
        LEFT JOIN Sucursal s ON s.idSucursal = v.idSucursal AND s.idEmpresa = v.idEmpresa
        LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
        LEFT JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta AND ce.idEmpresa = v.idEmpresa
        LEFT JOIN Empresas e ON e.idEmpresa = v.idEmpresa
        WHERE v.idEmpresa IN (${inListFb})${whereSuc}
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
    idSucursal: r.idSucursal != null ? String(r.idSucursal) : null,
    nombreSucursal: r.nombreSucursal != null ? String(r.nombreSucursal).trim() : "",
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

function mapRowVentasListado(r) {
  return {
    ...r,
    idEmpresa: r.idEmpresa != null ? String(r.idEmpresa) : null,
    idSucursal: r.idSucursal != null ? String(r.idSucursal) : null,
    nombreSucursal: r.nombreSucursal != null ? String(r.nombreSucursal).trim() : '',
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
  };
}

function bindFiltrosVentasListado(req, opts = {}) {
  const { likePattern } = require('../utils/paginacion.util');
  let whereExtra = '';
  const idSucursalFiltro = opts.idSucursal && String(opts.idSucursal).trim() ? String(opts.idSucursal).trim() : null;
  if (idSucursalFiltro) {
    req.input('idSucF', sql.UniqueIdentifier, idSucursalFiltro);
    whereExtra += ' AND v.idSucursal = @idSucF';
  }
  const fechaDesde = opts.fechaDesde && String(opts.fechaDesde).trim() ? String(opts.fechaDesde).trim().slice(0, 10) : null;
  const fechaHasta = opts.fechaHasta && String(opts.fechaHasta).trim() ? String(opts.fechaHasta).trim().slice(0, 10) : null;
  if (fechaDesde) {
    req.input('fechaDesde', sql.Date, fechaDesde);
    whereExtra += ' AND CAST(v.fEmision AS DATE) >= @fechaDesde';
  }
  if (fechaHasta) {
    req.input('fechaHasta', sql.Date, fechaHasta);
    whereExtra += ' AND CAST(v.fEmision AS DATE) <= @fechaHasta';
  }
  const buscarPat = likePattern(opts.buscar);
  if (buscarPat) {
    req.input('buscar', sql.NVarChar(200), buscarPat);
    whereExtra += ` AND (
      v.compVenta LIKE @buscar ESCAPE '\\'
      OR v.serie LIKE @buscar ESCAPE '\\'
      OR CAST(v.numero AS NVARCHAR(20)) LIKE @buscar ESCAPE '\\'
      OR cl.rSocial LIKE @buscar ESCAPE '\\'
      OR cl.ruc LIKE @buscar ESCAPE '\\'
      OR CAST(v.idVenta AS NVARCHAR(20)) LIKE @buscar ESCAPE '\\'
      OR ISNULL(v.compRelacionado, '') LIKE @buscar ESCAPE '\\'
    )`;
  }
  const tipoPat = likePattern(opts.tipoComprobante);
  if (tipoPat) {
    req.input('tipoComp', sql.NVarChar(100), tipoPat);
    whereExtra += ` AND (c.nombre LIKE @tipoComp ESCAPE '\\' OR c.codigo LIKE @tipoComp ESCAPE '\\')`;
  }
  return whereExtra;
}

const SQL_VENTAS_LISTADO_SELECT = `
  v.idEmpresa,
  v.idVenta,
  v.idSucursal,
  ISNULL(s.nombre, '') AS nombreSucursal,
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
  ISNULL(LTRIM(RTRIM(v.compRelacionado)), '') AS compRelacionado,
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
  '' AS formaPago,
  ${SQL_SELECT_USUARIO_VENTAS}
`;

const SQL_VENTAS_LISTADO_FROM = `
  FROM Ventas v
  LEFT JOIN Sucursal s ON s.idSucursal = v.idSucursal AND s.idEmpresa = v.idEmpresa
  LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
  LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
  LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
  LEFT JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta AND ce.idEmpresa = v.idEmpresa
  LEFT JOIN Empresas e ON e.idEmpresa = v.idEmpresa
  LEFT JOIN MediosPago mp ON mp.idMediosPago = TRY_CAST(v.idMediosPago AS INT)
  ${SQL_JOIN_USUARIO_VENTAS}
`;

/**
 * Lista paginada de comprobantes de venta (gestora + gestionadas).
 * @returns {Promise<{ rows: object[], total: number }>}
 */
exports.listarPorIdsEmpresasPaginado = async (pool, idsEmpresa, opts = {}) => {
  const { parsePaginacion } = require('../utils/paginacion.util');
  const ids = (Array.isArray(idsEmpresa) ? idsEmpresa : [idsEmpresa]).filter(Boolean);
  if (ids.length === 0) return { rows: [], total: 0 };

  const pag = parsePaginacion(opts);
  const pagina = pag.pagina;
  const porPagina = pag.porPagina;
  const offset = pag.offset;

  const reqCount = pool.request();
  const inList = bindUniqueIdentifiersIn(reqCount, ids, 'empPag');
  const whereExtra = bindFiltrosVentasListado(reqCount, opts);
  const countSql = `
    SELECT COUNT(*) AS total
    ${SQL_VENTAS_LISTADO_FROM}
    WHERE v.idEmpresa IN (${inList})${whereExtra}
  `;
  const countRes = await reqCount.query(countSql);
  const total = countRes.recordset?.[0] ? Number(countRes.recordset[0].total) || 0 : 0;

  const reqData = pool.request();
  const inListData = bindUniqueIdentifiersIn(reqData, ids, 'empPagD');
  const whereExtraData = bindFiltrosVentasListado(reqData, opts);
  reqData.input('offset', sql.Int, offset);
  reqData.input('limite', sql.Int, porPagina);

  const dataSql = `
    SELECT ${SQL_VENTAS_LISTADO_SELECT}
    ${SQL_VENTAS_LISTADO_FROM}
    WHERE v.idEmpresa IN (${inListData})${whereExtraData}
    ORDER BY v.fEmision DESC, v.idVenta DESC
    OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY
  `;
  const dataRes = await reqData.query(dataSql);
  const rows = (dataRes.recordset || []).map(mapRowVentasListado);
  return { rows, total, pagina, porPagina };
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

  const tieneDirVentas = await ventasTieneColumnaIdDireccionClientes(pool);
  const selIdDirVenta = sqlSelectIdDireccionClientesVenta(tieneDirVentas);

  let cabecera;
  try {
    const reqCab = pool.request().input('idVenta', sql.Int, idVenta);
    const inList = inEmp(reqCab);
    const exprDirPdf = buildSqlExprClienteDireccionPdfVenta(tieneDirVentas, inList);
    cabecera = await reqCab.query(`
        SELECT
          v.idEmpresa,
          v.idVenta, v.compVenta, v.serie, v.numero, v.idEstadoSunat, v.idSucursal, v.idComprobante,
          v.idVentaAgrupada,
          ${selIdDirVenta},
          CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
          CONVERT(VARCHAR(10), v.fVencimiento, 120) AS fVencimiento,
          v.subtotal, v.igv,
          ISNULL(v.exonerado, 0) AS exonerado,
          ISNULL(v.gratuito, 0) AS gratuito,
          ISNULL(v.otrosCargos, 0) AS otrosCargos,
          ISNULL(v.descuentos, 0) AS descuentos, v.total,
          v.idMediosPago,
          v.idEstadoPago,
          ISNULL(v.eliminado, 0) AS eliminado,
          v.compRelacionado, v.observaciones, v.tipoComprobanteRef, v.codigoMotivoNotaCredito,
          c.nombre AS nombreComprobante, c.codigo AS codigoComprobante,
          ISNULL(mp.descripcion, ISNULL(fp.descripcion, 'Contado')) AS condicionPago,
          ISNULL(mp.codigo, '009') AS codigoCondicionPago,
          cl.idCliente AS idCliente,
          cl.rSocial AS clienteRazonSocial, cl.ruc AS clienteRuc, cl.idDocumento AS clienteTipoDoc,
          ISNULL(cl.celular, '') AS clienteCelular,
          ${exprDirPdf} AS clienteDireccion,
          ${SQL_SELECT_USUARIO_VENTAS}
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        LEFT JOIN FormasPago fp ON fp.idFormaPago = TRY_CAST(v.idMediosPago AS INT)
        LEFT JOIN MediosPago mp ON mp.idMediosPago = TRY_CAST(v.idMediosPago AS INT)
        LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa IN (${inList})
        ${SQL_JOIN_USUARIO_VENTAS}
        WHERE v.idVenta = @idVenta AND v.idEmpresa IN (${inList})
      `);
  } catch (err) {
    if (err.message && (err.message.includes('MediosPago') || err.message.includes('Invalid object'))) {
      const reqCab2 = pool.request().input('idVenta', sql.Int, idVenta);
      const inList2 = inEmp(reqCab2);
      const exprDirPdf2 = buildSqlExprClienteDireccionPdfVenta(tieneDirVentas, inList2);
      cabecera = await reqCab2.query(`
        SELECT
          v.idEmpresa,
          v.idVenta, v.compVenta, v.serie, v.numero, v.idEstadoSunat, v.idSucursal, v.idComprobante,
          v.idVentaAgrupada,
          ${selIdDirVenta},
          CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
          CONVERT(VARCHAR(10), v.fVencimiento, 120) AS fVencimiento,
          v.subtotal, v.igv,
          ISNULL(v.exonerado, 0) AS exonerado,
          ISNULL(v.gratuito, 0) AS gratuito,
          ISNULL(v.otrosCargos, 0) AS otrosCargos,
          ISNULL(v.descuentos, 0) AS descuentos, v.total,
          v.idMediosPago,
          v.idEstadoPago,
          ISNULL(v.eliminado, 0) AS eliminado,
          v.compRelacionado, v.observaciones, v.tipoComprobanteRef, v.codigoMotivoNotaCredito,
          c.nombre AS nombreComprobante, c.codigo AS codigoComprobante,
          'Contado' AS condicionPago,
          '009' AS codigoCondicionPago,
          cl.idCliente AS idCliente,
          cl.rSocial AS clienteRazonSocial, cl.ruc AS clienteRuc, cl.idDocumento AS clienteTipoDoc,
          ISNULL(cl.celular, '') AS clienteCelular,
          ${exprDirPdf2} AS clienteDireccion,
          ${SQL_SELECT_USUARIO_VENTAS}
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa IN (${inList2})
        ${SQL_JOIN_USUARIO_VENTAS}
        WHERE v.idVenta = @idVenta AND v.idEmpresa IN (${inList2})
      `);
    } else {
      throw err;
    }
  }

  const cab = cabecera.recordset && cabecera.recordset[0] ? cabecera.recordset[0] : null;
  if (!cab || !cab.idEmpresa) return null;
  await enriquecerClienteDesdeVentaOrigenSiNota(pool, cab, idsPermitidos);
  const idEmpresaVenta = cab.idEmpresa;

  let empresaResult;
  const idSucVenta = cab.idSucursal != null ? cab.idSucursal : null;
  try {
    if (idSucVenta) {
      empresaResult = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
        .input('idSuc', sql.UniqueIdentifier, idSucVenta)
        .query(`
        SELECT e.razon_Social AS nombre, e.ruc, e.Logo AS logoArchivo,
          ISNULL(e.rubro, '') AS rubro,
          ISNULL(e.celular, '') AS celular,
          ISNULL(e.correo, '') AS correo,
          ISNULL(LTRIM(RTRIM(COALESCE(
            NULLIF(LTRIM(RTRIM(de_suc.direccion)), ''),
            NULLIF(LTRIM(RTRIM(s.direccion)), ''),
            NULLIF(LTRIM(RTRIM(de_prin.direccion)), ''),
            ''
          ))), '') AS direccion,
          ISNULL(LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(de_suc.ubigeo)), ''), de_prin.ubigeo, ''))), '') AS ubigeo,
          ISNULL(LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(de_suc.region)), ''), de_prin.region, ''))), '') AS region,
          ISNULL(LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(de_suc.provincia)), ''), de_prin.provincia, ''))), '') AS provincia,
          ISNULL(LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(de_suc.distrito)), ''), de_prin.distrito, ''))), '') AS distrito,
          ISNULL(LTRIM(RTRIM(COALESCE(NULLIF(LTRIM(RTRIM(de_suc.urbanizacion)), ''), de_prin.urbanizacion, ''))), '') AS urbanizacion,
          COALESCE(
            NULLIF(LTRIM(RTRIM(de_suc.codLocal)), ''),
            NULLIF(LTRIM(RTRIM(de_prin.codLocal)), ''),
            '0000'
          ) AS codLocalSunat
        FROM Empresas e
        LEFT JOIN Sucursal s ON s.idSucursal = @idSuc AND s.idEmpresa = @idEmpresa
        LEFT JOIN DireccionEmpresa de_suc ON de_suc.idDireccionEmpresa = s.idDireccionEmpresa
        LEFT JOIN DireccionEmpresa de_prin ON de_prin.idEmpresa = e.idEmpresa AND de_prin.principal = 1
        WHERE e.idEmpresa = @idEmpresa
      `);
    } else {
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
          ISNULL(de.urbanizacion, '') AS urbanizacion,
          ISNULL(NULLIF(LTRIM(RTRIM(de.codLocal)), ''), '0000') AS codLocalSunat
        FROM Empresas e
        LEFT JOIN DireccionEmpresa de ON e.idEmpresa = de.idEmpresa AND de.principal = 1
        WHERE e.idEmpresa = @idEmpresa
      `);
    }
  } catch (err) {
    console.error('obtenerComprobanteParaPdf empresa (fallback):', err);
    empresaResult = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
      .query(`
        SELECT e.razon_Social AS nombre, e.ruc, e.Logo AS logoArchivo,
          ISNULL(e.rubro, '') AS rubro,
          ISNULL(e.celular, '') AS celular,
          ISNULL(e.correo, '') AS correo,
          ISNULL(LTRIM(RTRIM(de.direccion)), '') AS direccion,
          '' AS ubigeo, '' AS region, '' AS provincia, '' AS distrito, '' AS urbanizacion,
          '0000' AS codLocalSunat
        FROM Empresas e
        LEFT JOIN DireccionEmpresa de ON de.idEmpresa = e.idEmpresa AND de.principal = 1
        WHERE e.idEmpresa = @idEmpresa
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
        p.codigo,
        LTRIM(RTRIM(ISNULL(pr.descripcion, ''))) AS presentacion,
        LTRIM(RTRIM(ISNULL(pr.codigo, ''))) AS presentacionCodigo,
        LTRIM(RTRIM(ISNULL(m.nombre, ''))) AS marca
      FROM DetalleVenta dv
      INNER JOIN Productos p ON p.idProducto = dv.idProducto AND p.idEmpresa = @idEmpresaVenta
      LEFT JOIN Presentacion pr ON pr.idPresentacion = p.idPresentacion
      LEFT JOIN Marcas m ON m.idMarca = p.idMarca
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
      SELECT
        idImpuesto,
        descripcion,
        ISNULL(codigoSunat, '') AS codigoSunat,
        CONVERT(DECIMAL(5,2), porcentaje) AS porcentaje,
        pIncluyeIGV,
        ISNULL(estado, 0) AS estado
      FROM Impuestos
      WHERE idEmpresa = @idEmpresa
      ORDER BY descripcion
    `);
  const impuestos = (impuestosResult.recordset || []).map(r => ({
    idImpuesto: r.idImpuesto,
    descripcion: r.descripcion,
    codigoSunat: String(r.codigoSunat || '').trim(),
    porcentaje: r.porcentaje,
    pIncluyeIGV: !!r.pIncluyeIGV,
    estado: normalizarEstadoImpuestoCatalogo(r.estado)
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

  let clienteDireccion = (cab.clienteDireccion != null && String(cab.clienteDireccion).trim() !== '')
    ? direccionClienteLegiblePdf(String(cab.clienteDireccion).trim())
    : '';
  const dirLenCabecera = clienteDireccion.length;


  let dirLenPorIdCliente = 0;
  let filasDireccionClientesIdCliente = [];
  if (!clienteDireccion && cab.idCliente != null) {
    try {
      const dirClienteResult = await pool
        .request()
        .input('idCliente', sql.Int, cab.idCliente)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
        .query(`
          SELECT idDireccionClientes, ISNULL(principal,0) AS principal,
            LTRIM(RTRIM(ISNULL(direccion, ''))) AS direccion
          FROM DireccionClientes
          WHERE idCliente = @idCliente AND idEmpresa = @idEmpresa
          ORDER BY ISNULL(principal,0) DESC, idDireccionClientes`);
      filasDireccionClientesIdCliente = (dirClienteResult.recordset || []).map((r) => ({
        idDireccionClientes: r.idDireccionClientes,
        principal: r.principal === 1 || r.principal === true,
        direccion: r.direccion != null ? String(r.direccion) : ''
      }));
      const elegida = filasDireccionClientesIdCliente.find((r) => r.direccion && r.direccion.trim() !== '');
      if (elegida) {
        clienteDireccion = direccionClienteLegiblePdf(elegida.direccion.trim());
        dirLenPorIdCliente = clienteDireccion.length;
      }
    } catch (err) {
      console.error('obtenerComprobanteParaPdf direccion por idCliente:', err);
    }
  }


  // Fallback: si aún no hay direccion y el cab trae RUC/DNI con >=8 digitos, buscar dirección de cualquier
  // cliente con el mismo RUC normalizado dentro de la misma empresa (caso clientes duplicados por RUC).
  const docDigitsCab = documentoSoloDigitosPdf(cab.clienteRuc);
  let dirLenPorRucEmpresa = 0;
  let clientesMismaEmpRucCount = -1;
  let dirsClientesMismaEmpRucCount = -1;
  let filasDireccionClientesPorRuc = [];
  let clientesMismaEmpRucDetalle = [];
  if (!clienteDireccion && docDigitsCab.length >= 8 && idEmpresaVenta) {
    try {
      const detCli = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
        .input('rucNorm', sql.VarChar(32), docDigitsCab)
        .query(`
          SELECT cl.idCliente, ISNULL(cl.rSocial, '') AS rSocial, ISNULL(cl.ruc, '') AS ruc
          FROM Clientes cl
          WHERE cl.idEmpresa = @idEmpresa
            AND REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(cl.ruc,''))), '-', ''), ' ', ''), '.', '') = @rucNorm
        `);
      clientesMismaEmpRucDetalle = (detCli.recordset || []).map((r) => ({
        idCliente: r.idCliente,
        rSocial: r.rSocial != null ? String(r.rSocial) : '',
        ruc: r.ruc != null ? String(r.ruc) : ''
      }));
      clientesMismaEmpRucCount = clientesMismaEmpRucDetalle.length;

      const detDir = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
        .input('rucNorm', sql.VarChar(32), docDigitsCab)
        .query(`
          SELECT dc.idDireccionClientes, dc.idCliente, ISNULL(dc.principal, 0) AS principal,
            LTRIM(RTRIM(ISNULL(dc.direccion, ''))) AS direccion
          FROM DireccionClientes dc
          INNER JOIN Clientes cl ON cl.idCliente = dc.idCliente
          WHERE cl.idEmpresa = @idEmpresa
            AND REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(cl.ruc,''))), '-', ''), ' ', ''), '.', '') = @rucNorm
        `);
      filasDireccionClientesPorRuc = (detDir.recordset || []).map((r) => ({
        idDireccionClientes: r.idDireccionClientes,
        idCliente: r.idCliente,
        principal: r.principal === 1 || r.principal === true,
        direccion: r.direccion != null ? String(r.direccion) : ''
      }));
      dirsClientesMismaEmpRucCount = filasDireccionClientesPorRuc.filter((r) => r.direccion && r.direccion.trim() !== '').length;

      if (dirsClientesMismaEmpRucCount > 0) {
        const idClienteVenta = cab.idCliente != null && Number.isFinite(Number(cab.idCliente)) ? Number(cab.idCliente) : -1;
        const elegida = [...filasDireccionClientesPorRuc]
          .filter((r) => r.direccion && r.direccion.trim() !== '')
          .sort((a, b) => {
            const aMatch = idClienteVenta > 0 && a.idCliente === idClienteVenta ? 0 : 1;
            const bMatch = idClienteVenta > 0 && b.idCliente === idClienteVenta ? 0 : 1;
            if (aMatch !== bMatch) return aMatch - bMatch;
            const aPri = a.principal ? 0 : 1;
            const bPri = b.principal ? 0 : 1;
            if (aPri !== bPri) return aPri - bPri;
            return (a.idDireccionClientes || 0) - (b.idDireccionClientes || 0);
          })[0];
        if (elegida) {
          clienteDireccion = direccionClienteLegiblePdf(elegida.direccion.trim());
          dirLenPorRucEmpresa = clienteDireccion.length;
        }
      }
    } catch (err) {
      console.error('obtenerComprobanteParaPdf direccion por RUC fallback:', err);
    }
  }


  // Último fallback: si tras Cabecera + idCliente + RUC sigue sin dirección, extraerla del XML
  // enviado a SUNAT (ComprobantesElectronicos.xmlEnviado) y persistirla en DireccionClientes
  // para que no haya que volver a parsearla y queden corregidos los datos del cliente.
  let dirLenDesdeXml = 0;
  let xmlEncontrado = false;
  let dirPersistidaDesdeXml = false;
  let dirXmlExtraida = '';
  let xmlLen = 0;
  if (!clienteDireccion && cab.idCliente != null && idEmpresaVenta) {
    try {
      const xr = await pool
        .request()
        .input('idVenta', sql.Int, idVenta)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
        .query(`
          SELECT TOP 1 CAST(ISNULL(ce.xmlEnviado, '') AS NVARCHAR(MAX)) AS xmlEnviado
          FROM ComprobantesElectronicos ce
          WHERE ce.idVenta = @idVenta AND ce.idEmpresa = @idEmpresa
            AND NULLIF(LTRIM(RTRIM(CAST(ce.xmlEnviado AS NVARCHAR(MAX)))), '') <> ''
          ORDER BY ce.fechaEmision DESC
        `);
      const xmlRow = xr.recordset && xr.recordset[0];
      const rawXml = xmlRow ? xmlRow.xmlEnviado ?? xmlRow.XMLENVIADO : null;
      if (rawXml != null && String(rawXml).trim() !== '') {
        xmlEncontrado = true;
        xmlLen = String(rawXml).length;
        const dirXml = extraerDireccionClienteDesdeXmlUbl(String(rawXml));
        dirXmlExtraida = dirXml;
        if (dirXml) {
          clienteDireccion = direccionClienteLegiblePdf(dirXml);
          dirLenDesdeXml = clienteDireccion.length;
          try {
            await pool
              .request()
              .input('idCliente', sql.Int, Number(cab.idCliente))
              .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
              .input('direccion', sql.VarChar(255), dirXml.slice(0, 255))
              .query(`
                IF NOT EXISTS (
                  SELECT 1 FROM DireccionClientes WHERE idCliente = @idCliente AND idEmpresa = @idEmpresa
                )
                BEGIN
                  INSERT INTO DireccionClientes
                    (idEmpresa, idCliente, ubigeo, codPais, region, provincia, distrito, urbanizacion, direccion, referencia, codLocal, principal)
                  VALUES
                    (@idEmpresa, @idCliente, '', 'PE', '', '', '', '', @direccion, '', '', 1)
                END
              `);
            dirPersistidaDesdeXml = true;
          } catch (errPersist) {
            console.error('obtenerComprobanteParaPdf persistir direccion XML:', errPersist);
          }
        }
      }
    } catch (errXml) {
      console.error('obtenerComprobanteParaPdf direccion desde XML:', errXml);
    }
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

  const codLocalSunat =
    emp && (emp.codLocalSunat != null || emp.codlocalsunat != null)
      ? String(emp.codLocalSunat != null ? emp.codLocalSunat : emp.codlocalsunat).trim()
      : '0000';
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
        codLocalSunat: codLocalSunat || '0000',
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
        ubigeo: '',
        region: '',
        provincia: '',
        distrito: '',
        urbanizacion: '',
        codLocalSunat: '0000',
        telefono: '',
        rubro: '',
        correo: '',
        logo: `${base}/assets/img/01.jpg`,
        cuentasBancarias: cfgMap.PDF_CUENTAS_BANCARIAS || '',
        pdfUsarColor: String(cfgMap.PDF_TEMA_COLOR_ACTIVO || 'true').toLowerCase() !== 'false',
        pdfColorPrimario: cfgMap.PDF_COLOR_PRIMARIO || '#0B5FA5'
      };

  let tieneDespachosPdf = false;
  try {
    const rDespPdf = await pool
      .request()
      .input('idVenta', sql.Int, idVenta)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresaVenta)
      .query(`
        SELECT COUNT(*) AS n
        FROM DetalleDespachos dd
        INNER JOIN DetalleVenta dv ON dv.idDetalle = dd.idDetalleVenta
        INNER JOIN Ventas v ON v.idVenta = dv.idVenta AND v.idEmpresa = @idEmpresa
        WHERE dv.idVenta = @idVenta
      `);
    tieneDespachosPdf = Number((rDespPdf.recordset[0] || {}).n) > 0;
  } catch (_) {
    tieneDespachosPdf = false;
  }

  let tieneNotasCreditoDebitoPdf = false;
  try {
    tieneNotasCreditoDebitoPdf = await exports.ventaTieneNotasCreditoDebito(
      pool,
      idEmpresaVenta,
      cab.compVenta != null ? String(cab.compVenta).trim() : ''
    );
  } catch (_) {
    tieneNotasCreditoDebitoPdf = false;
  }

  let detallePagoPdf = [];
  try {
    const dpv = await pool
      .request()
      .input('idVenta', sql.Int, idVenta)
      .query(`
        SELECT idMediosPago, monto
        FROM DetallePagoVenta
        WHERE idVenta = @idVenta
        ORDER BY idMediosPago
      `);
    detallePagoPdf = (dpv.recordset || []).map((r) => ({
      idMediosPago: r.idMediosPago != null ? Number(r.idMediosPago) : null,
      monto: r.monto != null ? Number(r.monto) : 0
    })).filter((x) => x.idMediosPago != null && !Number.isNaN(x.idMediosPago));
  } catch (_) {
    detallePagoPdf = [];
  }

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
      eliminado: !!cab.eliminado,
      tieneDespachos: tieneDespachosPdf,
      tieneNotasCreditoDebito: tieneNotasCreditoDebitoPdf,
      idMediosPago:
        cab.idMediosPago != null && cab.idMediosPago !== ''
          ? typeof cab.idMediosPago === 'number'
            ? cab.idMediosPago
            : String(cab.idMediosPago).trim()
          : null,
      idEstadoPago: cab.idEstadoPago != null ? Number(cab.idEstadoPago) : null,
      usuarioRegistro: cab.usuarioRegistro != null ? String(cab.usuarioRegistro).trim() : '',
      usuarioModifica: cab.usuarioModifica != null ? String(cab.usuarioModifica).trim() : '',
      fModificacion: cab.fModificacion != null ? String(cab.fModificacion).trim() : null
    },
    empresa: empresaPayload,
    cliente: {
      rSocial: cab.clienteRazonSocial,
      razonSocial: cab.clienteRazonSocial,
      ruc: cab.clienteRuc,
      celular: (cab.clienteCelular != null && String(cab.clienteCelular).trim() !== '') ? String(cab.clienteCelular).trim() : '',
      direccion: direccionClienteLegiblePdf(clienteDireccion),
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
      total: d.total,
      presentacion: d.presentacion != null ? String(d.presentacion).trim() : '',
      presentacionCodigo: d.presentacionCodigo != null ? String(d.presentacionCodigo).trim() : '',
      marca: d.marca != null ? String(d.marca).trim() : ''
    })),
    impuestos,
    detallePago: detallePagoPdf
  };
};

/** True si hay líneas de despacho ligadas al detalle de esta venta (bloquea edición de comprobante). */
exports.ventaTieneDespachos = async (pool, idVenta, idEmpresa) => {
  const r = await pool
    .request()
    .input('idVenta', sql.Int, idVenta)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS n
      FROM DetalleDespachos dd
      INNER JOIN DetalleVenta dv ON dv.idDetalle = dd.idDetalleVenta
      INNER JOIN Ventas v ON v.idVenta = dv.idVenta AND v.idEmpresa = @idEmpresa
      WHERE dv.idVenta = @idVenta
    `);
  return Number((r.recordset[0] || {}).n) > 0;
};

/** True si existe una venta NC/ND no anulada cuyo compRelacionado coincide con el comprobante origen (serie-número). */
exports.ventaTieneNotasCreditoDebito = async (pool, idEmpresa, compVenta) => {
  const cv = compVenta != null ? String(compVenta).trim() : '';
  if (!cv) return false;
  const compRel = cv.length > 30 ? cv.slice(0, 30) : cv;
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('compRel', sql.VarChar(30), compRel)
    .query(`
      SELECT COUNT(*) AS n
      FROM Ventas vnc
      INNER JOIN Comprobantes c2 ON c2.idComprobante = vnc.idComprobante AND c2.idEmpresa = vnc.idEmpresa
      WHERE vnc.idEmpresa = @idEmpresa
        AND ISNULL(vnc.eliminado, 0) = 0
        AND UPPER(LTRIM(RTRIM(ISNULL(c2.codigo, '')))) IN ('B7', 'F7', 'B8', 'F8', '07', '08')
        AND RTRIM(LTRIM(UPPER(ISNULL(vnc.compRelacionado, '')))) = RTRIM(LTRIM(UPPER(@compRel)))
    `);
  return Number((r.recordset[0] || {}).n) > 0;
};

/** Actualiza cabecera y detalle de una venta. Solo permitir cuando idEstadoSunat no sea Aceptado (1,2,3). Cotización (CT): solo dentro de 24 h de emisión.
 * Si hay despachos registrados, no se edita (falla antes o aquí). Con despachos = 0, sincroniza stock ante cambios de cantidad/producto.
 * @param {{ idUsuarioEjecutor?: string|null, detallePago?: Array<{ idMediosPago?: number, monto?: number }> }} [opciones]
 */
exports.actualizarVentaCompleta = async (pool, idVenta, idEmpresa, cabecera, detalles, opciones = {}) => {
  const { idUsuarioEjecutor = null, detallePago: detallePagoOpcional = null } = opciones || {};
  const stockRepository = require('./stock.repository');
  const inventarioRepository = require('./inventario.repository');
  const stockService = require('../services/stock.service');
  const productoInventarioMetaService = require('../services/productoInventarioMeta.service');
  const gestoresRepository = require('./gestores.repository');

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const tieneDirVentasCol = await ventasTieneColumnaIdDireccionClientes(transaction);

    const chk = await transaction.request()
      .input('idVenta', sql.Int, idVenta)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT ISNULL(v.eliminado, 0) AS eliminado, v.idEstadoSunat, c.codigo AS codigoComprobante,
          CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
          v.idSucursal, v.compVenta, v.idComprobante, v.idUsuario,
          ISNULL(v.total, 0) AS totalAnterior, v.idEstadoPago, v.idVentaAgrupada
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
    /** Cotización (CT): no mover lotes ni movimientos de inventario al editar. */
    const sincronizarStockEdicion = codComp !== 'CT';
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
    let idSucursal = rowChk.idSucursal;
    if (!idSucursal) {
      const rsSuc = await transaction
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          SELECT TOP 1 idSucursal FROM Sucursal
          WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
          ORDER BY CASE WHEN ISNULL(esPrincipal, 0) = 1 THEN 0 ELSE 1 END, fregistro ASC
        `);
      idSucursal = rsSuc.recordset && rsSuc.recordset[0] && rsSuc.recordset[0].idSucursal;
    }
    if (!idSucursal) {
      await transaction.rollback();
      return { ok: false, error: 'No se pudo determinar la sucursal de la venta para ajustar stock.' };
    }
    const compVenta = rowChk.compVenta != null ? String(rowChk.compVenta).trim() : '';
    const idComprobanteCab = rowChk.idComprobante;
    const idUsuarioMov = idUsuarioEjecutor || rowChk.idUsuario;
    const totalAnteriorCab = Number(rowChk.totalAnterior) || 0;
    const idEstadoPagoInicial = rowChk.idEstadoPago != null ? Number(rowChk.idEstadoPago) : 1;
    const idVentaAgrupadaCab = rowChk.idVentaAgrupada;

    const rsDespN0 = await transaction.request().input('idVenta', sql.Int, idVenta).query(`
      SELECT COUNT(*) AS n
      FROM DetalleDespachos dd
      INNER JOIN DetalleVenta dv ON dv.idDetalle = dd.idDetalleVenta
      WHERE dv.idVenta = @idVenta
    `);
    if (Number((rsDespN0.recordset[0] || {}).n) > 0) {
      await transaction.rollback();
      return { ok: false, error: 'No se puede editar: el comprobante tiene despachos registrados.' };
    }
    if (await exports.ventaTieneNotasCreditoDebito(pool, idEmpresa, compVenta)) {
      await transaction.rollback();
      return {
        ok: false,
        error: 'No se puede editar: existen notas de crédito o débito vinculadas a este comprobante.'
      };
    }

    const fEmisionRaw = cabecera.fEmision || null;
    let fEmision = parseFEmisionCabeceraSQL(fEmisionRaw);
    if (fEmision && (codComp === 'NV' || codComp === 'CT') && rowChk.fEmision != null) {
      fEmision = mergeFEmisionNvCtSiMedianocheInnecessario(fEmision, rowChk.fEmision);
    }
    const idCliente = cabecera.idCliente != null ? Number(cabecera.idCliente) : null;
    const subtotal = Number(cabecera.subtotal) || 0;
    const igv = Number(cabecera.igv) || 0;
    const exonerado = Number(cabecera.exonerado) || 0;
    const gratuito = Number(cabecera.gratuito) || 0;
    const otrosCargos = Number(cabecera.otrosCargos) || 0;
    const descuentos = Number(cabecera.descuentos) || 0;
    const total = Number(cabecera.total) || 0;

    const reqUp = transaction
      .request()
      .input('idVenta', sql.Int, idVenta)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('fEmision', sql.VarChar(23), fEmision)
      .input('subtotal', sql.Decimal(18, 2), subtotal)
      .input('igv', sql.Decimal(18, 2), igv)
      .input('exonerado', sql.Decimal(18, 2), exonerado)
      .input('gratuito', sql.Decimal(18, 2), gratuito)
      .input('otrosCargos', sql.Decimal(18, 2), otrosCargos)
      .input('descuentos', sql.Decimal(18, 2), descuentos)
      .input('total', sql.Decimal(18, 2), total);

    const setParts = [
      'fEmision = @fEmision',
      'subtotal = @subtotal',
      'igv = @igv',
      'exonerado = @exonerado',
      'gratuito = @gratuito',
      'otrosCargos = @otrosCargos',
      'descuentos = @descuentos',
      'total = @total'
    ];
    if (idCliente != null && idCliente > 0) {
      reqUp.input('idCliente', sql.Int, idCliente);
      setParts.splice(1, 0, 'idCliente = @idCliente');
    }
    if (tieneDirVentasCol && Object.prototype.hasOwnProperty.call(cabecera, 'idDireccionClientes')) {
      const idDirV =
        cabecera.idDireccionClientes != null &&
        cabecera.idDireccionClientes !== '' &&
        Number(cabecera.idDireccionClientes) > 0
          ? Number(cabecera.idDireccionClientes)
          : null;
      reqUp.input('idDireccionClientes', sql.Int, idDirV);
      setParts.push('idDireccionClientes = @idDireccionClientes');
    }

    await reqUp.query(
      `UPDATE Ventas SET ${setParts.join(', ')} WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa`
    );

    if (idUsuarioEjecutor) {
      await transaction
        .request()
        .input('idVenta', sql.Int, idVenta)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idUsuarioModifica', sql.UniqueIdentifier, idUsuarioEjecutor)
        .query(`
          UPDATE Ventas
          SET idUsuarioModifica = @idUsuarioModifica, fModificacion = GETDATE()
          WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
        `);
    }

    const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa);
    const getConfig = crearLectorConfiguracionEmpresa(configRows);
    const permitirVentasNegativas = leerPermitirVentasNegativas(getConfig);
    const controlUbicaciones = interpretarBooleanoConfig(getConfig('INVENTARIO_CONTROL_UBICACIONES', 'true'), true);

    const EPS_Q = 0.0001;

    const restauraY_MOV_EN = async (idProductoRestore, cantRestore, costoU) => {
      if (!sincronizarStockEdicion) return;
      const cant = parseFloat(cantRestore) || 0;
      if (cant <= 0 || !idProductoRestore) return;
      const meta = await productoInventarioMetaService.obtenerMeta(
        transaction,
        idEmpresa,
        idProductoRestore
      );
      if (!meta.controlaInventario) return;
      await stockRepository.restaurarStockEnLotes(transaction, {
        idEmpresa,
        idSucursal,
        idProducto: idProductoRestore,
        cantidad: cant
      });
      if (idUsuarioMov) {
        await inventarioRepository.insertarFilaMovimiento(transaction, {
          idEmpresa,
          idSucursal,
          idProducto: idProductoRestore,
          tipoMovimiento: 'EN',
          cantidad: cant,
          docRelacionado: compVenta,
          idComprobante: idComprobanteCab,
          idUsuario: idUsuarioMov,
          observaciones: 'Edición de venta — devolución de stock',
          costoUnitario: costoU != null ? Number(costoU) : 0,
          idLote: null
        });
      }
    };

    const descuentoVacioRet = (costoFallback) => ({
      costoTotalDescontado: 0,
      cantidadDescontada: 0,
      costoUnitarioProm: Number(costoFallback) || 0
    });

    const descuentaY_MOV_SA = async (idProductoDesc, cantPedida, costoFallback) => {
      if (!sincronizarStockEdicion) return descuentoVacioRet(costoFallback);
      const cantPed = parseFloat(cantPedida) || 0;
      if (cantPed <= 0 || !idProductoDesc) return descuentoVacioRet(costoFallback);

      const meta = await productoInventarioMetaService.obtenerMeta(transaction, idEmpresa, idProductoDesc);
      if (!meta.controlaInventario) {
        const costoU = meta.cUnitario;
        return {
          costoTotalDescontado: cantPed * costoU,
          cantidadDescontada: 0,
          costoUnitarioProm: costoU
        };
      }

      const stockDisponible = await stockService.obtenerStockDisponible(transaction, idEmpresa, idProductoDesc, idSucursal);
      if (!permitirVentasNegativas && stockDisponible + EPS_Q < cantPed) {
        throw new Error(
          `Stock insuficiente al guardar la edición. Disponible: ${stockDisponible}, solicitado: ${cantPed}.`
        );
      }
      const cantidadADescontar = cantPed;
      if (cantidadADescontar <= 0) return descuentoVacioRet(costoFallback);
      const resultadoDescuento = await stockService.descontarDesdeLotes(
        transaction,
        {
          idEmpresa,
          idSucursal,
          idProducto: idProductoDesc,
          cantidad: cantidadADescontar
        },
        { controlUbicaciones, permitirVentasNegativas }
      );
      const consumosPorLote = resultadoDescuento?.consumosPorLote || [];
      const costoTotalLinea = Array.isArray(consumosPorLote)
        ? consumosPorLote.reduce(
            (acc, c) => acc + (Number(c.cantidadTomada) || 0) * (Number(c.costoUnitario) || 0),
            0
          )
        : 0;
      const costoUnitarioProm =
        cantidadADescontar > 0 ? costoTotalLinea / cantidadADescontar : Number(costoFallback) || 0;
      if (cantidadADescontar > 0 && idUsuarioMov) {
        if (Array.isArray(consumosPorLote) && consumosPorLote.length > 0) {
          for (const c of consumosPorLote) {
            const cantTomada = Number(c.cantidadTomada) || 0;
            if (cantTomada <= 0) continue;
            await inventarioRepository.insertarFilaMovimiento(transaction, {
              idEmpresa,
              idSucursal,
              idProducto: idProductoDesc,
              tipoMovimiento: 'SA',
              cantidad: cantTomada,
              docRelacionado: compVenta,
              idComprobante: idComprobanteCab,
              idUsuario: idUsuarioMov,
              observaciones: 'Edición de venta — salida de stock',
              costoUnitario: c.costoUnitario != null ? Number(c.costoUnitario) : costoUnitarioProm,
              idLote: c.idLote || null
            });
          }
        } else {
          await inventarioRepository.insertarFilaMovimiento(transaction, {
            idEmpresa,
            idSucursal,
            idProducto: idProductoDesc,
            tipoMovimiento: 'SA',
            cantidad: cantidadADescontar,
            docRelacionado: compVenta,
            idComprobante: idComprobanteCab,
            idUsuario: idUsuarioMov,
            observaciones: 'Edición de venta — salida de stock',
            costoUnitario: costoUnitarioProm,
            idLote: null
          });
        }
      }
      return {
        costoTotalDescontado: costoTotalLinea,
        cantidadDescontada: cantidadADescontar,
        costoUnitarioProm
      };
    };

    const rsExist = await transaction.request().input('idVenta', sql.Int, idVenta).query(`
      SELECT idDetalle, idProducto, cantidad, ISNULL(costoUnitario, 0) AS costoUnitario, ISNULL(costoTotal, 0) AS costoTotal
      FROM DetalleVenta WHERE idVenta = @idVenta
    `);
    const detalleInicialPorId = new Map(
      (rsExist.recordset || []).map((r) => [
        Number(r.idDetalle),
        {
          idProducto: r.idProducto,
          cantidad: Number(r.cantidad) || 0,
          costoUnitario: Number(r.costoUnitario) || 0,
          costoTotal: Number(r.costoTotal) || 0
        }
      ])
    );

    const idsDetalleEnPayload = new Set();
    for (const d of detalles) {
      const idDet = d.idDetalle != null ? parseInt(String(d.idDetalle), 10) : NaN;
      if (Number.isInteger(idDet) && idDet > 0) idsDetalleEnPayload.add(idDet);
    }

    for (const [idDet, oldRow] of detalleInicialPorId) {
      if (!idsDetalleEnPayload.has(idDet)) {
        await restauraY_MOV_EN(oldRow.idProducto, oldRow.cantidad, oldRow.costoUnitario);
      }
    }

    for (const d of detalles) {
      const idDetallePayload0 = d.idDetalle != null ? parseInt(String(d.idDetalle), 10) : NaN;
      const idEx0 =
        Number.isInteger(idDetallePayload0) && idDetallePayload0 > 0 && detalleInicialPorId.has(idDetallePayload0)
          ? idDetallePayload0
          : null;
      if (idEx0 == null) continue;
      const oldRow0 = detalleInicialPorId.get(idEx0);
      const newQty0 = Number(d.cantidad) || 0;
      const newProd0 = d.idProducto;
      const sameProd0 =
        oldRow0 &&
        newProd0 &&
        String(oldRow0.idProducto).toLowerCase() === String(newProd0).toLowerCase();
      if (!sameProd0) {
        await restauraY_MOV_EN(oldRow0.idProducto, oldRow0.cantidad, oldRow0.costoUnitario);
      } else if (newQty0 + EPS_Q < oldRow0.cantidad) {
        await restauraY_MOV_EN(oldRow0.idProducto, oldRow0.cantidad - newQty0, oldRow0.costoUnitario);
      }
    }

    for (const idDet of detalleInicialPorId.keys()) {
      if (!idsDetalleEnPayload.has(idDet)) {
        await transaction
          .request()
          .input('idDetalle', sql.Int, idDet)
          .input('idVenta', sql.Int, idVenta)
          .query('DELETE FROM DetalleVenta WHERE idDetalle = @idDetalle AND idVenta = @idVenta');
      }
    }

    for (const d of detalles) {
      const idProducto = d.idProducto;
      const cantidad = Number(d.cantidad) || 0;
      const pVenta = Number(d.pVenta) || 0;
      const descuento = Number(d.descuento) || 0;
      const subtotalItem =
        d.subtotal != null && d.subtotal !== '' && Number.isFinite(Number(d.subtotal))
          ? Number(d.subtotal)
          : cantidad * pVenta;
      const totalItem =
        d.total != null && d.total !== '' && Number.isFinite(Number(d.total))
          ? Number(d.total)
          : subtotalItem;
      let igv = 0;
      if (d.igv != null) {
        igv = d.igv ? 1 : 0;
      } else if (totalItem > subtotalItem + 0.001) {
        igv = 1;
      }
      const isc = d.isc != null ? (d.isc ? 1 : 0) : 0;
      const idDetallePayload = d.idDetalle != null ? parseInt(String(d.idDetalle), 10) : NaN;
      const idDetalleExistente =
        Number.isInteger(idDetallePayload) && idDetallePayload > 0 && detalleInicialPorId.has(idDetallePayload)
          ? idDetallePayload
          : null;
      const oldRowFull = idDetalleExistente ? detalleInicialPorId.get(idDetalleExistente) : null;
      const oldQtyLine = oldRowFull ? Number(oldRowFull.cantidad) || 0 : 0;
      const sameProdLine =
        oldRowFull &&
        idProducto &&
        String(oldRowFull.idProducto).toLowerCase() === String(idProducto).toLowerCase();
      const priceOnlyLine =
        idDetalleExistente && oldRowFull && sameProdLine && Math.abs(cantidad - oldQtyLine) < EPS_Q;
      const qtyDecreaseLine =
        idDetalleExistente && oldRowFull && sameProdLine && cantidad + EPS_Q < oldQtyLine && oldQtyLine > EPS_Q;

      let costoUnitario = Number(d.costoUnitario) || 0;
      let costoTotal = Number(d.costoTotal) || 0;
      const rawLinea = d.descripcionLinea != null ? d.descripcionLinea : d.descripcionVenta;
      let descripcionLineaIns = null;
      if (rawLinea != null) {
        const t = String(rawLinea).trim();
        descripcionLineaIns = t ? (t.length > 500 ? t.slice(0, 500) : t) : null;
      }
      if (priceOnlyLine && oldRowFull) {
        costoUnitario = Number(oldRowFull.costoUnitario) || 0;
        costoTotal = Number(oldRowFull.costoTotal) || 0;
      } else if (qtyDecreaseLine && oldRowFull) {
        const ratio = cantidad / oldQtyLine;
        costoTotal = (Number(oldRowFull.costoTotal) || 0) * ratio;
        costoUnitario = cantidad > EPS_Q ? costoTotal / cantidad : 0;
      } else if (sincronizarStockEdicion && costoTotal === 0 && cantidad > 0) {
        const metaCosto = await productoInventarioMetaService.obtenerMeta(transaction, idEmpresa, idProducto);
        if (!metaCosto.controlaInventario) {
          costoUnitario = metaCosto.cUnitario;
          costoTotal = cantidad * costoUnitario;
        } else {
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
        }
      } else if (costoTotal > 0 && costoUnitario === 0 && cantidad > 0) {
        costoUnitario = costoTotal / cantidad;
      }

      if (idDetalleExistente != null) {
        const upd = await transaction
          .request()
          .input('idVenta', sql.Int, idVenta)
          .input('idDetalle', sql.Int, idDetalleExistente)
          .input('idProducto', sql.UniqueIdentifier, idProducto)
          .input('cantidad', sql.Decimal(18, 3), cantidad)
          .input('pVenta', sql.Decimal(18, 5), pVenta)
          .input('descuento', sql.Decimal(18, 2), descuento)
          .input('subtotal', sql.Decimal(18, 2), subtotalItem)
          .input('igv', sql.Bit, igv)
          .input('isc', sql.Bit, isc)
          .input('total', sql.Decimal(18, 2), totalItem)
          .input('idEstadoPedido', sql.Int, 1)
          .input('costoUnitario', sql.Decimal(18, 6), costoUnitario)
          .input('costoTotal', sql.Decimal(18, 6), costoTotal)
          .input('descripcionLinea', sql.NVarChar(500), descripcionLineaIns)
          .query(`
            UPDATE DetalleVenta SET
              idProducto = @idProducto,
              cantidad = @cantidad,
              pVenta = @pVenta,
              descuento = @descuento,
              subtotal = @subtotal,
              igv = @igv,
              isc = @isc,
              total = @total,
              idEstadoPedido = @idEstadoPedido,
              costoUnitario = @costoUnitario,
              costoTotal = @costoTotal,
              descripcionLinea = @descripcionLinea,
              cantEntregada = 0
            WHERE idVenta = @idVenta AND idDetalle = @idDetalle
          `);
        const nAfectadas = Number(Array.isArray(upd.rowsAffected) ? upd.rowsAffected[0] : upd.rowsAffected) || 0;
        if (nAfectadas > 0) {
          const oldRow = detalleInicialPorId.get(idDetalleExistente);
          if (oldRow) {
            const oldQty = Number(oldRow.cantidad) || 0;
            const sameProd =
              oldRow.idProducto &&
              idProducto &&
              String(oldRow.idProducto).toLowerCase() === String(idProducto).toLowerCase();
            let retDesc = descuentoVacioRet(costoUnitario);
            if (!sameProd) {
              retDesc = await descuentaY_MOV_SA(idProducto, cantidad, costoUnitario);
            } else if (cantidad > oldQty + EPS_Q) {
              retDesc = await descuentaY_MOV_SA(idProducto, cantidad - oldQty, costoUnitario);
            }
            if (!sameProd || cantidad > oldQty + EPS_Q) {
              const oldCT0 = Number(oldRow.costoTotal) || 0;
              let costoTn;
              let costoUn;
              if (!sameProd) {
                costoTn = retDesc.costoTotalDescontado;
                costoUn = cantidad > EPS_Q ? costoTn / cantidad : 0;
              } else {
                costoTn = oldCT0 + retDesc.costoTotalDescontado;
                costoUn = cantidad > EPS_Q ? costoTn / cantidad : 0;
              }
              await transaction
                .request()
                .input('idDetalle', sql.Int, idDetalleExistente)
                .input('cu', sql.Decimal(18, 6), costoUn)
                .input('ct', sql.Decimal(18, 6), costoTn)
                .query('UPDATE DetalleVenta SET costoUnitario = @cu, costoTotal = @ct WHERE idDetalle = @idDetalle');
            }
          }
          continue;
        }
      }

      const insRes = await transaction
        .request()
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
          OUTPUT INSERTED.idDetalle AS idDetalle
          VALUES (@idVenta, @idProducto, @cantidad, @pVenta, @descuento, @subtotal, @igv, @isc, @total, @cantEntregada, @idEstadoPedido, @costoUnitario, @costoTotal, @descripcionLinea)
        `);
      const newIdDetalle = insRes.recordset && insRes.recordset[0] && insRes.recordset[0].idDetalle;
      const retIns = await descuentaY_MOV_SA(idProducto, cantidad, costoUnitario);
      if (newIdDetalle != null && (retIns.costoTotalDescontado > EPS_Q || cantidad > EPS_Q)) {
        const ctN = retIns.costoTotalDescontado || 0;
        const cuN = cantidad > EPS_Q ? ctN / cantidad : 0;
        await transaction
          .request()
          .input('idDetalle', sql.Int, newIdDetalle)
          .input('cu', sql.Decimal(18, 6), cuN)
          .input('ct', sql.Decimal(18, 6), ctN)
          .query('UPDATE DetalleVenta SET costoUnitario = @cu, costoTotal = @ct WHERE idDetalle = @idDetalle');
      }
    }

    const newTotalFinal = Number(total) || 0;
    if (idEstadoPagoInicial === 2 && totalAnteriorCab > 0.01 && Math.abs(newTotalFinal - totalAnteriorCab) > 0.009) {
      const factorPago = newTotalFinal / totalAnteriorCab;
      const sumDpvAntes = await transaction
        .request()
        .input('idVenta', sql.Int, idVenta)
        .query(`SELECT ISNULL(SUM(monto), 0) AS s FROM DetallePagoVenta WHERE idVenta = @idVenta`);
      const sDpvAntes = Number((sumDpvAntes.recordset[0] || {}).s) || 0;
      if (sDpvAntes > 0.01 && Math.abs(sDpvAntes - totalAnteriorCab) < 0.05) {
        await transaction
          .request()
          .input('idVenta', sql.Int, idVenta)
          .input('factor', sql.Decimal(18, 8), factorPago)
          .query(`UPDATE DetallePagoVenta SET monto = ROUND(monto * @factor, 2) WHERE idVenta = @idVenta`);
        const sumDpvDesp = await transaction
          .request()
          .input('idVenta', sql.Int, idVenta)
          .query(`SELECT ISNULL(SUM(monto), 0) AS s FROM DetallePagoVenta WHERE idVenta = @idVenta`);
        const sDpvDesp = Number((sumDpvDesp.recordset[0] || {}).s) || 0;
        const driftDpv = Math.round((newTotalFinal - sDpvDesp) * 100) / 100;
        if (Math.abs(driftDpv) >= 0.01) {
          await transaction
            .request()
            .input('idVenta', sql.Int, idVenta)
            .input('drift', sql.Decimal(18, 2), driftDpv)
            .query(`
              UPDATE TOP (1) DetallePagoVenta SET monto = monto + @drift
              WHERE idVenta = @idVenta
            `);
        }
      }
      const sumMcAntes = await transaction
        .request()
        .input('idVenta', sql.Int, idVenta)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          SELECT ISNULL(SUM(mc.monto), 0) AS s
          FROM MovimientosCaja mc
          INNER JOIN TiposMovimientoCaja t ON t.idTipoMovimientoCaja = mc.idTipoMovimientoCaja
          WHERE mc.idVenta = @idVenta AND mc.idEmpresa = @idEmpresa AND t.nombre = 'VENTA_CONTADO'
        `);
      const sMcAntes = Number((sumMcAntes.recordset[0] || {}).s) || 0;
      if (sMcAntes > 0.01 && Math.abs(sMcAntes - totalAnteriorCab) < 0.05) {
        await transaction
          .request()
          .input('idVenta', sql.Int, idVenta)
          .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
          .input('factor', sql.Decimal(18, 8), factorPago)
          .query(`
            UPDATE mc SET mc.monto = ROUND(mc.monto * @factor, 2)
            FROM MovimientosCaja mc
            INNER JOIN TiposMovimientoCaja t ON t.idTipoMovimientoCaja = mc.idTipoMovimientoCaja
            WHERE mc.idVenta = @idVenta AND mc.idEmpresa = @idEmpresa AND t.nombre = 'VENTA_CONTADO'
          `);
        const sumMcDesp = await transaction
          .request()
          .input('idVenta', sql.Int, idVenta)
          .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
          .query(`
            SELECT ISNULL(SUM(mc.monto), 0) AS s
            FROM MovimientosCaja mc
            INNER JOIN TiposMovimientoCaja t ON t.idTipoMovimientoCaja = mc.idTipoMovimientoCaja
            WHERE mc.idVenta = @idVenta AND mc.idEmpresa = @idEmpresa AND t.nombre = 'VENTA_CONTADO'
          `);
        const sMcDesp = Number((sumMcDesp.recordset[0] || {}).s) || 0;
        const driftMc = Math.round((newTotalFinal - sMcDesp) * 100) / 100;
        if (Math.abs(driftMc) >= 0.01) {
          const rTopMc = await transaction
            .request()
            .input('idVenta', sql.Int, idVenta)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
              SELECT TOP 1 mc.idMovimientoCaja
              FROM MovimientosCaja mc
              INNER JOIN TiposMovimientoCaja t ON t.idTipoMovimientoCaja = mc.idTipoMovimientoCaja
              WHERE mc.idVenta = @idVenta AND mc.idEmpresa = @idEmpresa AND t.nombre = 'VENTA_CONTADO'
              ORDER BY mc.idMovimientoCaja ASC
            `);
          const idMcAdj = rTopMc.recordset && rTopMc.recordset[0] && rTopMc.recordset[0].idMovimientoCaja;
          if (idMcAdj != null) {
            await transaction
              .request()
              .input('idMc', sql.Int, idMcAdj)
              .input('drift', sql.Decimal(18, 2), driftMc)
              .query(`UPDATE MovimientosCaja SET monto = monto + @drift WHERE idMovimientoCaja = @idMc`);
          }
        }
      }
    }

    if (idVentaAgrupadaCab) {
      const rVe = await transaction
        .request()
        .input('idVenta', sql.Int, idVenta)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          SELECT ve.idVentaEmpresa
          FROM VentaEmpresa ve
          WHERE ve.idVenta = @idVenta AND ve.idEmpresa = @idEmpresa AND ISNULL(ve.eliminado, 0) = 0
        `);
      const idVeRow = rVe.recordset && rVe.recordset[0];
      if (idVeRow && idVeRow.idVentaEmpresa) {
        const idVE = idVeRow.idVentaEmpresa;
        const idVA = idVentaAgrupadaCab;
        await transaction
          .request()
          .input('idVE', sql.UniqueIdentifier, idVE)
          .input('subtotal', sql.Decimal(18, 2), subtotal)
          .input('igv', sql.Decimal(18, 2), igv)
          .input('exonerado', sql.Decimal(18, 2), exonerado)
          .input('gratuito', sql.Decimal(18, 2), gratuito)
          .input('otrosCargos', sql.Decimal(18, 2), otrosCargos)
          .input('descuentos', sql.Decimal(18, 2), descuentos)
          .input('total', sql.Decimal(18, 2), total)
          .input('fEmision', sql.VarChar(23), fEmision)
          .query(`
            UPDATE VentaEmpresa SET
              subtotal = @subtotal, igv = @igv, exonerado = @exonerado, gratuito = @gratuito,
              otrosCargos = @otrosCargos, descuentos = @descuentos, total = @total,
              fEmision = CAST(@fEmision AS DATETIME),
              fVencimiento = CAST(@fEmision AS DATETIME)
            WHERE idVentaEmpresa = @idVE
          `);
        await transaction
          .request()
          .input('idVE', sql.UniqueIdentifier, idVE)
          .query(`DELETE FROM DetalleVentaEmpresa WHERE idVentaEmpresa = @idVE`);
        await transaction
          .request()
          .input('idVE', sql.UniqueIdentifier, idVE)
          .input('idVenta', sql.Int, idVenta)
          .query(`
            INSERT INTO DetalleVentaEmpresa (
              idVentaEmpresa, idProducto, cantidad, pVenta, descuento, subtotal, igv, isc, total,
              cantEntregada, idEstadoPedido, costoUnitario, costoTotal
            )
            SELECT @idVE, dv.idProducto, dv.cantidad, dv.pVenta, dv.descuento, dv.subtotal, dv.igv, dv.isc, dv.total,
              dv.cantEntregada, dv.idEstadoPedido, dv.costoUnitario, dv.costoTotal
            FROM DetalleVenta dv WHERE dv.idVenta = @idVenta
          `);
        await recalcularVentaAgrupadaDesdeHijas(transaction, idVA);
      }
    }

    if (Array.isArray(detallePagoOpcional) && detallePagoOpcional.length > 0) {
      const { normalizarDetallePagoIdMediosPago } = require('../utils/detallePagoNormalizar.util');
      const detalleNorm = await normalizarDetallePagoIdMediosPago(transaction, detallePagoOpcional);
      const sumPago = detalleNorm.reduce((s, p) => s + (Number(p.monto) || 0), 0);
      if (sumPago <= 0.009) {
        await transaction.rollback();
        return { ok: false, error: 'El detalle de pago debe tener montos mayores a cero.' };
      }
      await transaction
        .request()
        .input('idVenta', sql.Int, idVenta)
        .query('DELETE FROM DetallePagoVenta WHERE idVenta = @idVenta');
      await exports.insertarDetallePagoVenta(transaction, idVenta, detalleNorm);
      const idMediosPrimero =
        detalleNorm[0] && detalleNorm[0].idMediosPago != null ? String(detalleNorm[0].idMediosPago) : null;
      let idEstadoPagoNuevo = sumPago + 0.02 >= newTotalFinal ? 2 : 1;
      try {
        const ventaCreditoPostVentaService = require('../services/ventaCreditoPostVenta.service');
        const idsCred = await ventaCreditoPostVentaService.idsMediosPagoCredito(transaction);
        if (detalleNorm.some((p) => idsCred.has(Number(p.idMediosPago)))) {
          idEstadoPagoNuevo = 2;
        }
      } catch (e) {
        console.error('contexto: ids crédito al actualizar detalle pago venta:', e.message);
      }
      const idMpCab =
        idMediosPrimero != null && String(idMediosPrimero).trim() !== '' ? String(idMediosPrimero).trim() : '1';
      await transaction
        .request()
        .input('idVenta', sql.Int, idVenta)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idMediosPago', sql.VarChar(20), idMpCab)
        .input('idEstadoPago', sql.Int, idEstadoPagoNuevo)
        .query(`
          UPDATE Ventas
          SET idMediosPago = @idMediosPago, idEstadoPago = @idEstadoPago
          WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
        `);

      /** Arqueo: MovimientosCaja (VENTA_CONTADO) deben coincidir con el desglose al contado; cotización (CT) no usa caja. */
      if (codComp !== 'CT') {
        const CajaRepository = require('../repositories/caja.repository');
        const ventaCreditoPostVentaService = require('../services/ventaCreditoPostVenta.service');
        let idsCredMc;
        try {
          idsCredMc = await ventaCreditoPostVentaService.idsMediosPagoCredito(transaction);
        } catch (e) {
          console.error('contexto: ids crédito al sincronizar caja tras edición de pago:', e.message);
          idsCredMc = new Set();
        }
        const detalleCajaSync = detalleNorm.filter((p) => !idsCredMc.has(Number(p.idMediosPago)));
        const idUsuarioCajaRaw = idUsuarioMov || idUsuarioEjecutor || rowChk.idUsuario;
        const sumCaja = detalleCajaSync.reduce((s, p) => s + (Number(p.monto) || 0), 0);
        if (sumCaja > 0.009) {
          if (!idUsuarioCajaRaw) {
            await transaction.rollback();
            return {
              ok: false,
              error:
                'No se pudo reflejar el pago en caja: falta usuario de la operación (token o venta). Vuelva a iniciar sesión e intente de nuevo.'
            };
          }
          let apRow = await CajaRepository.obtenerAperturaAbiertaPorSucursalRepo(pool, idEmpresa, idSucursal);
          let idAperturaCaja = apRow && apRow.idApertura ? apRow.idApertura : null;
          let idSucursalCaja = (apRow && apRow.idSucursal) || idSucursal;
          if (!idAperturaCaja) {
            const cualq = await CajaRepository.obtenerCualquierAperturaAbiertaRepo(pool, idEmpresa);
            if (cualq && cualq.idApertura) {
              idAperturaCaja = cualq.idApertura;
              idSucursalCaja = cualq.idSucursal || idSucursal;
            }
          }
          if (!idAperturaCaja) {
            await transaction.rollback();
            return {
              ok: false,
              error:
                'No hay caja abierta para registrar el cambio de formas de pago al contado. Abra caja en la sucursal e intente guardar de nuevo.'
            };
          }
          await CajaRepository.registrarMovimientosVentaContadoRepo(transaction, {
            idApertura: idAperturaCaja,
            idEmpresa,
            idSucursal: idSucursalCaja,
            idUsuario: idUsuarioCajaRaw,
            idVenta,
            compVenta: compVenta || 'S/N',
            detallePago: detalleCajaSync,
            fechaMovimiento: rowChk.fEmision || null
          });
        } else {
          await transaction
            .request()
            .input('idVenta', sql.Int, idVenta)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('DELETE FROM MovimientosCaja WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa');
        }
      }
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
    AND UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) NOT IN ('F7','B7','F8','B8','07','08')
    AND NOT (
      UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('01', '03')
      AND (
        RTRIM(LTRIM(ISNULL(mp.codigo, ''))) IN ('010', '10')
        OR (
          (LOWER(ISNULL(mp.descripcion, '')) LIKE '%credito%' OR LOWER(ISNULL(mp.descripcion, '')) LIKE N'%crédito%')
          AND LOWER(ISNULL(mp.descripcion, '')) NOT LIKE '%tarjeta%'
        )
      )
    )
    AND (
      v.total - ISNULL((
        SELECT SUM(vnc.total)
        FROM Ventas vnc
        INNER JOIN Comprobantes cnc ON cnc.idComprobante = vnc.idComprobante AND cnc.idEmpresa = vnc.idEmpresa
        INNER JOIN ComprobantesElectronicos ce ON ce.idVenta = vnc.idVenta AND ce.idEmpresa = vnc.idEmpresa
        WHERE vnc.idEmpresa = v.idEmpresa
          AND ISNULL(vnc.eliminado, 0) = 0
          AND UPPER(LTRIM(RTRIM(ISNULL(cnc.codigo, '')))) IN ('F7','B7','07')
          AND ce.tipoComprobante = '07'
          AND ce.idEstadoSunat IN (1, 2, 3)
          AND RTRIM(LTRIM(UPPER(ISNULL(vnc.compRelacionado, '')))) = RTRIM(LTRIM(UPPER(ISNULL(v.compVenta, ''))))
      ), 0)
    ) > 0.01`;
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
      (
        v.total - ISNULL((
          SELECT SUM(vnc.total)
          FROM Ventas vnc
          INNER JOIN Comprobantes cnc ON cnc.idComprobante = vnc.idComprobante AND cnc.idEmpresa = vnc.idEmpresa
          INNER JOIN ComprobantesElectronicos ce ON ce.idVenta = vnc.idVenta AND ce.idEmpresa = vnc.idEmpresa
          WHERE vnc.idEmpresa = v.idEmpresa
            AND ISNULL(vnc.eliminado, 0) = 0
            AND UPPER(LTRIM(RTRIM(ISNULL(cnc.codigo, '')))) IN ('F7','B7','07')
            AND ce.tipoComprobante = '07'
            AND ce.idEstadoSunat IN (1, 2, 3)
            AND RTRIM(LTRIM(UPPER(ISNULL(vnc.compRelacionado, '')))) = RTRIM(LTRIM(UPPER(ISNULL(v.compVenta, ''))))
        ), 0)
      ) AS saldoPendiente,
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

/** Anula/elimina lógicamente una venta (eliminado=1). Restaura stock, elimina movimientos caja. No permitido si SUNAT ya aceptó (1/2/3), salvo nota de venta (NV).
 * @param {string|string[]} idEmpresaOLista - Empresa del JWT o lista (gestora + gestionadas) para resolver la venta.
 * @param {string|null|undefined} idUsuarioEjecutor - JWT sub si Ventas.idUsuario es null (movimiento inventario)
 */
exports.anularVentaRepo = async (pool, idVenta, idEmpresaOLista, idUsuarioEjecutor = null) => {
  const idsEmpresa = (Array.isArray(idEmpresaOLista) ? idEmpresaOLista : [idEmpresaOLista]).filter(Boolean);
  if (idsEmpresa.length === 0) {
    return { ok: false, error: 'Empresa no válida.' };
  }
  const stockRepository = require('./stock.repository');
  const inventarioRepository = require('./inventario.repository');
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const reqV = transaction.request().input('idVenta', sql.Int, idVenta);
    const inEmp = bindUniqueIdentifiersIn(reqV, idsEmpresa, 'anuEmp');
    const ventaRow = await reqV.query(`
        SELECT v.idEmpresa, v.idVenta, v.idEstadoSunat, v.idSucursal, v.compVenta, v.idComprobante, v.idUsuario,
          ISNULL(v.eliminado, 0) AS eliminado, v.idVentaAgrupada,
          UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        WHERE v.idVenta = @idVenta AND v.idEmpresa IN (${inEmp})
      `);
    const venta = ventaRow.recordset && ventaRow.recordset[0];
    if (!venta) {
      await transaction.rollback();
      return { ok: false, error: 'Venta no encontrada.' };
    }
    const idEmpresa = venta.idEmpresa;
    if (venta.eliminado) {
      await transaction.rollback();
      return { ok: false, error: 'El comprobante ya fue anulado.' };
    }
    const codAnular = String(venta.codigoComprobante || '').trim().toUpperCase();
    const esNotaVentaAnular = codAnular === 'NV';
    const idSun = venta.idEstadoSunat != null ? Number(venta.idEstadoSunat) : null;
    if (!esNotaVentaAnular && (idSun === 1 || idSun === 2 || idSun === 3)) {
      await transaction.rollback();
      return { ok: false, error: 'No se puede eliminar: el comprobante ya fue enviado o aceptado en SUNAT.' };
    }
    const idSucursal = venta.idSucursal;
    const detalleRows = await transaction.request()
      .input('idVenta', sql.Int, idVenta)
      .query(`
        SELECT idProducto, cantidad, ISNULL(costoUnitario, 0) AS costoUnitario
        FROM DetalleVenta WHERE idVenta = @idVenta
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
        const idUsuarioMov = venta.idUsuario || idUsuarioEjecutor;
        if (idUsuarioMov) {
          await inventarioRepository.insertarFilaMovimiento(transaction, {
            idEmpresa,
            idSucursal,
            idProducto: d.idProducto,
            tipoMovimiento: 'EN',
            cantidad: cant,
            docRelacionado: venta.compVenta,
            idComprobante: venta.idComprobante,
            idUsuario: idUsuarioMov,
            observaciones: 'Anulación de venta — devolución de stock',
            costoUnitario: d.costoUnitario != null ? Number(d.costoUnitario) : 0,
            idLote: null
          });
        }
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

    const idVentaAgrupada = venta.idVentaAgrupada;
    if (idVentaAgrupada) {
      await transaction
        .request()
        .input('idVenta', sql.Int, idVenta)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          UPDATE VentaEmpresa SET eliminado = 1
          WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa AND ISNULL(eliminado, 0) = 0
        `);
      const syncVa = await recalcularVentaAgrupadaDesdeHijas(transaction, idVentaAgrupada);
      const idUsuarioLog = venta.idUsuario || idUsuarioEjecutor;
      if (idUsuarioLog) {
        await exports.insertarVentaAgrupadaLog(transaction, {
          idVentaAgrupada,
          evento: syncVa.eliminada ? 'ANULACION_VA' : 'ANULACION_HIJA',
          compVA: syncVa.compVA,
          totalVA: syncVa.totalVA,
          sumaVentasHijas: syncVa.sumaVentasHijas,
          idUsuario: idUsuarioLog,
          detalle: syncVa.eliminada
            ? `Venta agrupada anulada tras anular comprobante ${venta.compVenta || idVenta}`
            : `Comprobante anulado: ${venta.compVenta || idVenta}`
        });
      }
    }

    await transaction.commit();
    return { ok: true, compVenta: venta.compVenta || null, idVentaAgrupada: idVentaAgrupada || null };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Recalcula totales y detalle de VentaAgrupada desde VentaEmpresa activas.
 * Si no quedan hijas activas, marca la VA como eliminada.
 * @returns {{ eliminada: boolean, compVA?: string, totalVA?: number, sumaVentasHijas?: number }}
 */
async function recalcularVentaAgrupadaDesdeHijas(transaction, idVentaAgrupada) {
  const idVA = idVentaAgrupada;
  const vaRow = await transaction
    .request()
    .input('idVA', sql.UniqueIdentifier, idVA)
    .query(`
      SELECT ISNULL(compVenta, '') AS compVA, ISNULL(total, 0) AS totalVA
      FROM VentaAgrupada WHERE idVentaAgrupada = @idVA
    `);
  const vaInfo = vaRow.recordset && vaRow.recordset[0];

  const countRs = await transaction
    .request()
    .input('idVA', sql.UniqueIdentifier, idVA)
    .query(`
      SELECT COUNT(*) AS n FROM VentaEmpresa
      WHERE idVentaAgrupada = @idVA AND ISNULL(eliminado, 0) = 0
    `);
  const activas = Number((countRs.recordset[0] || {}).n) || 0;

  if (activas === 0) {
    await transaction
      .request()
      .input('idVA', sql.UniqueIdentifier, idVA)
      .query(`
        UPDATE VentaAgrupada
        SET eliminado = 1, subtotal = 0, igv = 0, descuentos = 0, total = 0
        WHERE idVentaAgrupada = @idVA
      `);
    await transaction
      .request()
      .input('idVA', sql.UniqueIdentifier, idVA)
      .query(`DELETE FROM DetalleVentaAgrupada WHERE idVentaAgrupada = @idVA`);
    return {
      eliminada: true,
      compVA: vaInfo ? String(vaInfo.compVA || '').trim() : '',
      totalVA: 0,
      sumaVentasHijas: 0
    };
  }

  const agg = await transaction
    .request()
    .input('idVA', sql.UniqueIdentifier, idVA)
    .query(`
      SELECT
        ISNULL(SUM(subtotal), 0) AS sSub,
        ISNULL(SUM(igv), 0) AS sIgv,
        ISNULL(SUM(descuentos), 0) AS sDesc,
        ISNULL(SUM(total), 0) AS sTot
      FROM VentaEmpresa
      WHERE idVentaAgrupada = @idVA AND ISNULL(eliminado, 0) = 0
    `);
  const ar = agg.recordset && agg.recordset[0];
  const sSub = Number(ar?.sSub) || 0;
  const sIgv = Number(ar?.sIgv) || 0;
  const sDesc = Number(ar?.sDesc) || 0;
  const sTot = Number(ar?.sTot) || 0;

  await transaction
    .request()
    .input('idVA', sql.UniqueIdentifier, idVA)
    .input('subtotal', sql.Decimal(18, 2), sSub)
    .input('igv', sql.Decimal(18, 2), sIgv)
    .input('descuentos', sql.Decimal(18, 2), sDesc)
    .input('total', sql.Decimal(18, 2), sTot)
    .query(`
      UPDATE VentaAgrupada
      SET subtotal = @subtotal, igv = @igv, descuentos = @descuentos, total = @total, eliminado = 0
      WHERE idVentaAgrupada = @idVA
    `);

  await transaction
    .request()
    .input('idVA', sql.UniqueIdentifier, idVA)
    .query(`DELETE FROM DetalleVentaAgrupada WHERE idVentaAgrupada = @idVA`);

  await transaction
    .request()
    .input('idVA', sql.UniqueIdentifier, idVA)
    .query(`
      INSERT INTO DetalleVentaAgrupada (
        idVentaAgrupada, idProducto, idEmpresaProducto, aliasEmpresa, sucursal,
        cantidad, pVenta, descuento, subtotal, igv, total, descripcionProducto, codigoProducto
      )
      SELECT
        @idVA,
        dv.idProducto,
        ve.idEmpresa,
        NULL,
        ISNULL(LTRIM(RTRIM(s.nombre)), ''),
        dv.cantidad, dv.pVenta, ISNULL(dv.descuento, 0), dv.subtotal, dv.igv, dv.total,
        p.descripcion,
        p.codigo
      FROM VentaEmpresa ve
      INNER JOIN Ventas v ON v.idVenta = ve.idVenta AND v.idEmpresa = ve.idEmpresa
      INNER JOIN DetalleVenta dv ON dv.idVenta = v.idVenta
      INNER JOIN Productos p ON p.idProducto = dv.idProducto AND p.idEmpresa = ve.idEmpresa
      LEFT JOIN Sucursal s ON s.idSucursal = v.idSucursal AND s.idEmpresa = ve.idEmpresa
      WHERE ve.idVentaAgrupada = @idVA
        AND ISNULL(ve.eliminado, 0) = 0
        AND ISNULL(v.eliminado, 0) = 0
    `);

  return {
    eliminada: false,
    compVA: vaInfo ? String(vaInfo.compVA || '').trim() : '',
    totalVA: sTot,
    sumaVentasHijas: sTot
  };
}

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

/** Busca cliente por documento (RUC/DNI) en una empresa. Compara RUC normalizado (solo dígitos).
 *  Prioriza el cliente que ya tenga al menos una dirección registrada (evita reusar duplicados sin dirección). */
exports.buscarClientePorDocumento = async (transaction, idEmpresa, ruc) => {
  const rucNorm = documentoSoloDigitosPdf(ruc);
  if (!rucNorm) return null;
  const result = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('rucNorm', sql.VarChar(32), rucNorm)
    .query(`
      SELECT TOP 1 cl.idCliente, cl.idDocumento, cl.ruc, cl.rSocial, cl.correo, cl.celular, cl.condicion
      FROM Clientes cl
      WHERE cl.idEmpresa = @idEmpresa
        AND REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(cl.ruc,''))), '-', ''), ' ', ''), '.', '') = @rucNorm
      ORDER BY
        CASE WHEN EXISTS (
          SELECT 1 FROM DireccionClientes dc
          WHERE dc.idCliente = cl.idCliente
            AND dc.idEmpresa = cl.idEmpresa
            AND NULLIF(LTRIM(RTRIM(ISNULL(dc.direccion,''))), '') IS NOT NULL
        ) THEN 0 ELSE 1 END,
        cl.idCliente ASC
    `);
  return result.recordset && result.recordset[0];
};

/** Inserta cliente en empresa destino replicando datos básicos. Idempotente: si ya existe el RUC normalizado,
 *  devuelve el cliente existente sin volver a insertar. */
exports.crearClienteEnEmpresa = async (transaction, idEmpresa, clienteBase) => {
  const existente = await exports.buscarClientePorDocumento(transaction, idEmpresa, clienteBase.ruc);
  if (existente && existente.idCliente) {
    return { idCliente: existente.idCliente, existente: true };
  }
  const rucNorm = documentoSoloDigitosPdf(clienteBase.ruc);
  const result = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idDocumento', sql.VarChar(1), clienteBase.idDocumento)
    .input('ruc', sql.VarChar(11), rucNorm)
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
        CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
        UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante
      FROM VentaEmpresa ve
      LEFT JOIN Ventas v ON v.idVenta = ve.idVenta AND v.idEmpresa = ve.idEmpresa
      LEFT JOIN Comprobantes c ON c.idComprobante = ve.idComprobante AND c.idEmpresa = ve.idEmpresa
      WHERE ve.idVentaAgrupada = @idVentaAgrupada
        AND ISNULL(ve.eliminado, 0) = 0
        AND ISNULL(v.eliminado, 0) = 0
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
        AND ISNULL(ve.eliminado, 0) = 0
        AND ISNULL(va.eliminado, 0) = 0
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
  const idsSet = new Set();
  if (idEmpresaCobradora) idsSet.add(String(idEmpresaCobradora));
  try {
    const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaCobradora);
    for (const g of gestionadas || []) {
      if (g.idEmpresa) idsSet.add(String(g.idEmpresa));
    }
  } catch (_) {
    /* solo cobradora */
  }
  const idsArr = Array.from(idsSet);
  const reqVaCab = pool
    .request()
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .input('idEmpresaCobradora', sql.UniqueIdentifier, idEmpresaCobradora);
  const inListVa = bindUniqueIdentifiersIn(reqVaCab, idsArr, 'vaPdfEmp');

  const cabResult = await reqVaCab.query(`
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
        (SELECT TOP 1 ${SQL_DC_LINEA_DIRECCION_READABLE}
         FROM DireccionClientes dc
         WHERE dc.idCliente = va.idCliente AND dc.idEmpresa IN (${inListVa})
           AND NULLIF(${SQL_DC_LINEA_DIRECCION_READABLE}, '') IS NOT NULL
         ORDER BY
           CASE WHEN dc.idEmpresa = va.idEmpresaCobradora THEN 0 ELSE 1 END,
           CASE WHEN ISNULL(dc.principal, 0) = 1 THEN 0 ELSE 1 END, dc.idDireccionClientes) AS clienteDireccion
      FROM VentaAgrupada va
      LEFT JOIN Sucursal s ON s.idSucursal = va.idSucursal
      LEFT JOIN Clientes cl ON cl.idCliente = va.idCliente AND cl.idEmpresa IN (${inListVa})
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

  const sucursalesCountResult = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresaCobradora)
    .query(`SELECT COUNT(1) AS cnt FROM Sucursal WHERE idEmpresa = @idEmpresa`);
  const cantidadSucursalesEmpresa = Number(sucursalesCountResult.recordset?.[0]?.cnt) || 0;

  const itemsResult = await pool.request()
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .query(`
      SELECT
        dva.idDetalleVA, dva.idProducto, dva.cantidad, dva.pVenta,
        dva.descuento, dva.subtotal, dva.total,
        dva.descripcionProducto, dva.codigoProducto,
        dva.aliasEmpresa, dva.sucursal, dva.idEmpresaProducto,
        LTRIM(RTRIM(ISNULL(m.nombre, ''))) AS marca
      FROM DetalleVentaAgrupada dva
      LEFT JOIN Productos p ON p.idProducto = dva.idProducto AND p.idEmpresa = dva.idEmpresaProducto
      LEFT JOIN Marcas m ON m.idMarca = p.idMarca
      WHERE dva.idVentaAgrupada = @idVentaAgrupada
      ORDER BY dva.idDetalleVA
    `);

  const impuestosVaResult = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresaCobradora)
    .query(`
      SELECT
        idImpuesto,
        descripcion,
        ISNULL(codigoSunat, '') AS codigoSunat,
        CONVERT(DECIMAL(5,2), porcentaje) AS porcentaje,
        pIncluyeIGV,
        ISNULL(estado, 0) AS estado
      FROM Impuestos
      WHERE idEmpresa = @idEmpresa
      ORDER BY descripcion
    `);
  const impuestosVa = (impuestosVaResult.recordset || []).map((r) => ({
    idImpuesto: r.idImpuesto,
    descripcion: r.descripcion,
    codigoSunat: String(r.codigoSunat || '').trim(),
    porcentaje: r.porcentaje,
    pIncluyeIGV: !!r.pIncluyeIGV,
    estado: normalizarEstadoImpuestoCatalogo(r.estado)
  }));

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
      logo: logoUrl,
      cantidadSucursales: cantidadSucursalesEmpresa
    } : { nombre: '', ruc: '', direccion: '', telefono: '', logo: `${base}/assets/img/01.jpg`, cantidadSucursales: 0 },
    cliente: {
      rSocial: cab.clienteRazonSocial,
      razonSocial: cab.clienteRazonSocial,
      ruc: cab.clienteRuc,
      celular: (cab.clienteCelular || '').trim(),
      direccion: direccionClienteLegiblePdf((cab.clienteDireccion || '').trim()),
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
      idEmpresaProducto: d.idEmpresaProducto,
      marca: d.marca != null ? String(d.marca).trim() : ''
    })),
    impuestos: impuestosVa
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

/** --- Consultas migradas desde ventasController --- */

exports.obtenerVentaPorSerieNumeroEmpresa = async (pool, serieNumero, idEmpresa) => {
  const result = await pool
    .request()
    .input('Serie_Numero', sql.VarChar(30), String(serieNumero).trim())
    .input('idempresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM Ventas WHERE Serie_Numero = @Serie_Numero AND idEmpresa = @idempresa');
  return result.recordset;
};

exports.actualizarVentaEstadoPedidoSunat = async (pool, serieNumero, estadoPedido, estadoSunat) => {
  await pool
    .request()
    .input('Serie_Numero', sql.VarChar(30), String(serieNumero).trim())
    .input('EstadoPedido', sql.VarChar(100), estadoPedido != null ? String(estadoPedido) : '')
    .input('EstadoSunat', sql.VarChar(100), estadoSunat != null ? String(estadoSunat) : '')
    .query(
      'UPDATE Ventas SET EstadoPedido = @EstadoPedido, EstadoSunat = @EstadoSunat WHERE Serie_Numero = @Serie_Numero'
    );
};

exports.transaccionDescontarStockEInsertarDetalleVenta = async (pool, params) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const r1 = new sql.Request(transaction);
    await r1
      .input('idEmpresa', sql.UniqueIdentifier, params.idEmpresa)
      .input('idSucursal', sql.UniqueIdentifier, params.idSucursal)
      .input('idProducto', sql.UniqueIdentifier, params.idProducto)
      .input('cantidad', sql.Decimal(18, 2), params.cantidad)
      .execute('sp_DescontarStock');
    const r2 = new sql.Request(transaction);
    await r2
      .input('idVenta', sql.Int, params.idVenta)
      .input('idProducto', sql.UniqueIdentifier, params.idProducto)
      .input('cantidad', sql.Decimal(18, 3), params.cantidad)
      .input('pVenta', sql.Decimal(18, 5), params.pVenta)
      .input('descuento', sql.Decimal(18, 2), params.descuento)
      .input('subtotal', sql.Decimal(18, 2), params.subtotal)
      .input('igv', sql.Bit, params.igv)
      .input('isc', sql.Bit, params.isc)
      .input('total', sql.Decimal(18, 2), params.total)
      .input('hVenta', sql.VarChar(23), params.hVentaSQL)
      .input('cantEntregada', sql.Decimal(18, 3), params.cantEntregada)
      .input('idEstadoPedido', sql.Int, params.idEstadoPedido)
      .query(`INSERT INTO DetalleVenta 
        (idVenta, idProducto, cantidad, pVenta, descuento, subtotal, igv, isc, total, hVenta, cantEntregada, idEstadoPedido)
        VALUES
        (@idVenta, @idProducto, @cantidad, @pVenta, @descuento, @subtotal, @igv, @isc, @total, @hVenta, @cantEntregada, @idEstadoPedido)`);
    await transaction.commit();
  } catch (e) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw e;
  }
};

exports.actualizarDetalleVentasEntrega = async (pool, id, cantEntregado, fUltEntregaSQL, estadoPedido) => {
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('CantEntregado', sql.Decimal(18, 4), cantEntregado)
    .input('FUltEntrega', sql.VarChar(23), fUltEntregaSQL)
    .input('EstadoPedido', sql.Int, estadoPedido)
    .query(
      'UPDATE DetalleVentas SET CantEntregado = @CantEntregado, FUltEntrega = @FUltEntrega, idEstadoPedido = @EstadoPedido WHERE Id = @id'
    );
};

exports.obtenerDetalleVentaPorIdVenta = async (pool, idVenta) => {
  const result = await pool
    .request()
    .input('idVenta', sql.Int, idVenta)
    .query('SELECT * FROM DetalleVenta WHERE idVenta = @idVenta');
  return result.recordset;
};

exports.obtenerVentaPorIdDetalle = async (pool, idDetalle) => {
  const result = await pool
    .request()
    .input('idDetalle', sql.Int, idDetalle)
    .query(
      'SELECT v.* FROM Ventas v JOIN DetalleVenta dv ON v.idVenta = dv.idVenta WHERE dv.idDetalle = @idDetalle'
    );
  return result.recordset;
};

exports.restaurarStockEliminarDetalleVenta = async (pool, { idDetalle, idEmpresa, idSucursal, idProducto, cantidad }) => {
  const r0 = pool.request();
  r0.input('idDetalle', sql.Int, idDetalle);
  r0.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  r0.input('idSucursal', sql.UniqueIdentifier, idSucursal);
  r0.input('idProducto', sql.UniqueIdentifier, idProducto);
  r0.input('cantidad', sql.Decimal(18, 2), cantidad);
  await r0.execute('sp_RestaurarStock');
  await pool
    .request()
    .input('idDetalle', sql.Int, idDetalle)
    .query('DELETE FROM DetalleVenta WHERE idDetalle = @idDetalle');
};

exports.obtenerVentaAgrupadaParaCobro = async (pool, idVentaAgrupada, idEmpresaCobradora) => {
  const result = await pool
    .request()
    .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
    .input('idEmpresaCobradora', sql.UniqueIdentifier, idEmpresaCobradora)
    .query(`
      SELECT idVentaAgrupada, idSucursal, idEstadoPago, compVenta
      FROM VentaAgrupada
      WHERE idVentaAgrupada = @idVentaAgrupada AND idEmpresaCobradora = @idEmpresaCobradora
    `);
  return result.recordset && result.recordset[0] ? result.recordset[0] : null;
};

exports.obtenerFVencimientoPrimeraVentaEmpresaVA = async (transaction, idVentaAgrupada) => {
  const result = await transaction
    .request()
    .input('idVA', sql.UniqueIdentifier, idVentaAgrupada)
    .query(`
      SELECT TOP 1 CONVERT(VARCHAR(10), v.fVencimiento, 23) AS fVencimiento
      FROM VentaEmpresa ve
      INNER JOIN Ventas v ON v.idVenta = ve.idVenta AND v.idEmpresa = ve.idEmpresa
      WHERE ve.idVentaAgrupada = @idVA
      ORDER BY ve.fEmision ASC
    `);
  return result.recordset?.[0]?.fVencimiento || null;
};

exports.obtenerVentaParaCobroPendiente = async (pool, idVenta, idEmpresa) => {
  const result = await pool
    .request()
    .input('idVenta', sql.Int, idVenta)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        v.idVenta,
        v.compVenta,
        v.idSucursal,
        v.idEstadoPago,
        v.idCliente,
        v.total,
        CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
        CONVERT(VARCHAR(10), v.fVencimiento, 23) AS fVencimiento,
        UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante
      FROM Ventas v
      LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
      WHERE v.idVenta = @idVenta AND v.idEmpresa = @idEmpresa
    `);
  return result.recordset && result.recordset[0] ? result.recordset[0] : null;
};