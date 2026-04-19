// services/ventas.service.js

const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');
const ventasRepository = require('../repositories/ventas.repository');
const valesDespachoRepository = require('../repositories/valesDespacho.repository');
const detalleVentaService = require('./detalle-ventas.service');
const facturacionRepository = require('../repositories/facturacion.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const stockService = require('./stock.service');
const inventarioRepository = require('../repositories/inventario.repository');
const { getNowLocalSQLString, getFechaEmisionSQLString, getFechaSoloSQLString } = require('../utils/fechaHoraLocal.util');
const { interpretarBooleanoConfig } = require('../utils/configBoolean.util');
const sunatPostPagoService = require('./sunatPostPago.service');

/** Inserta cabecera de venta dentro de una transacción ya iniciada. */
exports.insertarVentaCabecera = async (transaction, datosVenta, idEmpresa, idUsuario) => {
  return await ventasRepository.insertar(transaction, datosVenta, idEmpresa, idUsuario);
};

/**
 * Crea cabecera de venta en una transacción propia (commit/rollback).
 * Usado por POST crear venta legacy del controlador.
 */
exports.crearVentaCabeceraConTransaccion = async (pool, datosVenta, idEmpresa, idUsuario) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await ventasRepository.insertar(transaction, datosVenta, idEmpresa, idUsuario);
    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
};

exports.obtenerVentaPorSerieNumero = async (pool, serieNumero, idEmpresa) => {
  return ventasRepository.obtenerVentaPorSerieNumeroEmpresa(pool, serieNumero, idEmpresa);
};

exports.actualizarVentaEstadoPedidoSunat = async (pool, serieNumero, estadoPedido, estadoSunat) => {
  return ventasRepository.actualizarVentaEstadoPedidoSunat(pool, serieNumero, estadoPedido, estadoSunat);
};

exports.crearDetalleVentaDescontarStock = async (pool, payload) => {
  return ventasRepository.transaccionDescontarStockEInsertarDetalleVenta(pool, payload);
};

exports.actualizarDetalleVentasEntrega = async (pool, id, cantEntregado, fUltEntregaSQL, estadoPedido) => {
  return ventasRepository.actualizarDetalleVentasEntrega(pool, id, cantEntregado, fUltEntregaSQL, estadoPedido);
};

exports.obtenerDetalleVentaPorIdVenta = async (pool, idVenta) => {
  return ventasRepository.obtenerDetalleVentaPorIdVenta(pool, idVenta);
};

exports.obtenerVentaPorIdDetalle = async (pool, idDetalle) => {
  return ventasRepository.obtenerVentaPorIdDetalle(pool, idDetalle);
};

exports.restaurarStockEliminarDetalleVenta = async (pool, params) => {
  return ventasRepository.restaurarStockEliminarDetalleVenta(pool, params);
};

exports.obtenerVentaAgrupadaParaCobro = async (pool, idVentaAgrupada, idEmpresaCobradora) => {
  return ventasRepository.obtenerVentaAgrupadaParaCobro(pool, idVentaAgrupada, idEmpresaCobradora);
};

exports.obtenerFVencimientoPrimeraVentaEmpresaVA = async (transaction, idVentaAgrupada) => {
  return ventasRepository.obtenerFVencimientoPrimeraVentaEmpresaVA(transaction, idVentaAgrupada);
};

exports.obtenerVentaParaCobroPendiente = async (pool, idVenta, idEmpresa) => {
  return ventasRepository.obtenerVentaParaCobroPendiente(pool, idVenta, idEmpresa);
};

function fechaEmisionConHoraActual(fEmision) {
  if (!fEmision) return getNowLocalSQLString();
  const str = typeof fEmision === 'string'
    ? fEmision.trim()
    : (fEmision instanceof Date ? fEmision.toISOString().slice(0, 19).replace('T', ' ') : '');
  const parteFecha = str.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parteFecha)) return getNowLocalSQLString();
  return getFechaEmisionSQLString(parteFecha);
}

const asegurarUsuarioEmpresaDestino = async (transaction, idEmpresaDestino, idEmpresaGestora, vendedor) => {
  if (String(idEmpresaDestino) === String(idEmpresaGestora)) return vendedor.sub;

  const email = vendedor.email;
  if (email) {
    const existente = await transaction.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresaDestino)
      .input('email', sql.VarChar(100), email)
      .query('SELECT TOP 1 idUsuario FROM UsuarioWeb WHERE idEmpresa = @idEmpresa AND email = @email');
    if (existente.recordset?.[0]?.idUsuario) return existente.recordset[0].idUsuario;
  }

  const byOrigin = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresaDestino)
    .input('idUsuarioOrigen', sql.UniqueIdentifier, vendedor.sub)
    .query('SELECT TOP 1 idUsuario FROM UsuarioWeb WHERE idEmpresa = @idEmpresa AND idUsuarioOrigen = @idUsuarioOrigen AND esEspejo = 1');
  if (byOrigin.recordset?.[0]?.idUsuario) return byOrigin.recordset[0].idUsuario;

  const anyActive = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresaDestino)
    .query('SELECT TOP 1 idUsuario FROM UsuarioWeb WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1 ORDER BY fRegistro ASC');
  if (anyActive.recordset?.[0]?.idUsuario) return anyActive.recordset[0].idUsuario;

  const rolResult = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresaDestino)
    .query("SELECT TOP 1 idRol FROM Roles WHERE idEmpresa = @idEmpresa AND UPPER(nombre) LIKE '%VENDEDOR%' ORDER BY fRegistro ASC");
  let idRol = rolResult.recordset?.[0]?.idRol;
  if (!idRol) {
    const anyRol = await transaction.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresaDestino)
      .query('SELECT TOP 1 idRol FROM Roles WHERE idEmpresa = @idEmpresa ORDER BY fRegistro ASC');
    idRol = anyRol.recordset?.[0]?.idRol;
  }
  if (!idRol) throw new Error('No se encontró un rol disponible en la empresa destino.');

  const nuevoId = require('crypto').randomUUID();
  const randomPass = require('crypto').randomBytes(32).toString('hex');
  const bcrypt = require('bcryptjs');
  const hashedPass = await bcrypt.hash(randomPass, 10);
  const nombres = vendedor.nombres || 'Vendedor';
  const apellidos = vendedor.apellidos || 'Gestora';
  const emailEspejo = email || `espejo_${nuevoId.slice(0, 8)}@gestora.local`;

  await transaction.request()
    .input('idUsuario', sql.UniqueIdentifier, nuevoId)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresaDestino)
    .input('nombres', sql.VarChar(100), nombres)
    .input('apellidos', sql.VarChar(100), apellidos)
    .input('email', sql.VarChar(100), emailEspejo)
    .input('password', sql.Text, hashedPass)
    .input('idRol', sql.UniqueIdentifier, idRol)
    .input('estado', sql.Bit, 1)
    .input('esEspejo', sql.Bit, 1)
    .input('idUsuarioOrigen', sql.UniqueIdentifier, vendedor.sub)
    .input('fRegistro', sql.DateTime, new Date())
    .query(`
      INSERT INTO UsuarioWeb (idUsuario, idEmpresa, nombres, apellidos, email, password, idRol, estado, esEspejo, idUsuarioOrigen, fRegistro)
      VALUES (@idUsuario, @idEmpresa, @nombres, @apellidos, @email, @password, @idRol, @estado, @esEspejo, @idUsuarioOrigen, @fRegistro)
    `);
  return nuevoId;
};

