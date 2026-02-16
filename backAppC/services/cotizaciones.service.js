// services/cotizaciones.service.js
const cotizacionesRepository = require('../repositories/cotizaciones.repository');

/**
 * Crea una cotización (Cotizaciones + DetalleCotizacion). No descuenta stock ni registra caja.
 * transaction ya iniciada; idEmpresa e idUsuario del JWT.
 */
exports.crearCotizacion = async (transaction, payload, idEmpresa, idUsuario) => {
  const { cotizacion, detalles } = payload;
  if (!cotizacion || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
    throw new Error('Faltan cabecera o detalle de cotización.');
  }
  if (cotizacion.idCliente == null || cotizacion.idCliente === '') {
    throw new Error('El cliente es obligatorio.');
  }
  const total = Number(cotizacion.total) || 0;
  if (total < 0) {
    throw new Error('El total debe ser mayor o igual a cero.');
  }

  const idComprobante = cotizacion.idComprobante != null ? Number(cotizacion.idComprobante) : null;
  if (idComprobante == null) {
    throw new Error('El tipo de comprobante (cotización) es obligatorio.');
  }

  const siguienteNumero = await cotizacionesRepository.obtenerSiguienteNumero(transaction, idEmpresa, idComprobante);
  const serie = (cotizacion.serie != null ? String(cotizacion.serie) : '0000').substring(0, 4);
  const serieNumero = serie + '-' + siguienteNumero;
  const fEmision = cotizacion.fEmision ? String(cotizacion.fEmision).substring(0, 10) : null;
  const fVencimiento = cotizacion.fVencimiento ? String(cotizacion.fVencimiento).substring(0, 10) : null;

  const datosCabecera = {
    idComprobante,
    serie,
    numero: siguienteNumero,
    serieNumero,
    fEmision,
    fVencimiento,
    idDocumento: cotizacion.idDocumento != null ? String(cotizacion.idDocumento).substring(0, 1) : '1',
    idCliente: Number(cotizacion.idCliente),
    moneda: cotizacion.moneda || null,
    idCondicionPago: cotizacion.idCondicionPago != null ? Number(cotizacion.idCondicionPago) : null,
    total
  };

  const result = await cotizacionesRepository.insertar(transaction, datosCabecera, idEmpresa, idUsuario);
  const idCotizacion = result.recordset[0].idCotizacion;

  let idSucursalDefault = cotizacion.idSucursal != null ? cotizacion.idSucursal : null;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!idSucursalDefault || !uuidRegex.test(String(idSucursalDefault).trim())) {
    idSucursalDefault = await cotizacionesRepository.obtenerPrimeraSucursalPorEmpresa(transaction, idEmpresa);
  }
  if (!idSucursalDefault) {
    throw new Error('No se encontró sucursal para la empresa. Configure al menos una sucursal.');
  }
  const items = detalles.map(d => ({
    cantidad: d.cantidad,
    pVenta: d.pVenta,
    subtotal: d.subtotal,
    total: d.total,
    descuento: d.descuento != null ? d.descuento : 0,
    igv: d.igv != null ? d.igv : 0,
    isc: d.isc != null ? d.isc : 0,
    codigo: d.codigo != null ? d.codigo : '',
    descripcion: d.descripcion != null ? d.descripcion : '',
    idPresentacion: d.idPresentacion != null ? d.idPresentacion : 1,
    idSucursal: d.idSucursal != null ? d.idSucursal : idSucursalDefault
  }));

  await cotizacionesRepository.insertarDetalle(transaction, idCotizacion, idEmpresa, items, idSucursalDefault);
  return idCotizacion;
};
