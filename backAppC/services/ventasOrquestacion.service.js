/**
 * Orquestación de casos de uso de ventas (antes en ventasController):
 * repositorios y reglas de presentación/listado sin exponerlos al controlador.
 */
const path = require('path');
const fs = require('fs');
const sql = require('mssql');
const ventasRepository = require('../repositories/ventas.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const facturacionRepository = require('../repositories/facturacion.repository');
const ventasService = require('./ventas.service');
const sunatPostPagoService = require('./sunatPostPago.service');
const { nombreArchivoComprobante, getRutaFirmaFacturador, getRutaRptaFacturador } = require('../utils/facturadorSunat.util');
const { idUsuarioDesdePayloadUser } = require('../utils/idUsuarioSesion.util');

async function idsEmpresaParaComprobanteVenta(pool, idEmpresaUsuario) {
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

exports.idsEmpresaParaComprobanteVenta = idsEmpresaParaComprobanteVenta;

exports.obtenerVentasListado = async (pool, idempresa, opts = {}) => {
  let idsList = [idempresa];
  try {
    const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, idempresa);
    if (esGestora) {
      idsList = await idsEmpresaParaComprobanteVenta(pool, idempresa);
    }
  } catch (_) {
    idsList = [idempresa];
  }
  let list = await ventasRepository.listarPorIdsEmpresas(pool, idsList, opts || {});
  const config = await facturacionRepository.obtenerConfiguracionFacturacionRepo(pool, idempresa);
  const rutaFacturador = config && config.rutaCarpetaFacturadorSunat ? String(config.rutaCarpetaFacturadorSunat).trim() : null;
  if (rutaFacturador) {
    const rutaFirma = getRutaFirmaFacturador(rutaFacturador);
    const rutaRpta = getRutaRptaFacturador(rutaFacturador);
    list = list.map((r) => {
      let tieneXml = false;
      let tieneCdr = false;
      if (r.idComprobanteElectronico && r.rucEmpresa && r.tipoComprobante != null) {
        const nombreArchivo = nombreArchivoComprobante({
          ruc: r.rucEmpresa,
          tipoComprobante: r.tipoComprobante,
          serie: r.serie,
          numero: r.numero
        });
        const base = nombreArchivo.replace(/\.json$/i, '');
        if (rutaFirma) {
          const xmlPath = path.join(rutaFirma, `${base}.xml`);
          try {
            tieneXml = fs.existsSync(xmlPath);
          } catch (_) {}
        }
        if (rutaRpta) {
          const zipPath = path.join(rutaRpta, `R${base}.zip`);
          try {
            tieneCdr = fs.existsSync(zipPath);
          } catch (_) {}
        }
      }
      return { ...r, tieneXml, tieneCdr };
    });
  } else {
    list = list.map((r) => ({ ...r, tieneXml: false, tieneCdr: false }));
  }
  return list;
};

exports.obtenerVentasListadoPaginado = async (pool, idempresa, opts = {}) => {
  let idsList = [idempresa];
  try {
    const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, idempresa);
    if (esGestora) {
      idsList = await idsEmpresaParaComprobanteVenta(pool, idempresa);
    }
  } catch (_) {
    idsList = [idempresa];
  }
  const { rows, total, pagina, porPagina } = await ventasRepository.listarPorIdsEmpresasPaginado(pool, idsList, opts || {});
  const config = await facturacionRepository.obtenerConfiguracionFacturacionRepo(pool, idempresa);
  const rutaFacturador = config && config.rutaCarpetaFacturadorSunat ? String(config.rutaCarpetaFacturadorSunat).trim() : null;
  let list = rows;
  if (rutaFacturador) {
    const rutaFirma = getRutaFirmaFacturador(rutaFacturador);
    const rutaRpta = getRutaRptaFacturador(rutaFacturador);
    list = list.map((r) => {
      let tieneXml = false;
      let tieneCdr = false;
      if (r.idComprobanteElectronico && r.rucEmpresa && r.tipoComprobante != null) {
        const nombreArchivo = nombreArchivoComprobante({
          ruc: r.rucEmpresa,
          tipoComprobante: r.tipoComprobante,
          serie: r.serie,
          numero: r.numero
        });
        const base = nombreArchivo.replace(/\.json$/i, '');
        if (rutaFirma) {
          const xmlPath = path.join(rutaFirma, `${base}.xml`);
          try {
            tieneXml = fs.existsSync(xmlPath);
          } catch (_) {}
        }
        if (rutaRpta) {
          const zipPath = path.join(rutaRpta, `R${base}.zip`);
          try {
            tieneCdr = fs.existsSync(zipPath);
          } catch (_) {}
        }
      }
      return { ...r, tieneXml, tieneCdr };
    });
  } else {
    list = list.map((r) => ({ ...r, tieneXml: false, tieneCdr: false }));
  }
  return { rows: list, total, pagina, porPagina };
};