const obtenerEmpresasPermitidas = async (transaction, idEmpresaCobradora) => {
  const rs = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresaCobradora)
    .query(`
      SELECT idEmpresaDestino
      FROM Gestores_Empresas
      WHERE idEmpresaOrigen = @idEmpresa AND estado = 1
    `);
  const permitidas = new Set([idEmpresaCobradora]);
  for (const row of (rs.recordset || [])) {
    if (row.idEmpresaDestino) permitidas.add(row.idEmpresaDestino);
  }
  return permitidas;
};

const obtenerMapaProductosEmpresa = async (transaction, idsProducto) => {
  if (!idsProducto || idsProducto.length === 0) return new Map();
  const request = transaction.request();
  const params = idsProducto.map((id, i) => {
    const key = `idProducto${i}`;
    request.input(key, sql.UniqueIdentifier, id);
    return `@${key}`;
  });
  const rs = await request.query(`
    SELECT idProducto, idEmpresa
    FROM Productos
    WHERE idProducto IN (${params.join(', ')})
  `);
  const mapa = new Map();
  for (const row of (rs.recordset || [])) {
    mapa.set(String(row.idProducto), row.idEmpresa);
  }
  return mapa;
};

const obtenerSucursalPorEmpresa = async (transaction, idEmpresa) => {
  const rs = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT TOP 1 idSucursal FROM Sucursal WHERE idEmpresa = @idEmpresa ORDER BY fRegistro ASC');
  return rs.recordset?.[0]?.idSucursal || null;
};

const validarSucursalEmpresa = async (transaction, idEmpresa, idSucursal) => {
  if (!idSucursal) return false;
  const rs = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .query('SELECT TOP 1 idSucursal FROM Sucursal WHERE idEmpresa = @idEmpresa AND idSucursal = @idSucursal');
  return !!rs.recordset?.[0]?.idSucursal;
};

