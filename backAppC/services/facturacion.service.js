const FacturacionRepository = require('../repositories/facturacion.repository');

exports.obtenerConfiguracionFacturacionService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const configuracion = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  return configuracion;
};

exports.actualizarConfiguracionFacturacionService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador") {
    throw new Error("NO_PERMISSIONS");
  }

  const result = await FacturacionRepository.actualizarConfiguracionFacturacionRepo(pool, user, datos);
  return result;
};

exports.obtenerComprobantesElectronicosService = async (pool, user, filtros) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const comprobantes = await FacturacionRepository.obtenerComprobantesElectronicosRepo(pool, user.empresa, filtros);
  return comprobantes;
};

exports.generarComprobanteElectronicoService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que la venta existe
  const ventaValida = await FacturacionRepository.validarVentaEmpresaRepo(pool, datos.idVenta, user.empresa);
  if (!ventaValida) {
    throw new Error("VENTA_NO_ENCONTRADA");
  }

  // Validar configuración de facturación
  const configuracion = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (!configuracion || !configuracion.serieFactura) {
    throw new Error("CONFIGURACION_INCOMPLETA");
  }

  // Generar el comprobante electrónico
  const result = await FacturacionRepository.generarComprobanteElectronicoRepo(pool, user, datos, configuracion);
  return result;
};

exports.enviarComprobanteSunatService = async (pool, user, idComprobanteElectronico) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que el comprobante existe
  const comprobanteValido = await FacturacionRepository.validarComprobanteEmpresaRepo(pool, idComprobanteElectronico, user.empresa);
  if (!comprobanteValido) {
    throw new Error("COMPROBANTE_NO_ENCONTRADO");
  }

  // Simular envío a SUNAT (en producción se haría la llamada real)
  const result = await FacturacionRepository.enviarComprobanteSunatRepo(pool, user, idComprobanteElectronico);
  return result;
};

exports.consultarEstadoSunatService = async (pool, user, idComprobanteElectronico) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  // Validar que el comprobante existe
  const comprobanteValido = await FacturacionRepository.validarComprobanteEmpresaRepo(pool, idComprobanteElectronico, user.empresa);
  if (!comprobanteValido) {
    throw new Error("COMPROBANTE_NO_ENCONTRADO");
  }

  // Simular consulta a SUNAT (en producción se haría la llamada real)
  const result = await FacturacionRepository.consultarEstadoSunatRepo(pool, user, idComprobanteElectronico);
  return result;
};

exports.obtenerEstadisticasFacturacionService = async (pool, user, periodo) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const estadisticas = await FacturacionRepository.obtenerEstadisticasFacturacionRepo(pool, user.empresa, periodo);
  return estadisticas;
};

exports.obtenerEstadosSunatService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const estados = await FacturacionRepository.obtenerEstadosSunatRepo(pool);
  return estados;
};