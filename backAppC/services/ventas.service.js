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
const {
  getNowLocalSQLString,
  getFechaSoloSQLString,
  parseFEmisionCabeceraSQL,
  resolveFechaHoraClienteSql,
  parteFechaDesdeFEmisionInput
} = require('../utils/fechaHoraLocal.util');
const {
  interpretarBooleanoConfig,
  leerPermitirVentasNegativas,
  crearLectorConfiguracionEmpresa
} = require('../utils/configBoolean.util');
const sunatPostPagoService = require('./sunatPostPago.service');
const saasPlanLimitesService = require('./saasPlanLimites.service');
const ventaLineaInventarioService = require('./ventaLineaInventario.service');
const { resolverIdComprobanteParaSucursal, idSucursalComprobantesEfectiva } = require('../utils/sucursalComprobantes.util');
const comprobantesRepository = require('../repositories/comprobantes.repository');
const ventasDetalleReporteRepository = require('../repositories/ventasDetalleReporte.repository');
const usuarioSucursalRepository = require('../repositories/usuarioSucursal.repository');
const { idUsuarioDesdePayloadUser } = require('../utils/idUsuarioSesion.util');

/**
 * idDireccionClientes del body para persistir en Ventas (DireccionClientes del mismo contexto).
 * Si no viene o es inválido, undefined (el repositorio inserta NULL).
 */
function idDireccionClientesDesdeBody(body) {
  if (!body || body.idDireccionClientes == null || body.idDireccionClientes === '') return undefined;
  const n = Number(body.idDireccionClientes);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const FLAGS_INVENTARIO_DEFECTO = Object.freeze({
  permitirVentasNegativas: false,
  controlUbicaciones: true
});

/** Flags de inventario por empresa (ConfiguracionEmpresa), clave = idEmpresa en minúsculas. */
async function cargarFlagsInventarioPorEmpresas(pool, idsEmpresa) {
  const cache = new Map();
  const unicos = [...new Set((idsEmpresa || []).filter(Boolean).map(String))];
  for (const idEmpresa of unicos) {
    const key = idEmpresa.toLowerCase();
    if (cache.has(key)) continue;
    const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa);
    const getConfig = crearLectorConfiguracionEmpresa(configRows);
    cache.set(key, {
      permitirVentasNegativas: leerPermitirVentasNegativas(getConfig),
      controlUbicaciones: interpretarBooleanoConfig(getConfig('INVENTARIO_CONTROL_UBICACIONES', 'true'), true)
    });
  }
  return cache;
}

/** VENTAS_USAR_DESCUENTO_EN_TOTAL por empresa; clave = idEmpresa en minúsculas. */
async function cargarDescuentoVentaPorEmpresas(pool, idsEmpresa) {
  const cache = new Map();
  const unicos = [...new Set((idsEmpresa || []).filter(Boolean).map(String))];
  for (const idEmpresa of unicos) {
    const key = idEmpresa.toLowerCase();
    if (cache.has(key)) continue;
    const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa);
    const getConfig = crearLectorConfiguracionEmpresa(configRows);
    cache.set(
      key,
      interpretarBooleanoConfig(getConfig('VENTAS_USAR_DESCUENTO_EN_TOTAL', 'true'), true)
    );
  }
  return cache;
}

function descuentoVentaEmpresa(cache, idEmpresa, predeterminado = true) {
  if (idEmpresa == null || String(idEmpresa).trim() === '') return predeterminado;
  const val = cache.get(String(idEmpresa).toLowerCase());
  return typeof val === 'boolean' ? val : predeterminado;
}

function flagsInventarioEmpresa(cache, idEmpresa) {
  if (idEmpresa == null || String(idEmpresa).trim() === '') return FLAGS_INVENTARIO_DEFECTO;
  return cache.get(String(idEmpresa).toLowerCase()) || FLAGS_INVENTARIO_DEFECTO;
}

/** True si la gestora o la empresa del producto tienen activado INVENTARIO_PERMITIR_VENTAS_NEGATIVAS. */
function permitirVentasNegativasEfectivo(cache, ...idsEmpresa) {
  for (const id of idsEmpresa) {
    if (flagsInventarioEmpresa(cache, id).permitirVentasNegativas) return true;
  }
  return false;
}