exports.listarVentasAgrupadas = async (pool, idEmpresa, opts = {}) =>
  ventasRepository.listarVentasAgrupadas(pool, idEmpresa, opts || {});

exports.listarVentasEmpresa = async (pool, idEmpresa) => ventasRepository.listarVentasEmpresa(pool, idEmpresa);

exports.obtenerDetalleVentaAgrupada = async (pool, idEmpresa, idVentaAgrupada) =>
  ventasRepository.obtenerDetalleVentaAgrupada(pool, idEmpresa, idVentaAgrupada);

exports.listarComprobantesPorAgrupada = async (pool, idEmpresa, idVentaAgrupada) =>
  ventasRepository.listarComprobantesPorAgrupada(pool, idEmpresa, idVentaAgrupada);

exports.listarComprobantesVentasAgrupadasPaginado = async (pool, idEmpresa, opts = {}) =>
  ventasRepository.listarComprobantesVentasAgrupadasPaginado(pool, idEmpresa, opts || {});

exports.obtenerComprobanteParaPdf = async (pool, idEmpresa, idVenta, baseUrl) => {
  const idsEmpresa = await idsEmpresaParaComprobanteVenta(pool, idEmpresa);
  return ventasRepository.obtenerComprobanteParaPdf(pool, idVenta, idsEmpresa, baseUrl);
};

exports.obtenerComprobanteVAParaPdf = async (pool, idEmpresa, idVentaAgrupada, baseUrl) =>
  ventasRepository.obtenerComprobanteVAParaPdf(pool, idEmpresa, idVentaAgrupada, baseUrl);