/** Sucursal de la empresa con más stock en Lotes para el producto. */
const obtenerSucursalPreferentePorProducto = async (transaction, idEmpresa, idProducto) => {
  if (!idEmpresa || !idProducto) return null;
  const rs = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT TOP 1 idSucursal
      FROM (
        SELECT idSucursal, SUM(cantidadDisponible) AS qty
        FROM Lotes
        WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND cantidadDisponible > 0
        GROUP BY idSucursal
      ) x
      ORDER BY x.qty DESC
    `);
  return rs.recordset?.[0]?.idSucursal || null;
};

const asegurarClienteEmpresaConBase = async (transaction, idEmpresaDestino, clienteBase) => {
  if (!clienteBase || !clienteBase.ruc) return null;
  const clienteDestino = await ventasRepository.buscarClientePorDocumento(transaction, idEmpresaDestino, clienteBase.ruc);
  if (clienteDestino && clienteDestino.idCliente) return clienteDestino.idCliente;
  const nuevo = await ventasRepository.crearClienteEnEmpresa(transaction, idEmpresaDestino, clienteBase);
  return nuevo?.idCliente || null;
};

const EPS_FISCAL = 0.02;

const redondear2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Línea marcada como afecta IGV (el POS a veces manda siempre igv: 0 en el arreglo de detalles). */
const esLineaConFlagIgv = (d) =>
  !!(d && (d.igv === true || d.igv === 1 || d.igv === '1'));

const calcularTotales = (detalles) => {
  const lista = Array.isArray(detalles) ? detalles : [];
  const suma = (arr, key) => arr.reduce((acc, d) => acc + (Number(d[key]) || 0), 0);
  const subtotal = suma(lista, 'subtotal');
  const total = suma(lista, 'total');
  const igvTotal = suma(lista, 'igvTotal');
  let igv = igvTotal > 0
    ? igvTotal
    : lista.reduce((acc, d) => {
        if (!esLineaConFlagIgv(d)) return acc;
        const sub = Number(d.subtotal) || 0;
        const tot = Number(d.total) || 0;
        return acc + Math.max(0, tot - sub);
      }, 0);
  igv = redondear2(igv);

  let exonerado = redondear2(suma(lista, 'exonerado'));
  if (exonerado <= EPS_FISCAL) {
    exonerado = redondear2(
      lista.reduce((acc, d) => {
        const sub = Number(d.subtotal) || 0;
        const tot = Number(d.total) || 0;
        if (esLineaConFlagIgv(d)) return acc;
        if (Math.abs(tot - sub) > EPS_FISCAL) return acc;
        return acc + sub;
      }, 0)
    );
  }

  return {
    subtotal,
    igv,
    exonerado,
    gratuito: suma(lista, 'gratuito') || 0,
    otrosCargos: suma(lista, 'otrosCargos') || 0,
    descuentos: suma(lista, 'descuentos') || suma(lista, 'descuento') || 0,
    total
  };
};

/**
 * Consolida montos de impuestos de cabecera: el POS suele mandar totales correctos en `venta` pero líneas sin IGV/exonerado.
 * No sustituye validación de negocio completa (tipo afectación por ítem); alinea cabecera con líneas cuando cuadran.
 * @param {object} venta - Cabecera (subtotal, igv, exonerado, gratuito, otrosCargos, descuentos, total)
 * @param {object} totalesDet - Resultado de calcularTotales(detalles)
 */
const resolverMontosCabeceraImpuestos = (venta, totalesDet) => {
  const td = totalesDet || {};
  const subDet = redondear2(td.subtotal);
  const totDet = redondear2(td.total);
  const igvDet = redondear2(td.igv);
  const exoDet = redondear2(td.exonerado);
  const gratDet = redondear2(td.gratuito);
  const otrDet = redondear2(td.otrosCargos);

  const subCab = redondear2(venta && venta.subtotal);
  const totCab = redondear2(venta && venta.total);
  const igvCab = redondear2(venta && venta.igv);
  const exoCab = redondear2(venta && venta.exonerado);
  const gratCab = redondear2(venta && venta.gratuito);
  const otrCab = redondear2(venta && venta.otrosCargos);
  const descCab = redondear2(venta && venta.descuentos);

  const subOk =
    subCab > EPS_FISCAL &&
    subDet > EPS_FISCAL &&
    Math.abs(subCab - subDet) <= EPS_FISCAL;

  const totOkSinIgvExtra = Math.abs(totCab - totDet) <= EPS_FISCAL;
  const totOkConIgv =
    igvCab > EPS_FISCAL &&
    Math.abs(totCab - redondear2(totDet + igvCab)) <= EPS_FISCAL;
  const totOk = totCab > EPS_FISCAL && (totOkSinIgvExtra || totOkConIgv);

  if (!subOk || !totOk) {
    return {
      subtotal: subDet,
      igv: igvDet,
      exonerado: exoDet,
      gratuito: gratDet,
      otrosCargos: otrDet,
      total: totDet
    };
  }

  let igv = igvCab >= 0 ? igvCab : igvDet;
  if (igvDet > EPS_FISCAL && igvCab <= EPS_FISCAL) {
    igv = igvDet;
  }

  let exonerado = exoCab > EPS_FISCAL ? exoCab : exoDet;
  if (exoCab <= EPS_FISCAL && redondear2(igv) <= EPS_FISCAL) {
    const neto = redondear2(subCab - descCab);
    const esperado = redondear2(neto + gratCab + otrCab);
    if (neto > EPS_FISCAL && Math.abs(totCab - esperado) <= 0.05) {
      exonerado = neto;
    }
  }

  const gratuito = gratCab > EPS_FISCAL ? gratCab : gratDet;
  const otrosCargos = otrCab > EPS_FISCAL ? otrCab : otrDet;

  return {
    subtotal: subCab,
    igv: redondear2(igv),
    exonerado: redondear2(exonerado),
    gratuito: redondear2(gratuito),
    otrosCargos: redondear2(otrosCargos),
    total: totCab
  };
};

/**
 * Venta estándar (una sola empresa): sin comprobante VA ni VentaAgrupada.
 * Empresas gestionadas e independientes. Usa idCliente e idComprobante de la cabecera en la misma empresa del JWT.
 */
async function crearVentaSimpleCompletaWithPool(payload, user, pool) {
  const { venta, detalles, detallePago, idApertura, cuotasCredito } = payload || {};
  if (!venta || !Array.isArray(detalles) || detalles.length === 0) {
    throw new Error('Venta y detalles son requeridos.');
  }
  const idComprobanteSolicitado = venta.idComprobante != null ? parseInt(String(venta.idComprobante), 10) : NaN;
  if (!Number.isFinite(idComprobanteSolicitado)) {
    throw new Error('Comprobante de venta no válido.');
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, user.empresa);
    const getConfig = (clave, def) => (configRows.find(c => c.clave === clave)?.valor ?? def);
    const permitirVentasNegativas = String(getConfig('INVENTARIO_PERMITIR_VENTAS_NEGATIVAS', 'false')).toLowerCase() === 'true';
    const controlUbicaciones = String(getConfig('INVENTARIO_CONTROL_UBICACIONES', 'true')).toLowerCase() !== 'false';
    const usarDescuentoEnTotal = interpretarBooleanoConfig(getConfig('VENTAS_USAR_DESCUENTO_EN_TOTAL', 'true'), true);

    let idSucursalEmpresa = venta.idSucursal || null;
    if (!idSucursalEmpresa) {
      idSucursalEmpresa = await obtenerSucursalPorEmpresa(transaction, user.empresa);
    }
    if (!idSucursalEmpresa) {
      throw new Error('No se pudo determinar la sucursal de la venta.');
    }

    const fechaEmisionConHora = fechaEmisionConHoraActual(venta.fEmision);
    const fVencimientoSQL = getFechaSoloSQLString(venta.fVencimiento) || fechaEmisionConHora;
    const ventaConHora = { ...venta, fEmision: fechaEmisionConHora, fVencimiento: fVencimientoSQL };
    let idEstadoPago = venta.idEstadoPago != null ? parseInt(venta.idEstadoPago, 10) : 1;
    const idEstadoPedidoVenta = venta.idEstadoPedido != null ? parseInt(venta.idEstadoPedido, 10) : 1;
    const esEstadoPendiente = (idEstadoPedidoVenta === 1);

    const medPagoValido = ventaConHora.idMediosPago != null && String(ventaConHora.idMediosPago).trim() !== '';
    if (!medPagoValido) {
      const rContado = await transaction.request().query(`SELECT TOP 1 idMediosPago FROM MediosPago WHERE RTRIM(LTRIM(ISNULL(codigo,''))) = '009'`);
      const rCualquiera = await transaction.request().query('SELECT TOP 1 idMediosPago FROM MediosPago');
      const fallbackId = rContado.recordset?.[0]?.idMediosPago ?? rCualquiera.recordset?.[0]?.idMediosPago;
      ventaConHora.idMediosPago = fallbackId != null ? String(fallbackId) : '1';
    }

    try {
      const ventaCreditoPostVentaService = require('./ventaCreditoPostVenta.service');
      const idsCredCab = await ventaCreditoPostVentaService.idsMediosPagoCredito(transaction);
      const idMpCab = Number(ventaConHora.idMediosPago);
      if (idsCredCab.has(idMpCab)) {
        idEstadoPago = 2;
      }
    } catch (err) {
      console.error('contexto: idEstadoPago crédito cabecera (venta simple)', err);
    }

    const idsProducto = [...new Set(detalles.map(d => d.idProducto).filter(Boolean).map(String))];
    const mapaProductos = await obtenerMapaProductosEmpresa(transaction, idsProducto);
    if (mapaProductos.size !== idsProducto.length) {
      throw new Error('Uno o más productos no existen.');
    }

    const idEmpresaJwt = String(user.empresa).toLowerCase();
    const dets = [];
    for (const det of detalles) {
      const idProducto = String(det.idProducto);
      const idEmpProd = mapaProductos.get(idProducto);
      if (!idEmpProd || String(idEmpProd).toLowerCase() !== idEmpresaJwt) {
        throw new Error(`Producto ${det.descripcion || idProducto} no pertenece a su empresa.`);
      }
      dets.push({
        ...det,
        idEmpresaProducto: idEmpProd,
        idSucursalEmpresa: det.idSucursalEmpresa || det.idSucursal || null
      });
    }

    const clienteSeleccionado = await ventasRepository.obtenerClientePorIdEnEmpresas(
      transaction,
      venta.idCliente,
      [user.empresa]
    );
    if (!clienteSeleccionado) {
      throw new Error('Cliente no encontrado.');
    }
    const idClienteEmpresa = clienteSeleccionado.idCliente;
    const idUsuarioEmpresa = user.sub;

    const rCompDestino = await transaction.request()
      .input('idComprobante', sql.Int, idComprobanteSolicitado)
      .input('idEmpresa', sql.UniqueIdentifier, user.empresa)
      .query('SELECT idComprobante, codigo FROM Comprobantes WHERE idComprobante = @idComprobante AND idEmpresa = @idEmpresa');
    const idComprobanteDestino = rCompDestino.recordset?.[0]?.idComprobante;
    const codigoComprobante = (rCompDestino.recordset?.[0]?.codigo || '').trim().toUpperCase();
    if (!idComprobanteDestino) {
      throw new Error('El comprobante seleccionado no existe en su empresa o no está autorizado.');
    }
    if (codigoComprobante === 'F7' || codigoComprobante === 'B7' || codigoComprobante === 'F8' || codigoComprobante === 'B8') {
      throw new Error('Las notas de crédito/débito (F7/B7/F8/B8) no se emiten desde el punto de venta; use el módulo de notas de crédito / débito.');
    }
    const esNotaVenta = codigoComprobante === 'NV';

    const sucursalesUnicas = new Set(dets.map(d => d.idSucursalEmpresa).filter(Boolean));
    if (sucursalesUnicas.size > 1) {
      throw new Error('No se permite más de una sucursal en una misma venta.');
    }
    let idSucursalLinea = sucursalesUnicas.size === 1 ? Array.from(sucursalesUnicas)[0] : null;
    if (!idSucursalLinea) {
      const primero = dets.find((d) => d.idProducto);
      idSucursalLinea = primero
        ? await obtenerSucursalPreferentePorProducto(transaction, user.empresa, String(primero.idProducto))
        : null;
    }
    if (!idSucursalLinea) {
      idSucursalLinea = idSucursalEmpresa;
    }
    if (!idSucursalLinea) {
      throw new Error('No se pudo determinar la sucursal para el detalle.');
    }
    if (!(await validarSucursalEmpresa(transaction, user.empresa, idSucursalLinea))) {
      throw new Error('La sucursal de la venta no pertenece a su empresa.');
    }

    const { numero, serie } = await ventasRepository.obtenerSiguienteNumeroComprobante(
      transaction,
      user.empresa,
      idComprobanteDestino
    );
    const compVenta = serie + '-' + numero;

    const totalesEmpresa = calcularTotales(dets);
    const montosFiscales = resolverMontosCabeceraImpuestos(ventaConHora, totalesEmpresa);
    const descuentosCliente = Number(venta.descuentos);
    let descuentosCabeceraFinal = totalesEmpresa.descuentos;
    if (!usarDescuentoEnTotal) {
      descuentosCabeceraFinal = 0;
    } else if (Number.isFinite(descuentosCliente) && descuentosCliente >= 0) {
      descuentosCabeceraFinal = Math.round(descuentosCliente * 100) / 100;
    }

    const ventaDatos = {
      idSucursal: idSucursalLinea,
      serie,
      numero,
      compVenta,
      idComprobante: idComprobanteDestino,
      fEmision: fechaEmisionConHora,
      fVencimiento: fVencimientoSQL,
      idCliente: idClienteEmpresa,
      idMoneda: venta.idMoneda || 1,
      tCambio: venta.tCambio || 1,
      subtotal: montosFiscales.subtotal,
      igv: montosFiscales.igv,
      exonerado: montosFiscales.exonerado,
      gratuito: montosFiscales.gratuito,
      otrosCargos: montosFiscales.otrosCargos,
      descuentos: descuentosCabeceraFinal,
      total: montosFiscales.total,
      idMediosPago: ventaConHora.idMediosPago,
      idEstadoPedido: idEstadoPedidoVenta,
      idEstadoPago,
      idEstadoSunat: esNotaVenta ? 0 : (venta.idEstadoSunat || 0),
      compRelacionado: venta.compRelacionado || null,
      observaciones: venta.observaciones || null
    };

    const ventaResult = await ventasRepository.insertar(transaction, ventaDatos, user.empresa, idUsuarioEmpresa);
    const idVenta = ventaResult.recordset[0].idVenta;

    const avisoStockInsuficiente = [];

    for (const det of dets) {
      const cantPedida = parseFloat(det.cantidad) || 0;
      const cantEntregada = esEstadoPendiente ? 0 : (det.cantEntregada != null ? Number(det.cantEntregada) : det.cantidad);

      const stockDisponible = await stockService.obtenerStockDisponible(transaction, user.empresa, det.idProducto, idSucursalLinea);
      if (stockDisponible < cantPedida) {
        if (!permitirVentasNegativas) {
          throw new Error(`Stock insuficiente para "${det.descripcion || det.idProducto}". Disponible: ${stockDisponible}, solicitado: ${cantPedida}.`);
        }
        avisoStockInsuficiente.push({ idProducto: det.idProducto, cantidadSolicitada: cantPedida, cantidadDisponible: stockDisponible });
      }

      const cantidadADescontar = permitirVentasNegativas ? Math.min(cantPedida, stockDisponible) : cantPedida;
      let consumosPorLote = [];
      if (cantidadADescontar > 0) {
        const resultadoDescuento = await stockService.descontarDesdeLotes(transaction, {
          idEmpresa: user.empresa,
          idSucursal: idSucursalLinea,
          idProducto: det.idProducto,
          cantidad: cantidadADescontar
        }, { controlUbicaciones });
        consumosPorLote = resultadoDescuento?.consumosPorLote || [];
      }

      const costoTotalLinea = Array.isArray(consumosPorLote)
        ? consumosPorLote.reduce((acc, c) => acc + (Number(c.cantidadTomada) || 0) * (Number(c.costoUnitario) || 0), 0)
        : 0;
      const costoUnitarioProm = cantPedida > 0 ? (costoTotalLinea / cantPedida) : 0;

      await detalleVentaService.crearDetalle(transaction, {
        ...det,
        idVenta,
        cantEntregada,
        idEstadoPedido: idEstadoPedidoVenta,
        hVenta: getNowLocalSQLString(),
        costoUnitario: costoUnitarioProm,
        costoTotal: costoTotalLinea
      });
      det._costoUnitario = costoUnitarioProm;
      det._costoTotal = costoTotalLinea;
      det._cantEntregada = cantEntregada;

      if (cantidadADescontar > 0) {
        if (Array.isArray(consumosPorLote) && consumosPorLote.length > 0) {
          for (const c of consumosPorLote) {
            const cantTomada = Number(c.cantidadTomada) || 0;
            if (cantTomada <= 0) continue;
            await inventarioRepository.insertarFilaMovimiento(transaction, {
              idEmpresa: user.empresa,
              idSucursal: idSucursalLinea,
              idProducto: det.idProducto,
              tipoMovimiento: 'SA',
              cantidad: cantTomada,
              docRelacionado: compVenta,
              idComprobante: idComprobanteDestino,
              idUsuario: idUsuarioEmpresa,
              observaciones: 'Venta',
              costoUnitario: c.costoUnitario != null ? Number(c.costoUnitario) : costoUnitarioProm,
              idLote: c.idLote || null
            });
          }
        } else {
          await inventarioRepository.insertarFilaMovimiento(transaction, {
            idEmpresa: user.empresa,
            idSucursal: idSucursalLinea,
            idProducto: det.idProducto,
            tipoMovimiento: 'SA',
            cantidad: cantidadADescontar,
            docRelacionado: compVenta,
            idComprobante: idComprobanteDestino,
            idUsuario: idUsuarioEmpresa,
            observaciones: 'Venta',
            costoUnitario: costoUnitarioProm,
            idLote: null
          });
        }
      }
    }

    if (!esNotaVenta) {
      await facturacionRepository.registrarComprobanteElectronicoPorVentaRepo(
        transaction, user.empresa, idVenta, idComprobanteDestino, serie, numero, fechaEmisionConHora
      );
    }

    const ventasEmpresa = [{
      idEmpresa: String(user.empresa),
      idVenta,
      idCliente: idClienteEmpresa,
      codigoComprobante,
      compVenta,
      total: totalesEmpresa.total,
      idSucursal: idSucursalLinea,
    }];

    if (detallePago && Array.isArray(detallePago) && detallePago.length > 0 && ventasEmpresa.length > 0) {
      const ventaCreditoPostVentaService = require('./ventaCreditoPostVenta.service');
      await ventaCreditoPostVentaService.crearCreditosDesdeVentaAgrupada(transaction, {
        ventasEmpresa,
        detallePago,
        cuotasCredito: Array.isArray(cuotasCredito) ? cuotasCredito : [],
        userSub: user.sub,
        fVencimientoCabecera: venta.fVencimiento,
      });
    }

    if (detallePago && Array.isArray(detallePago) && detallePago.length > 0) {
      const ventaAgrupadaCobroService = require('./ventaAgrupadaCobro.service');
      await ventaAgrupadaCobroService.aplicarCobroVentasAgrupadasMulticompania(pool, transaction, {
        lineasVenta: ventasEmpresa.map((v) => ({
          idVenta: v.idVenta,
          idEmpresa: v.idEmpresa,
          compVenta: v.compVenta,
          total: v.total,
          idSucursal: v.idSucursal,
        })),
        detallePago,
        idEmpresaCobradora: user.empresa,
        idUsuario: user.sub,
        compVentaVA: compVenta,
        idAperturaGestoraOpcional: idApertura || null,
        idSucursalGestoraFallback: idSucursalLinea,
      });
    }

    await transaction.commit();
    if (detallePago && Array.isArray(detallePago) && detallePago.length > 0) {
      for (const ve of ventasEmpresa) {
        sunatPostPagoService.encolarTrasConfirmarPago(pool, ve.idVenta, ve.idEmpresa);
      }
    }
    return {
      idVentaAgrupada: null,
      compVentaVA: null,
      ventasEmpresa,
      avisoStockInsuficiente: avisoStockInsuficiente.length > 0
        ? 'Stock insuficiente para uno o más productos. Se descontó solo el disponible.'
        : null
    };
  } catch (error) {
    try { await transaction.rollback(); } catch (_) {}
    throw error;
  }
}

exports.crearVentaCorporativaCompleta = async (payload, user) => {
  if (!user || !user.empresa || !user.sub) {
    throw new Error('Usuario no autorizado.');
  }
  const { venta, detalles, detallePago, idApertura, cuotasCredito } = payload || {};
  if (!venta || !Array.isArray(detalles) || detalles.length === 0) {
    throw new Error('Venta y detalles son requeridos.');
  }

  return withPool(async (pool) => {
  const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
  if (!esGestora) {
    return crearVentaSimpleCompletaWithPool(payload, user, pool);
  }

  const tipoComprobanteDestino = (venta.tipoComprobanteDestino || 'NV').trim().toUpperCase();

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, user.empresa);
    const getConfig = (clave, def) => (configRows.find(c => c.clave === clave)?.valor ?? def);
    const permitirVentasNegativas = String(getConfig('INVENTARIO_PERMITIR_VENTAS_NEGATIVAS', 'false')).toLowerCase() === 'true';
    const controlUbicaciones = String(getConfig('INVENTARIO_CONTROL_UBICACIONES', 'true')).toLowerCase() !== 'false';
    const usarDescuentoEnTotal = interpretarBooleanoConfig(getConfig('VENTAS_USAR_DESCUENTO_EN_TOTAL', 'true'), true);

    let idSucursalCobradora = venta.idSucursal || null;
    if (!idSucursalCobradora) {
      idSucursalCobradora = await obtenerSucursalPorEmpresa(transaction, user.empresa);
    }
    if (!idSucursalCobradora) {
      throw new Error('No se pudo determinar la sucursal de la empresa cobradora.');
    }

    const fechaEmisionConHora = fechaEmisionConHoraActual(venta.fEmision);
    const fVencimientoSQL = getFechaSoloSQLString(venta.fVencimiento) || fechaEmisionConHora;
    const ventaConHora = { ...venta, fEmision: fechaEmisionConHora, fVencimiento: fVencimientoSQL };
    let idEstadoPago = venta.idEstadoPago != null ? parseInt(venta.idEstadoPago, 10) : 1;
    const idEstadoPedidoVenta = venta.idEstadoPedido != null ? parseInt(venta.idEstadoPedido, 10) : 1;
    const esEstadoPendiente = (idEstadoPedidoVenta === 1);

    const medPagoValido = ventaConHora.idMediosPago != null && String(ventaConHora.idMediosPago).trim() !== '';
    if (!medPagoValido) {
      const rContado = await transaction.request().query(`SELECT TOP 1 idMediosPago FROM MediosPago WHERE RTRIM(LTRIM(ISNULL(codigo,''))) = '009'`);
      const rCualquiera = await transaction.request().query('SELECT TOP 1 idMediosPago FROM MediosPago');
      const fallbackId = rContado.recordset?.[0]?.idMediosPago ?? rCualquiera.recordset?.[0]?.idMediosPago;
      ventaConHora.idMediosPago = fallbackId != null ? String(fallbackId) : '1';
    }

    // Factura/boleta (y NV) a crédito corriente / fiado: no van a "pendientes de pago" (cobranza en módulo créditos).
    try {
      const ventaCreditoPostVentaService = require('./ventaCreditoPostVenta.service');
      const idsCredCab = await ventaCreditoPostVentaService.idsMediosPagoCredito(transaction);
      const idMpCab = Number(ventaConHora.idMediosPago);
      if (idsCredCab.has(idMpCab)) {
        idEstadoPago = 2;
      }
    } catch (err) {
      console.error('contexto: idEstadoPago crédito cabecera', err);
    }

    const idsProducto = [...new Set(detalles.map(d => d.idProducto).filter(Boolean).map(String))];
    const mapaProductos = await obtenerMapaProductosEmpresa(transaction, idsProducto);
    if (mapaProductos.size !== idsProducto.length) {
      throw new Error('Uno o más productos no existen.');
    }
    const empresasPermitidas = await obtenerEmpresasPermitidas(transaction, user.empresa);

    const detallesPorEmpresa = new Map();
    for (const det of detalles) {
      const idProducto = String(det.idProducto);
      const idEmpresaProducto = mapaProductos.get(idProducto);
      if (!idEmpresaProducto || !empresasPermitidas.has(idEmpresaProducto)) {
        throw new Error(`Producto ${det.descripcion || idProducto} pertenece a una empresa no autorizada.`);
      }
      let idSucursalEmpresa = det.idSucursalEmpresa || null;
      if (idSucursalEmpresa && !(await validarSucursalEmpresa(transaction, idEmpresaProducto, idSucursalEmpresa))) {
        idSucursalEmpresa = null;
      }
      const arr = detallesPorEmpresa.get(String(idEmpresaProducto)) || [];
      arr.push({ ...det, idEmpresaProducto, idSucursalEmpresa });
      detallesPorEmpresa.set(String(idEmpresaProducto), arr);
    }

    const clienteSeleccionado = await ventasRepository.obtenerClientePorIdEnEmpresas(
      transaction,
      venta.idCliente,
      Array.from(empresasPermitidas)
    );
    if (!clienteSeleccionado) {
      throw new Error('Cliente no encontrado en empresas gestionadas.');
    }

    const idClienteCobradora = await asegurarClienteEmpresaConBase(
      transaction,
      user.empresa,
      clienteSeleccionado
    );
    if (!idClienteCobradora) {
      throw new Error('No se pudo registrar el cliente en la empresa cobradora.');
    }

    // --- Generar comprobante VA para la empresa gestora ---
    const rCompVA = await transaction.request()
      .input('idEmpresa', sql.UniqueIdentifier, user.empresa)
      .query("SELECT idComprobante FROM Comprobantes WHERE idEmpresa = @idEmpresa AND codigo = 'VA'");
    const idComprobanteVA = rCompVA.recordset?.[0]?.idComprobante;
    if (!idComprobanteVA) {
      throw new Error('Comprobante "Venta Agrupada" (VA) no configurado en la empresa gestora. Ejecute la migración.');
    }

    const vaCorrelativo = await ventasRepository.obtenerSiguienteNumeroComprobante(transaction, user.empresa, idComprobanteVA);
    const compVentaVA = vaCorrelativo.serie + '-' + vaCorrelativo.numero;

    const totalesAgrupados = calcularTotales(detalles);
    const montosCabAgr = resolverMontosCabeceraImpuestos(ventaConHora, totalesAgrupados);
    const descuentosClienteAgr = Number(venta.descuentos);
    let descuentosCabeceraVA = totalesAgrupados.descuentos;
    if (!usarDescuentoEnTotal) {
      descuentosCabeceraVA = 0;
    } else if (Number.isFinite(descuentosClienteAgr) && descuentosClienteAgr >= 0) {
      descuentosCabeceraVA = Math.round(descuentosClienteAgr * 100) / 100;
    }
    const ventaAgrupada = await ventasRepository.insertarVentaAgrupada(transaction, {
      idEmpresaCobradora: user.empresa,
      idSucursal: idSucursalCobradora,
      idCliente: idClienteCobradora,
      fEmision: fechaEmisionConHora,
      subtotal: montosCabAgr.subtotal,
      igv: montosCabAgr.igv,
      descuentos: descuentosCabeceraVA,
      total: montosCabAgr.total,
      idEstadoPago,
      idUsuario: user.sub,
      serie: vaCorrelativo.serie,
      numero: vaCorrelativo.numero,
      compVenta: compVentaVA,
      tipoComprobanteDestino,
      idComprobante: idComprobanteVA,
      observaciones: venta.observaciones || null
    });
    const idVentaAgrupada = ventaAgrupada?.idVentaAgrupada;

    // --- Insertar DetalleVentaAgrupada (todos los items para el comprobante VA) ---
    for (const det of detalles) {
      await ventasRepository.insertarDetalleVentaAgrupada(transaction, {
        idVentaAgrupada,
        idProducto: det.idProducto,
        idEmpresaProducto: mapaProductos.get(String(det.idProducto)),
        aliasEmpresa: det.aliasEmpresa || null,
        sucursal: det.sucursal || null,
        cantidad: Number(det.cantidad) || 0,
        pVenta: Number(det.pVenta) || 0,
        descuento: det.descuento || 0,
        subtotal: det.subtotal || (Number(det.cantidad) || 0) * (Number(det.pVenta) || 0),
        igv: det.igv ? 1 : 0,
        total: det.total || (Number(det.cantidad) || 0) * (Number(det.pVenta) || 0),
        descripcionProducto: det.descripcion || null,
        codigoProducto: det.codigo || null
      });
    }

    // --- Crear ventas individuales por empresa gestionada ---
    const avisoStockInsuficiente = [];
    const ventasEmpresa = [];
    const sucursalPorEmpresa = new Map();
    let sumaHijasTotal = 0;

    for (const [idEmpresaStr, dets] of detallesPorEmpresa.entries()) {
      const idEmpresaProducto = idEmpresaStr;
      const sucursalesUnicas = new Set(dets.map(d => d.idSucursalEmpresa).filter(Boolean));
      if (sucursalesUnicas.size > 1) {
        throw new Error('No se permite más de una sucursal por empresa en una misma venta.');
      }
      let idSucursalEmpresa = sucursalesUnicas.size === 1 ? Array.from(sucursalesUnicas)[0] : null;
      if (!idSucursalEmpresa) {
        const primero = dets.find((d) => d.idProducto);
        idSucursalEmpresa = primero
          ? await obtenerSucursalPreferentePorProducto(transaction, idEmpresaProducto, String(primero.idProducto))
          : null;
      }
      if (!idSucursalEmpresa) {
        idSucursalEmpresa = await obtenerSucursalPorEmpresa(transaction, idEmpresaProducto);
      }
      if (!idSucursalEmpresa) {
        throw new Error('No se pudo determinar la sucursal de la empresa destino.');
      }
      sucursalPorEmpresa.set(idEmpresaProducto, idSucursalEmpresa);

      const idUsuarioEmpresa = await asegurarUsuarioEmpresaDestino(
        transaction, idEmpresaProducto, user.empresa, user
      );

      const idClienteEmpresa = await asegurarClienteEmpresaConBase(
        transaction, idEmpresaProducto, clienteSeleccionado
      );
      if (!idClienteEmpresa) {
        throw new Error('No se pudo determinar el cliente para la empresa destino.');
      }

      const rCompDestino = await transaction.request()
        .input('codigo', sql.VarChar(2), tipoComprobanteDestino)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresaProducto)
        .query('SELECT idComprobante, codigo FROM Comprobantes WHERE codigo = @codigo AND idEmpresa = @idEmpresa');
      const idComprobanteDestino = rCompDestino.recordset?.[0]?.idComprobante;
      const codigoComprobante = (rCompDestino.recordset?.[0]?.codigo || '').trim().toUpperCase();
      if (!idComprobanteDestino) {
        throw new Error(`Comprobante tipo "${tipoComprobanteDestino}" no configurado para empresa destino ${idEmpresaProducto}.`);
      }
      const esNotaVenta = codigoComprobante === 'NV';

      const { numero, serie } = await ventasRepository.obtenerSiguienteNumeroComprobante(
        transaction, idEmpresaProducto, idComprobanteDestino
      );
      const compVenta = serie + '-' + numero;

      const totalesEmpresa = calcularTotales(dets);
      sumaHijasTotal += totalesEmpresa.total;
      let descuentosHija = totalesEmpresa.descuentos;
      const propSub =
        (Number(totalesAgrupados.subtotal) || 0) > EPS_FISCAL
          ? (Number(totalesEmpresa.subtotal) || 0) / (Number(totalesAgrupados.subtotal) || 1)
          : 0;
      const igvHija = redondear2((montosCabAgr.igv || 0) * propSub);
      const exoneradoHija = redondear2((montosCabAgr.exonerado || 0) * propSub);
      const gratuitoHija = redondear2((montosCabAgr.gratuito || 0) * propSub);
      const otrosCargosHija = redondear2((montosCabAgr.otrosCargos || 0) * propSub);
      if (!usarDescuentoEnTotal) {
        descuentosHija = 0;
      } else if (
        Number.isFinite(descuentosClienteAgr) &&
        descuentosClienteAgr >= 0 &&
        (Number(totalesAgrupados.subtotal) || 0) > 0
      ) {
        const prop =
          (Number(totalesEmpresa.subtotal) || 0) / (Number(totalesAgrupados.subtotal) || 1);
        descuentosHija = Math.round(descuentosClienteAgr * prop * 100) / 100;
      }

      const ventaDatos = {
        idSucursal: idSucursalEmpresa,
        serie, numero, compVenta,
        idComprobante: idComprobanteDestino,
        fEmision: fechaEmisionConHora,
        fVencimiento: fVencimientoSQL,
        idCliente: idClienteEmpresa,
        idMoneda: venta.idMoneda || 1,
        tCambio: venta.tCambio || 1,
        subtotal: totalesEmpresa.subtotal,
        igv: igvHija,
        exonerado: exoneradoHija,
        gratuito: gratuitoHija,
        otrosCargos: otrosCargosHija,
        descuentos: descuentosHija,
        total: totalesEmpresa.total,
        idMediosPago: ventaConHora.idMediosPago,
        idEstadoPedido: idEstadoPedidoVenta,
        idEstadoPago,
        idEstadoSunat: esNotaVenta ? 0 : (venta.idEstadoSunat || 0),
        compRelacionado: venta.compRelacionado || null,
        observaciones: venta.observaciones || null,
        idVentaAgrupada
      };

      const ventaResult = await ventasRepository.insertar(transaction, ventaDatos, idEmpresaProducto, idUsuarioEmpresa);
      const idVenta = ventaResult.recordset[0].idVenta;

      for (const det of dets) {
        const cantPedida = parseFloat(det.cantidad) || 0;
        const cantEntregada = esEstadoPendiente ? 0 : (det.cantEntregada != null ? Number(det.cantEntregada) : det.cantidad);

        const stockDisponible = await stockService.obtenerStockDisponible(transaction, idEmpresaProducto, det.idProducto, idSucursalEmpresa);
        if (stockDisponible < cantPedida) {
          if (!permitirVentasNegativas) {
            throw new Error(`Stock insuficiente para "${det.descripcion || det.idProducto}" en empresa ${det.aliasEmpresa || idEmpresaProducto}. Disponible: ${stockDisponible}, solicitado: ${cantPedida}.`);
          }
          avisoStockInsuficiente.push({ idProducto: det.idProducto, cantidadSolicitada: cantPedida, cantidadDisponible: stockDisponible });
        }

        const cantidadADescontar = permitirVentasNegativas ? Math.min(cantPedida, stockDisponible) : cantPedida;
        let consumosPorLote = [];
        if (cantidadADescontar > 0) {
          const resultadoDescuento = await stockService.descontarDesdeLotes(transaction, {
            idEmpresa: idEmpresaProducto,
            idSucursal: idSucursalEmpresa,
            idProducto: det.idProducto,
            cantidad: cantidadADescontar
          }, { controlUbicaciones });
          consumosPorLote = resultadoDescuento?.consumosPorLote || [];
        }

        const costoTotalLinea = Array.isArray(consumosPorLote)
          ? consumosPorLote.reduce((acc, c) => acc + (Number(c.cantidadTomada) || 0) * (Number(c.costoUnitario) || 0), 0)
          : 0;
        const costoUnitarioProm = cantPedida > 0 ? (costoTotalLinea / cantPedida) : 0;

        await detalleVentaService.crearDetalle(transaction, {
          ...det,
          idVenta,
          cantEntregada,
          idEstadoPedido: idEstadoPedidoVenta,
          hVenta: getNowLocalSQLString(),
          costoUnitario: costoUnitarioProm,
          costoTotal: costoTotalLinea
        });
        det._costoUnitario = costoUnitarioProm;
        det._costoTotal = costoTotalLinea;
        det._cantEntregada = cantEntregada;

        if (cantidadADescontar > 0) {
          if (Array.isArray(consumosPorLote) && consumosPorLote.length > 0) {
            for (const c of consumosPorLote) {
              const cantTomada = Number(c.cantidadTomada) || 0;
              if (cantTomada <= 0) continue;
              await inventarioRepository.insertarFilaMovimiento(transaction, {
                idEmpresa: idEmpresaProducto,
                idSucursal: idSucursalEmpresa,
                idProducto: det.idProducto,
                tipoMovimiento: 'SA',
                cantidad: cantTomada,
                docRelacionado: compVenta,
                idComprobante: idComprobanteDestino,
                idUsuario: idUsuarioEmpresa,
                observaciones: 'Venta',
                costoUnitario: c.costoUnitario != null ? Number(c.costoUnitario) : costoUnitarioProm,
                idLote: c.idLote || null
              });
            }
          } else {
            await inventarioRepository.insertarFilaMovimiento(transaction, {
              idEmpresa: idEmpresaProducto,
              idSucursal: idSucursalEmpresa,
              idProducto: det.idProducto,
              tipoMovimiento: 'SA',
              cantidad: cantidadADescontar,
              docRelacionado: compVenta,
              idComprobante: idComprobanteDestino,
              idUsuario: idUsuarioEmpresa,
              observaciones: 'Venta',
              costoUnitario: costoUnitarioProm,
              idLote: null
            });
          }
        }
      }

      if (!esNotaVenta) {
        await facturacionRepository.registrarComprobanteElectronicoPorVentaRepo(
          transaction, idEmpresaProducto, idVenta, idComprobanteDestino, serie, numero, fechaEmisionConHora
        );
      }

      const ventaEmpresaRow = await ventasRepository.insertarVentaEmpresa(transaction, {
        idVentaAgrupada,
        idEmpresa: idEmpresaProducto,
        idVenta,
        idComprobante: idComprobanteDestino,
        serie, numero, compVenta,
        fEmision: fechaEmisionConHora,
        fVencimiento: fVencimientoSQL,
        idCliente: idClienteEmpresa,
        idMoneda: venta.idMoneda || 1,
        tCambio: venta.tCambio || 1,
        subtotal: totalesEmpresa.subtotal,
        igv: igvHija,
        exonerado: exoneradoHija,
        gratuito: gratuitoHija,
        otrosCargos: otrosCargosHija,
        descuentos: descuentosHija,
        total: totalesEmpresa.total,
        idMediosPago: ventaConHora.idMediosPago,
        idEstadoPedido: idEstadoPedidoVenta,
        idEstadoPago,
        idEstadoSunat: esNotaVenta ? 0 : (venta.idEstadoSunat || 0),
        tipoComprobante: codigoComprobante || 'NV',
        compRelacionado: venta.compRelacionado || null,
        observaciones: venta.observaciones || null,
        idUsuario: user.sub
      });

      const idVentaEmpresa = ventaEmpresaRow?.idVentaEmpresa;
      if (idVentaEmpresa) {
        for (const det of dets) {
          await ventasRepository.insertarDetalleVentaEmpresa(transaction, {
            idVentaEmpresa,
            idProducto: det.idProducto,
            cantidad: Number(det.cantidad) || 0,
            pVenta: Number(det.pVenta) || 0,
            descuento: det.descuento || 0,
            subtotal: det.subtotal || (Number(det.cantidad) || 0) * (Number(det.pVenta) || 0),
            igv: det.igv ? 1 : 0,
            isc: det.isc ? 1 : 0,
            total: det.total || (Number(det.cantidad) || 0) * (Number(det.pVenta) || 0),
            cantEntregada: det._cantEntregada != null ? det._cantEntregada : 0,
            idEstadoPedido: idEstadoPedidoVenta,
            costoUnitario: det._costoUnitario || 0,
            costoTotal: det._costoTotal || 0
          });
        }
      }

      ventasEmpresa.push({
        idEmpresa: idEmpresaProducto,
        idVenta,
        idCliente: idClienteEmpresa,
        codigoComprobante,
        compVenta,
        total: totalesEmpresa.total,
        idSucursal: idSucursalEmpresa,
      });
    }

    // --- Auditoria: registrar CREACION ---
    await ventasRepository.insertarVentaAgrupadaLog(transaction, {
      idVentaAgrupada,
      evento: 'CREACION',
      compVA: compVentaVA,
      totalVA: totalesAgrupados.total,
      sumaVentasHijas: sumaHijasTotal,
      idUsuario: user.sub,
      detalle: `VA ${compVentaVA}, tipo destino: ${tipoComprobanteDestino}, empresas: ${ventasEmpresa.length}`
    });

    // --- Créditos (CuotasCredito) desde medios "crédito" en detallePago; antes de caja ---
    if (detallePago && Array.isArray(detallePago) && detallePago.length > 0 && ventasEmpresa.length > 0) {
      const ventaCreditoPostVentaService = require('./ventaCreditoPostVenta.service');
      await ventaCreditoPostVentaService.crearCreditosDesdeVentaAgrupada(transaction, {
        ventasEmpresa,
        detallePago,
        cuotasCredito: Array.isArray(cuotasCredito) ? cuotasCredito : [],
        userSub: user.sub,
        fVencimientoCabecera: venta.fVencimiento,
      });
    }

    // --- Caja + detalle pago: reparto por comprobante/empresa (solo medios que no son crédito) ---
    if (detallePago && Array.isArray(detallePago) && detallePago.length > 0) {
      if (ventasEmpresa.length === 0) {
        throw new Error('No hay ventas hijas para asociar el pago y el movimiento de caja.');
      }
      const ventaAgrupadaCobroService = require('./ventaAgrupadaCobro.service');
      await ventaAgrupadaCobroService.aplicarCobroVentasAgrupadasMulticompania(pool, transaction, {
        lineasVenta: ventasEmpresa.map((v) => ({
          idVenta: v.idVenta,
          idEmpresa: v.idEmpresa,
          compVenta: v.compVenta,
          total: v.total,
          idSucursal: v.idSucursal,
        })),
        detallePago,
        idEmpresaCobradora: user.empresa,
        idUsuario: user.sub,
        compVentaVA: compVentaVA,
        idAperturaGestoraOpcional: idApertura || null,
        idSucursalGestoraFallback: idSucursalCobradora,
      });
    }

    await transaction.commit();
    if (detallePago && Array.isArray(detallePago) && detallePago.length > 0) {
      for (const ve of ventasEmpresa) {
        sunatPostPagoService.encolarTrasConfirmarPago(pool, ve.idVenta, ve.idEmpresa);
      }
    }
    return {
      idVentaAgrupada,
      compVentaVA,
      ventasEmpresa,
      avisoStockInsuficiente: avisoStockInsuficiente.length > 0
        ? 'Stock insuficiente para uno o más productos. Se descontó solo el disponible.'
        : null
    };
  } catch (error) {
    try { await transaction.rollback(); } catch (_) {}
    throw error;
  }
  });
};

/**
 * Crea una venta (Factura/Boleta) a partir de un vale de despacho (liquidación).
 * No descuenta stock; actualiza ValesDespacho.idVentaLiquidacion.
 * transaction ya iniciada; idEmpresa e idUsuario del JWT.
 * @param {object} transaction - Transacción SQL
 * @param {object} pool - Pool SQL (para obtener vale y detalle)
 * @param {string} idEmpresa - UUID empresa
 * @param {string} idUsuario - UUID usuario
 * @param {{ idValeDespacho: string, idComprobante: number }} payload - idComprobante = Factura o Boleta (elegido por usuario)
 * @returns {{ idVenta: number, compVenta: string }}
 */
exports.crearVentaDesdeVale = async (transaction, pool, idEmpresa, idUsuario, payload) => {
  const { idValeDespacho, idComprobante } = payload;
  if (!idValeDespacho || idComprobante == null) {
    throw new Error('Faltan idValeDespacho o idComprobante (Factura/Boleta).');
  }

  const vale = await valesDespachoRepository.obtenerPorId(pool, idValeDespacho, idEmpresa);
  if (!vale) throw new Error('Vale de despacho no encontrado.');
  if (String(vale.estado || '').toUpperCase() === 'ANULADO') {
    throw new Error('No se puede liquidar un vale anulado.');
  }
  if (vale.idVentaLiquidacion != null) {
    throw new Error('El vale ya fue liquidado.');
  }

  const detalleVale = await valesDespachoRepository.listarDetalle(pool, idValeDespacho, idEmpresa);
  if (!detalleVale || detalleVale.length === 0) {
    throw new Error('El vale no tiene detalle.');
  }

  const { numero, serie } = await ventasRepository.obtenerSiguienteNumeroComprobante(transaction, idEmpresa, idComprobante);
  const compVenta = serie + '-' + numero;
  const totalVenta = detalleVale.reduce((sum, d) => sum + (Number(d.total) || 0), 0);
  const fEmision = getNowLocalSQLString();

  const datosVenta = {
    idSucursal: vale.idSucursal,
    serie,
    numero,
    compVenta,
    idComprobante,
    fEmision,
    fVencimiento: fEmision,
    idCliente: vale.idCliente,
    idMoneda: 1,
    tCambio: 1,
    subtotal: totalVenta,
    igv: 0,
    exonerado: 0,
    gratuito: 0,
    otrosCargos: 0,
    descuentos: 0,
    total: totalVenta,
    idMediosPago: '1',
    idEstadoPedido: 2,
    idEstadoPago: 1,
    idEstadoSunat: 0,
    compRelacionado: vale.compVale || null,
    observaciones: null,
    idUsuario
  };

  const ventaResult = await ventasRepository.insertar(transaction, datosVenta, idEmpresa, idUsuario);
  const idVenta = ventaResult.recordset[0].idVenta;

  for (const d of detalleVale) {
    const cantidad = Number(d.cantidad) || 0;
    const pVenta = Number(d.pUnitario) || 0;
    const subtotal = cantidad * pVenta;
    await detalleVentaService.crearDetalle(transaction, {
      idVenta,
      idProducto: d.idProducto,
      cantidad,
      pVenta,
      descuento: 0,
      subtotal,
      igv: 0,
      isc: 0,
      total: subtotal,
      hVenta: fEmision,
      cantEntregada: cantidad,
      idEstadoPedido: 2,
      costoUnitario: 0,
      costoTotal: 0
    });
  }

  await facturacionRepository.registrarComprobanteElectronicoPorVentaRepo(
    transaction,
    idEmpresa,
    idVenta,
    idComprobante,
    serie,
    numero,
    fEmision
  );

  await valesDespachoRepository.actualizarVentaLiquidacion(transaction, idValeDespacho, idEmpresa, idVenta);

  return { idVenta, compVenta };
};