/** Empresa del token + gestionadas activas (mismo alcance que comprobante PDF / listados gestora). */
async function idsEmpresaJwtYGestionadas(pool, idEmpresaUsuario) {
  const ids = new Set();
  if (idEmpresaUsuario) ids.add(String(idEmpresaUsuario));
  try {
    const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaUsuario);
    for (const g of gestionadas || []) {
      if (g.idEmpresa) ids.add(String(g.idEmpresa));
    }
  } catch (_) {
    /* solo JWT */
  }
  return Array.from(ids);
}

/** Inserta cabecera de venta dentro de una transacción ya iniciada. */
exports.insertarVentaCabecera = async (transaction, datosVenta, idEmpresa, idUsuario) => {
  return await ventasRepository.insertar(transaction, datosVenta, idEmpresa, idUsuario);
};

/**
 * Crea cabecera de venta en una transacción propia (commit/rollback).
 * Usado por POST crear venta legacy del controlador.
 */
exports.crearVentaCabeceraConTransaccion = async (pool, datosVenta, idEmpresa, idUsuario) => {
  await saasPlanLimitesService.assertPuedeCrearVenta(pool, idEmpresa);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const ventaResult = await ventasRepository.insertar(transaction, datosVenta, idEmpresa, idUsuario);
    await transaction.commit();
    return ventaResult?.recordset?.[0]?.idVenta ?? null;
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

/**
 * Normaliza fEmision para guardar en BD.
 * Prioridad: fecha+hora enviada por el cliente (navegador del cajero); no reemplazar la hora por la del servidor.
 */
function fechaEmisionConHoraActual(fEmision) {
  const raw = fEmision != null ? String(fEmision).trim() : '';
  if (raw && /[T ]\d{2}:\d{2}:\d{2}/.test(raw)) {
    const sql = parseFEmisionCabeceraSQL(fEmision);
    if (sql) return sql;
  }
  if (raw) {
    const sqlSoloFecha = parseFEmisionCabeceraSQL(fEmision);
    if (sqlSoloFecha) return sqlSoloFecha;
  }
  const parteFecha = parteFechaDesdeFEmisionInput(fEmision);
  if (parteFecha) {
    return getFechaSoloSQLString(parteFecha);
  }
  return getNowLocalSQLString();
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

/** Si la empresa tiene permitirVentaMultiSucursal, una VA puede generar varias facturas/boletas hijas (una por sucursal). */
const leerPermitirVentaMultiSucursal = async (transaction, idEmpresa) => {
  const r = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT ISNULL(permitirVentaMultiSucursal, 0) AS v FROM Empresas WHERE idEmpresa = @idEmpresa');
  const row = r.recordset?.[0];
  return !!(row && (row.v === true || row.v === 1));
};

/** En venta POS restringida, usuario no-admin debe operar en una sucursal asignada y activa. */
const assertAccesoUsuarioASucursal = async (transaction, user, idEmpresa, idSucursal) => {
  if (!idSucursal) return;
  if (user && user.rol === 'Administrador') return;
  const idUsuario = idUsuarioDesdePayloadUser(user);
  if (!idUsuario) return;
  const asignadas = await usuarioSucursalRepository.obtenerSucursalesActivasUsuario(transaction, idUsuario, idEmpresa);
  if (!Array.isArray(asignadas) || asignadas.length === 0) {
    throw new Error('Su usuario no tiene sucursales activas asignadas. Solicite la asignación al administrador.');
  }
  const ok = asignadas.some((s) => String(s.idSucursal || '').toLowerCase() === String(idSucursal).toLowerCase());
  if (!ok) {
    throw new Error('No tiene acceso a la sucursal seleccionada para esta venta.');
  }
};

/** Resuelve idSucursal por línea (cabecera explícita → stock del producto → sucursal por defecto). */
const enriquecerDetallesConSucursalEmpresaDestino = async (transaction, idEmpresaProducto, detsRaw) => {
  const out = [];
  for (const det of detsRaw) {
    let idS = det.idSucursalEmpresa || null;
    if (idS && !(await validarSucursalEmpresa(transaction, idEmpresaProducto, idS))) {
      idS = null;
    }
    if (!idS && det.idProducto) {
      idS = await obtenerSucursalPreferentePorProducto(transaction, idEmpresaProducto, String(det.idProducto));
    }
    if (!idS) {
      idS = await obtenerSucursalPorEmpresa(transaction, idEmpresaProducto);
    }
    if (!idS) {
      throw new Error('No se pudo determinar la sucursal de la empresa destino.');
    }
    out.push({ ...det, idSucursalEmpresa: idS });
  }
  return out;
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
    // POS puede mandar IGV en cabecera (p. ej. precio incluye IGV) aunque las líneas
    // no desglosen bien: no descartar el IGV gravado si el total cuadra.
    if (igvCab > EPS_FISCAL && totCab > EPS_FISCAL && (totOkSinIgvExtra || totOkConIgv)) {
      const subPreferido =
        subCab > EPS_FISCAL ? subCab : redondear2(Math.max(0, totCab - igvCab));
      return {
        subtotal: subPreferido,
        igv: igvCab,
        exonerado: 0,
        gratuito: gratCab > EPS_FISCAL ? gratCab : gratDet,
        otrosCargos: otrCab > EPS_FISCAL ? otrCab : otrDet,
        total: totCab
      };
    }
    return {
      subtotal: subDet,
      igv: igvDet,
      exonerado: exoDet,
      gratuito: gratDet,
      otrosCargos: otrDet,
      total: totDet
    };
  }

  // Preferir IGV de cabecera cuando el POS lo informa (comprobante gravado).
  let igv = igvCab > EPS_FISCAL ? igvCab : igvDet;
  if (igvDet > EPS_FISCAL && igvCab <= EPS_FISCAL) {
    igv = igvDet;
  }

  let exonerado = exoCab > EPS_FISCAL ? exoCab : exoDet;
  if (redondear2(igv) > EPS_FISCAL) {
    exonerado = 0;
  } else if (exoCab <= EPS_FISCAL && redondear2(igv) <= EPS_FISCAL) {
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

  await saasPlanLimitesService.assertPuedeCrearVenta(pool, user.empresa);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, user.empresa);
    const getConfig = crearLectorConfiguracionEmpresa(configRows);
    const permitirVentasNegativas = leerPermitirVentasNegativas(getConfig);
    const controlUbicaciones = interpretarBooleanoConfig(getConfig('INVENTARIO_CONTROL_UBICACIONES', 'true'), true);
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

    const idsCirculoCliente = await idsEmpresaJwtYGestionadas(pool, user.empresa);

    const clienteSeleccionado = await ventasRepository.obtenerClientePorIdEnEmpresas(
      transaction,
      venta.idCliente,
      idsCirculoCliente
    );
    if (!clienteSeleccionado) {
      throw new Error('Cliente no encontrado.');
    }
    const idClienteEmpresa = clienteSeleccionado.idCliente;
    const idUsuarioEmpresa = user.sub;

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
    await assertAccesoUsuarioASucursal(transaction, user, user.empresa, idSucursalLinea);

    const resComp = await resolverIdComprobanteParaSucursal(
      transaction,
      user.empresa,
      idComprobanteSolicitado,
      idSucursalLinea
    );
    if (!resComp) {
      throw new Error('El comprobante seleccionado no existe para esta sucursal o no está autorizado.');
    }
    const idComprobanteDestino = resComp.idComprobante;
    const codigoComprobante = (resComp.codigo || '').trim().toUpperCase();
    if (codigoComprobante === 'F7' || codigoComprobante === 'B7' || codigoComprobante === 'F8' || codigoComprobante === 'B8') {
      throw new Error('Las notas de crédito/débito (F7/B7/F8/B8) no se emiten desde el punto de venta; use el módulo de notas de crédito / débito.');
    }
    const esNotaVenta = codigoComprobante === 'NV';

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

    let idDirInsert = idDireccionClientesDesdeBody(venta);
    if (idDirInsert === undefined && idClienteEmpresa) {
      idDirInsert = await ventasRepository.obtenerIdDireccionClientePreferidoParaVenta(
        transaction,
        idsCirculoCliente,
        idClienteEmpresa,
        user.empresa
      );
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
      observaciones: venta.observaciones || null,
      idDireccionClientes: idDirInsert
    };

    const ventaResult = await ventasRepository.insertar(transaction, ventaDatos, user.empresa, idUsuarioEmpresa);
    const idVenta = ventaResult.recordset[0].idVenta;

    const avisoStockInsuficiente = [];
    const metaInventarioCache = new Map();

    for (const det of dets) {
      const cantPedida = parseFloat(det.cantidad) || 0;
      const cantEntregada = esEstadoPendiente ? 0 : (det.cantEntregada != null ? Number(det.cantEntregada) : det.cantidad);

      const salida = await ventaLineaInventarioService.procesarSalidaInventarioVentaLinea({
        transaction,
        idEmpresa: user.empresa,
        idSucursal: idSucursalLinea,
        idProducto: det.idProducto,
        cantPedida,
        descripcion: det.descripcion,
        permitirVentasNegativas,
        controlUbicaciones,
        cache: metaInventarioCache
      });
      if (salida.avisoStock) {
        avisoStockInsuficiente.push(salida.avisoStock);
      }

      await detalleVentaService.crearDetalle(transaction, {
        ...det,
        idVenta,
        cantEntregada,
        idEstadoPedido: idEstadoPedidoVenta,
        hVenta: fechaEmisionConHora,
        costoUnitario: salida.costoUnitarioProm,
        costoTotal: salida.costoTotalLinea
      });
      det._costoUnitario = salida.costoUnitarioProm;
      det._costoTotal = salida.costoTotalLinea;
      det._cantEntregada = cantEntregada;

      await ventaLineaInventarioService.registrarMovimientosSalidaVenta({
        transaction,
        idEmpresa: user.empresa,
        idSucursal: idSucursalLinea,
        idProducto: det.idProducto,
        idUsuario: idUsuarioEmpresa,
        compVenta,
        idComprobante: idComprobanteDestino,
        controlaInventario: salida.controlaInventario,
        cantidadADescontar: salida.cantidadADescontar,
        consumosPorLote: salida.consumosPorLote,
        costoUnitarioProm: salida.costoUnitarioProm
      });
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
      fEmision: fechaEmisionConHora,
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
          fEmision: v.fEmision,
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
        ? 'Stock insuficiente para uno o más productos. La venta se registró y el inventario puede quedar en negativo según configuración.'
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

  await saasPlanLimitesService.assertPuedeCrearVenta(pool, user.empresa);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const configRowsGestora = await gestoresRepository.obtenerConfiguracionEmpresa(pool, user.empresa);
    const getConfigGestora = crearLectorConfiguracionEmpresa(configRowsGestora);
    const usarDescuentoEnTotalGestora = interpretarBooleanoConfig(
      getConfigGestora('VENTAS_USAR_DESCUENTO_EN_TOTAL', 'true'),
      true
    );

    let idSucursalCobradora = venta.idSucursal || null;
    if (!idSucursalCobradora) {
      idSucursalCobradora = await obtenerSucursalPorEmpresa(transaction, user.empresa);
    }
    if (!idSucursalCobradora) {
      throw new Error('No se pudo determinar la sucursal de la empresa cobradora.');
    }
    await assertAccesoUsuarioASucursal(transaction, user, user.empresa, idSucursalCobradora);

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

    const flagsInventarioCache = await cargarFlagsInventarioPorEmpresas(pool, [
      user.empresa,
      ...Array.from(detallesPorEmpresa.keys())
    ]);
    const descuentoVentaCache = await cargarDescuentoVentaPorEmpresas(pool, [
      user.empresa,
      ...Array.from(detallesPorEmpresa.keys())
    ]);

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
    const rowVa = await comprobantesRepository.obtenerComprobantePorCodigoRepo(
      transaction,
      user.empresa,
      'VA',
      idSucursalCobradora
    );
    const idComprobanteVA = rowVa?.idComprobante;
    if (!idComprobanteVA) {
      throw new Error('Comprobante "Venta Agrupada" (VA) no configurado en la empresa gestora. Ejecute la migración.');
    }

    const vaCorrelativo = await ventasRepository.obtenerSiguienteNumeroComprobante(transaction, user.empresa, idComprobanteVA);
    const compVentaVA = vaCorrelativo.serie + '-' + vaCorrelativo.numero;

    const totalesAgrupados = calcularTotales(detalles);
    const montosCabAgr = resolverMontosCabeceraImpuestos(ventaConHora, totalesAgrupados);
    const descuentosClienteAgr = Number(venta.descuentos);
    let descuentosCabeceraVA = totalesAgrupados.descuentos;
    if (Number.isFinite(descuentosClienteAgr) && descuentosClienteAgr >= 0) {
      descuentosCabeceraVA = Math.round(descuentosClienteAgr * 100) / 100;
    } else if (!usarDescuentoEnTotalGestora) {
      descuentosCabeceraVA = 0;
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
    let sumaHijasTotal = 0;

    for (const [idEmpresaStr, dets] of detallesPorEmpresa.entries()) {
      const idEmpresaProducto = idEmpresaStr;
      const permitirMultiSuc = await leerPermitirVentaMultiSucursal(transaction, idEmpresaProducto);
      const detsConSucursal = await enriquecerDetallesConSucursalEmpresaDestino(transaction, idEmpresaProducto, dets);
      const porSucursal = new Map();
      for (const d of detsConSucursal) {
        const k = String(d.idSucursalEmpresa).toLowerCase();
        if (!porSucursal.has(k)) porSucursal.set(k, []);
        porSucursal.get(k).push(d);
      }
      if (porSucursal.size > 1 && !permitirMultiSuc) {
        throw new Error(
          'No se permite más de una sucursal por empresa en una misma venta. ' +
            'Active en la empresa destino la opción "Permitir venta multi-sucursal" (Empresas.permitirVentaMultiSucursal) ' +
            'o venda por sucursal en operaciones separadas.'
        );
      }

      for (const detsPart of porSucursal.values()) {
        const idSucursalEmpresa = detsPart[0].idSucursalEmpresa;

        const idUsuarioEmpresa = await asegurarUsuarioEmpresaDestino(
          transaction, idEmpresaProducto, user.empresa, user
        );

        const idClienteEmpresa = await asegurarClienteEmpresaConBase(
          transaction, idEmpresaProducto, clienteSeleccionado
        );
        if (!idClienteEmpresa) {
          throw new Error('No se pudo determinar el cliente para la empresa destino.');
        }

        const idSucCompDest = await idSucursalComprobantesEfectiva(transaction, idSucursalEmpresa);
        const rCompDestino = await transaction.request()
          .input('codigo', sql.VarChar(2), tipoComprobanteDestino.slice(0, 2))
          .input('idEmpresa', sql.UniqueIdentifier, idEmpresaProducto)
          .input('idSuc', sql.UniqueIdentifier, idSucCompDest)
          .query('SELECT idComprobante, codigo FROM Comprobantes WHERE codigo = @codigo AND idEmpresa = @idEmpresa AND idSucursal = @idSuc');
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

        const totalesEmpresa = calcularTotales(detsPart);
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
      const usarDescuentoEmpresa = descuentoVentaEmpresa(
        descuentoVentaCache,
        idEmpresaProducto,
        usarDescuentoEnTotalGestora
      );
      if (!usarDescuentoEmpresa) {
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

      let idDirHija = idDireccionClientesDesdeBody(venta);
      if (idDirHija === undefined && idClienteEmpresa) {
        idDirHija = await ventasRepository.obtenerIdDireccionClientePreferidoParaVenta(
          transaction,
          Array.from(empresasPermitidas),
          idClienteEmpresa,
          idEmpresaProducto
        );
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
        idVentaAgrupada,
        idDireccionClientes: idDirHija
      };

      const ventaResult = await ventasRepository.insertar(transaction, ventaDatos, idEmpresaProducto, idUsuarioEmpresa);
      const idVenta = ventaResult.recordset[0].idVenta;

      const metaInventarioCachePart = new Map();

      for (const det of detsPart) {
        const cantPedida = parseFloat(det.cantidad) || 0;
        const cantEntregada = esEstadoPendiente ? 0 : (det.cantEntregada != null ? Number(det.cantEntregada) : det.cantidad);

        const flagsInvProducto = flagsInventarioEmpresa(flagsInventarioCache, idEmpresaProducto);
        const permitirNegativoLinea = permitirVentasNegativasEfectivo(
          flagsInventarioCache,
          user.empresa,
          idEmpresaProducto
        );

        const salida = await ventaLineaInventarioService.procesarSalidaInventarioVentaLinea({
          transaction,
          idEmpresa: idEmpresaProducto,
          idSucursal: idSucursalEmpresa,
          idProducto: det.idProducto,
          cantPedida,
          descripcion: det.descripcion || det.aliasEmpresa,
          permitirVentasNegativas: permitirNegativoLinea,
          controlUbicaciones: flagsInvProducto.controlUbicaciones,
          cache: metaInventarioCachePart
        });
        if (salida.avisoStock) {
          avisoStockInsuficiente.push(salida.avisoStock);
        }

        await detalleVentaService.crearDetalle(transaction, {
          ...det,
          idVenta,
          cantEntregada,
          idEstadoPedido: idEstadoPedidoVenta,
          hVenta: fechaEmisionConHora,
          costoUnitario: salida.costoUnitarioProm,
          costoTotal: salida.costoTotalLinea
        });
        det._costoUnitario = salida.costoUnitarioProm;
        det._costoTotal = salida.costoTotalLinea;
        det._cantEntregada = cantEntregada;

        await ventaLineaInventarioService.registrarMovimientosSalidaVenta({
          transaction,
          idEmpresa: idEmpresaProducto,
          idSucursal: idSucursalEmpresa,
          idProducto: det.idProducto,
          idUsuario: idUsuarioEmpresa,
          compVenta,
          idComprobante: idComprobanteDestino,
          controlaInventario: salida.controlaInventario,
          cantidadADescontar: salida.cantidadADescontar,
          consumosPorLote: salida.consumosPorLote,
          costoUnitarioProm: salida.costoUnitarioProm
        });
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
        for (const det of detsPart) {
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
        fEmision: fechaEmisionConHora,
      });
      }
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
          fEmision: v.fEmision,
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
        ? 'Stock insuficiente para uno o más productos. La venta se registró y el inventario puede quedar en negativo según configuración.'
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
  const { idValeDespacho, idComprobante, fEmision: fEmisionCliente } = payload;
  if (!idValeDespacho || idComprobante == null) {
    throw new Error('Faltan idValeDespacho o idComprobante (Factura/Boleta).');
  }

  await saasPlanLimitesService.assertPuedeCrearVenta(pool, idEmpresa);

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

  const resCompVale = await resolverIdComprobanteParaSucursal(
    transaction,
    idEmpresa,
    idComprobante,
    vale.idSucursal
  );
  if (!resCompVale) {
    throw new Error('El comprobante de liquidación no existe para la sucursal del vale.');
  }
  const idComprobanteLiquidacion = resCompVale.idComprobante;

  const { numero, serie } = await ventasRepository.obtenerSiguienteNumeroComprobante(
    transaction,
    idEmpresa,
    idComprobanteLiquidacion
  );
  const compVenta = serie + '-' + numero;
  const totalVenta = detalleVale.reduce((sum, d) => sum + (Number(d.total) || 0), 0);
  const fEmision = resolveFechaHoraClienteSql(fEmisionCliente);

  const datosVenta = {
    idSucursal: vale.idSucursal,
    serie,
    numero,
    compVenta,
    idComprobante: idComprobanteLiquidacion,
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

function abreviaturaComprobanteVenta(codigo, nombre) {
  const c = String(codigo || '').trim();
  if (c === '01') return 'FC';
  if (c === '03') return 'BC';
  if (c === '07') return 'NC';
  if (c === '08') return 'ND';
  const n = String(nombre || '').toLowerCase();
  if (n.includes('factura')) return 'FC';
  if (n.includes('boleta')) return 'BC';
  if (n.includes('crédito') || n.includes('credito')) return 'NC';
  if (n.includes('débito') || n.includes('debito')) return 'ND';
  return 'DOC';
}

function etiquetaEstadoVenta(descripcion) {
  const d = String(descripcion || '').trim().toLowerCase();
  if (d.includes('pagad')) return 'CONFIRMADO';
  if (d.includes('pendient')) return 'PENDIENTE';
  return String(descripcion || '—').toUpperCase();
}

function etiquetaDocumentoVenta(row) {
  const abrev = abreviaturaComprobanteVenta(row.codigoComprobante, row.tipoComprobante);
  const comp = String(row.compVenta || '').trim();
  if (comp) return `${abrev} ${comp}`;
  const serie = String(row.serie || '').trim();
  const numero = row.numero != null ? String(row.numero).trim() : '';
  if (serie || numero) return `${abrev} ${serie}-${numero}`;
  return abrev;
}

function agruparLineasReporteVentasDetallado(lineas) {
  const map = new Map();
  for (const row of lineas || []) {
    const key = String(row.idVenta);
    if (!map.has(key)) {
      map.set(key, {
        idVenta: row.idVenta,
        cliente: String(row.rSocial || ''),
        ruc: String(row.ruc || ''),
        documento: etiquetaDocumentoVenta(row),
        fecha: String(row.fEmision || ''),
        estado: etiquetaEstadoVenta(row.estadoPago),
        subTotal: Number(row.subTotal) || 0,
        igv: Number(row.igv) || 0,
        descuentos: Number(row.descuentos) || 0,
        total: Number(row.total) || 0,
        lineas: [],
      });
    }
    const comp = map.get(key);
    comp.lineas.push({
      codigo: String(row.codigo || ''),
      producto: String(row.producto || ''),
      cantidad: Number(row.cantidad) || 0,
      precio: Number(row.pUnitario) || 0,
      importe: Number(row.importeLinea) || 0,
    });
  }
  return Array.from(map.values());
}

/**
 * Reporte detallado de ventas por comprobante (cabecera + líneas de producto).
 */
exports.obtenerReporteDetallado = async (idEmpresa, query) => {
  if (!idEmpresa) {
    throw new Error('Empresa no identificada');
  }
  const fechaInicio = query.fechaInicio || query.fechaDesde;
  const fechaFin = query.fechaFin || query.fechaHasta;
  if (!fechaInicio || !fechaFin) {
    throw new Error('Indique fechaInicio y fechaFin');
  }
  const desde = new Date(fechaInicio);
  const hasta = new Date(fechaFin);
  if (desde > hasta) {
    throw new Error('La fecha inicio no puede ser mayor que la fecha fin');
  }

  const rucLike =
    query.clienteRuc && String(query.clienteRuc).trim()
      ? `%${String(query.clienteRuc).trim()}%`
      : null;
  const razonLike =
    query.clienteRazon && String(query.clienteRazon).trim()
      ? `%${String(query.clienteRazon).trim()}%`
      : null;

  return withPool(async (pool) => {
    const lineas = await ventasDetalleReporteRepository.listarLineasReporteDetallado(pool, {
      idEmpresa,
      fechaInicio,
      fechaFin,
      clienteRucLike: rucLike,
      clienteRazonLike: razonLike,
    });
    const comprobantes = agruparLineasReporteVentasDetallado(lineas);
    const totales = comprobantes.reduce(
      (acc, c) => {
        acc.subTotal += c.subTotal;
        acc.igv += c.igv;
        acc.descuentos += c.descuentos;
        acc.total += c.total;
        return acc;
      },
      { subTotal: 0, igv: 0, descuentos: 0, total: 0, cantidadComprobantes: comprobantes.length }
    );
    totales.cantidadComprobantes = comprobantes.length;
    return {
      fechaInicio: String(fechaInicio).slice(0, 10),
      fechaFin: String(fechaFin).slice(0, 10),
      comprobantes,
      totales,
    };
  });
};