exports.actualizarVentaEdicion = async (pool, idEmpresa, idVenta, cabecera, detalles, user, opciones = {}) => {
  const { detallePago } = opciones || {};
  const idsEmpresa = await idsEmpresaParaComprobanteVenta(pool, idEmpresa);
  const data = await ventasRepository.obtenerComprobanteParaPdf(pool, idVenta, idsEmpresa);
  if (!data || !data.venta) {
    return { ok: false, status: 404, error: 'Venta no encontrada' };
  }
  if (data.venta.eliminado) {
    return { ok: false, status: 400, error: 'No se puede editar: el comprobante fue anulado.' };
  }
  const idEstadoSunat = data.venta.idEstadoSunat;
  const codigoCompEdicion = String(data.venta.codigoComprobante || '').trim().toUpperCase();
  const esNotaVentaEdicion = codigoCompEdicion === 'NV';
  if (!esNotaVentaEdicion && (idEstadoSunat === 1 || idEstadoSunat === 2 || idEstadoSunat === 3)) {
    return {
      ok: false,
      status: 400,
      error: 'No se puede editar: el comprobante ya fue enviado o aceptado en SUNAT.'
    };
  }
  const idEmpresaVenta = data.venta.idEmpresa || idEmpresa;
  if (await ventasRepository.ventaTieneDespachos(pool, idVenta, idEmpresaVenta)) {
    return {
      ok: false,
      status: 400,
      error: 'No se puede editar: el comprobante tiene despachos registrados.'
    };
  }
  if (
    await ventasRepository.ventaTieneNotasCreditoDebito(
      pool,
      idEmpresaVenta,
      String(data.venta.compVenta || '').trim()
    )
  ) {
    return {
      ok: false,
      status: 400,
      error: 'No se puede editar: existen notas de crédito o débito vinculadas a este comprobante.'
    };
  }
  const idUsuarioEjecutor = user ? idUsuarioDesdePayloadUser(user) : null;
  let result;
  try {
    result = await ventasRepository.actualizarVentaCompleta(
      pool,
      idVenta,
      idEmpresaVenta,
      {
        ...cabecera,
        idEstadoSunat
      },
      detalles,
      { idUsuarioEjecutor, detallePago }
    );
  } catch (err) {
    const msg = err && err.message ? String(err.message) : '';
    if (msg.includes('Stock insuficiente')) {
      return { ok: false, status: 400, error: msg };
    }
    throw err;
  }
  if (result && result.ok === false) {
    return { ok: false, status: 400, error: result.error || 'No se pudo actualizar' };
  }
  return { ok: true };
};

exports.getConfigDefaults = async (pool, idEmpresa) => {
  const rows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa);
  const getVal = (clave) => {
    const r = (rows || []).find((x) => x.clave === clave);
    return r && r.valor != null ? r.valor.trim() : null;
  };
  const idEstadoPedido = getVal('venta_idEstadoPedidoPorDefecto');
  const idEstadoPago = getVal('venta_idEstadoPagoPorDefecto');
  return {
    idEstadoPedidoPorDefecto: idEstadoPedido != null ? parseInt(idEstadoPedido, 10) : 1,
    idEstadoPagoPorDefecto: idEstadoPago != null ? parseInt(idEstadoPago, 10) : 2
  };
};

exports.putConfigDefaults = async (pool, idEmpresa, body) => {
  const { idEstadoPedidoPorDefecto, idEstadoPagoPorDefecto } = body || {};
  if (idEstadoPedidoPorDefecto != null) {
    await gestoresRepository.guardarConfiguracion(
      pool,
      idEmpresa,
      'venta_idEstadoPedidoPorDefecto',
      String(idEstadoPedidoPorDefecto),
      'Estado pedido por defecto en nueva venta (1=Pendiente, 2=Entregado)',
      'INT'
    );
  }
  if (idEstadoPagoPorDefecto != null) {
    await gestoresRepository.guardarConfiguracion(
      pool,
      idEmpresa,
      'venta_idEstadoPagoPorDefecto',
      String(idEstadoPagoPorDefecto),
      'Estado de pago por defecto en nueva venta (1=Pendiente, 2=Pagado)',
      'INT'
    );
  }
};

exports.listarPendientesPago = async (pool, idEmpresa, query) =>
  ventasRepository.listarPendientesPago(pool, idEmpresa, query);

exports.listarPendientesPagoAgrupado = async (pool, idEmpresa, query) =>
  ventasRepository.listarPendientesPagoAgrupado(pool, idEmpresa, query);

exports.listarNotasCreditoDebito = async (pool, idempresa, query) => {
  let idsList = [idempresa];
  try {
    const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, idempresa);
    if (esGestora) {
      idsList = await idsEmpresaParaComprobanteVenta(pool, idempresa);
    }
  } catch (_) {
    idsList = [idempresa];
  }
  const buscar = query.buscar != null ? String(query.buscar) : '';
  const pagina = query.pagina != null ? String(query.pagina) : '1';
  const porPagina = query.porPagina != null ? String(query.porPagina) : '20';
  return ventasRepository.listarVentasNotasCreditoDebitoRepo(pool, idsList, {
    buscar,
    pagina,
    porPagina
  });
};

exports.anularVenta = async (pool, idEmpresaUsuario, idVenta, user) => {
  const idsPermitidos = await idsEmpresaParaComprobanteVenta(pool, idEmpresaUsuario);
  return ventasRepository.anularVentaRepo(
    pool,
    idVenta,
    idsPermitidos.length > 0 ? idsPermitidos : [idEmpresaUsuario],
    idUsuarioDesdePayloadUser(user)
  );
};

exports.postCobrarVentaAgrupada = async (pool, user, idVentaAgrupada, body) => {
  const { detallePago, idApertura, cuotasCredito } = body || {};
  const ventaAgr = await ventasService.obtenerVentaAgrupadaParaCobro(pool, idVentaAgrupada, user.empresa);
  if (!ventaAgr) {
    const e = new Error('NOT_FOUND_VA');
    e.httpStatus = 404;
    e.clientMessage = 'Venta agrupada no encontrada';
    throw e;
  }
  if (ventaAgr.idEstadoPago !== 1) {
    const e = new Error('ESTADO_PAGO_VA');
    e.httpStatus = 400;
    e.clientMessage = 'La venta ya está pagada o no está pendiente de pago';
    throw e;
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const ventasEmp = await ventasRepository.listarVentasEmpresaPorAgrupada(transaction, idVentaAgrupada);
    if (!ventasEmp || ventasEmp.length === 0) {
      throw new Error('La venta agrupada no tiene comprobantes asociados (VentaEmpresa). No se puede cobrar.');
    }

    const fVencCab = await ventasService.obtenerFVencimientoPrimeraVentaEmpresaVA(transaction, idVentaAgrupada);

    const ventaCreditoPostVentaService = require('./ventaCreditoPostVenta.service');
    await ventaCreditoPostVentaService.crearCreditosDesdeVentaAgrupada(transaction, {
      ventasEmpresa: ventasEmp.map((v) => ({
        idEmpresa: v.idEmpresa,
        idVenta: v.idVenta,
        idCliente: v.idCliente,
        codigoComprobante: v.codigoComprobante || '',
        compVenta: v.compVenta,
        total: v.total,
        idSucursal: v.idSucursal
      })),
      detallePago,
      cuotasCredito: Array.isArray(cuotasCredito) ? cuotasCredito : [],
      userSub: user.sub,
      fVencimientoCabecera: fVencCab
    });

    await ventasRepository.actualizarEstadoPagoVentaAgrupada(transaction, idVentaAgrupada, user.empresa, 2);
    for (const ve of ventasEmp) {
      await ventasRepository.actualizarEstadoPagoVenta(transaction, ve.idVenta, ve.idEmpresa, 2);
    }

    const compParaCaja = ventaAgr.compVenta && String(ventaAgr.compVenta).trim()
      ? String(ventaAgr.compVenta).trim()
      : 'S/N';

    const ventaAgrupadaCobroService = require('./ventaAgrupadaCobro.service');
    await ventaAgrupadaCobroService.aplicarCobroVentasAgrupadasMulticompania(pool, transaction, {
      lineasVenta: ventasEmp.map((v) => ({
        idVenta: v.idVenta,
        idEmpresa: v.idEmpresa,
        compVenta: v.compVenta,
        total: v.total,
        idSucursal: v.idSucursal,
        fEmision: v.fEmision
      })),
      detallePago,
      idEmpresaCobradora: user.empresa,
      idUsuario: user.sub,
      compVentaVA: compParaCaja,
      idAperturaGestoraOpcional: idApertura || null,
      idSucursalGestoraFallback: ventaAgr.idSucursal
    });

    await transaction.commit();
    for (const ve of ventasEmp) {
      sunatPostPagoService.encolarTrasConfirmarPago(pool, ve.idVenta, ve.idEmpresa);
    }
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

exports.postCobrarVenta = async (pool, user, idVenta, body) => {
  const { detallePago, idApertura, cuotasCredito } = body || {};
  const CajaRepository = require('../repositories/caja.repository');
  const venta = await ventasService.obtenerVentaParaCobroPendiente(pool, idVenta, user.empresa);
  if (!venta) {
    const e = new Error('NOT_FOUND_V');
    e.httpStatus = 404;
    e.clientMessage = 'Venta no encontrada';
    throw e;
  }
  if (venta.idEstadoPago !== 1) {
    const e = new Error('ESTADO_PAGO_V');
    e.httpStatus = 400;
    e.clientMessage = 'La venta ya está pagada o no está pendiente de pago';
    throw e;
  }
  const { esSoloNotaCreditoCodigo } = require('../utils/sunatCodigoComprobante.util');
  if (esSoloNotaCreditoCodigo(venta.codigoComprobante)) {
    const e = new Error('NC_NO_COBRABLE');
    e.httpStatus = 400;
    e.clientMessage =
      'Las notas de crédito no se cobran desde pendientes de pago; se aplican a la factura origen al aceptar SUNAT.';
    throw e;
  }
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const ventaCreditoPostVentaService = require('./ventaCreditoPostVenta.service');
    const { normalizarDetallePagoIdMediosPago } = require('../utils/detallePagoNormalizar.util');
    const detalleNorm = await normalizarDetallePagoIdMediosPago(transaction, detallePago);

    await ventaCreditoPostVentaService.crearCreditosDesdeVentaAgrupada(transaction, {
      ventasEmpresa: [
        {
          idEmpresa: user.empresa,
          idVenta,
          idCliente: venta.idCliente,
          codigoComprobante: venta.codigoComprobante || '',
          compVenta: venta.compVenta,
          total: Number(venta.total) || 0,
          idSucursal: venta.idSucursal
        }
      ],
      detallePago: detalleNorm,
      cuotasCredito: Array.isArray(cuotasCredito) ? cuotasCredito : [],
      userSub: user.sub,
      fVencimientoCabecera: venta.fVencimiento
    });

    await ventasRepository.actualizarEstadoPagoVenta(transaction, idVenta, user.empresa, 2);
    await ventasRepository.insertarDetallePagoVenta(transaction, idVenta, detalleNorm);
    let idSucursalCaja = venta.idSucursal;
    let idAperturaActual = idApertura || null;
    if (!idAperturaActual && venta.idSucursal) {
      const apertura = await CajaRepository.obtenerAperturaAbiertaPorSucursalRepo(pool, user.empresa, venta.idSucursal);
      idAperturaActual = apertura?.idApertura;
    }
    if (!idAperturaActual) {
      const cualquier = await CajaRepository.obtenerCualquierAperturaAbiertaRepo(pool, user.empresa);
      if (cualquier?.idApertura) {
        idAperturaActual = cualquier.idApertura;
        idSucursalCaja = cualquier.idSucursal || venta.idSucursal;
      }
    }
    const esCotizacion = (venta.codigoComprobante || '').trim().toUpperCase() === 'CT';
    const idsCredito = await ventaCreditoPostVentaService.idsMediosPagoCredito(transaction);
    const detalleCaja = detalleNorm.filter((p) => !idsCredito.has(Number(p.idMediosPago)));
    if (idAperturaActual && !esCotizacion && detalleCaja.length > 0) {
      await CajaRepository.registrarMovimientosVentaContadoRepo(transaction, {
        idApertura: idAperturaActual,
        idEmpresa: user.empresa,
        idSucursal: idSucursalCaja,
        idUsuario: user.sub,
        idVenta,
        compVenta: venta.compVenta || '',
        detallePago: detalleCaja,
        fechaMovimiento: venta.fEmision || null
      });
    }
    await transaction.commit();
    sunatPostPagoService.encolarTrasConfirmarPago(pool, idVenta, user.empresa);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};
