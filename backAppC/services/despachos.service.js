const DespachosRepository = require('../repositories/despachos.repository');

exports.obtenerDespachosVentaService = async (pool, user, idVenta) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const despachos = await DespachosRepository.obtenerDespachosVentaRepo(pool, user.empresa, idVenta);
  return despachos;
};

exports.crearDespachoService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que la venta existe y pertenece a la empresa
  const ventaValida = await DespachosRepository.validarVentaEmpresaRepo(pool, datos.idVenta, user.empresa);
  if (!ventaValida) {
    throw new Error("VENTA_NO_ENCONTRADA");
  }

  // Validar tipo de despacho
  const tipoValido = await DespachosRepository.validarTipoDespachoRepo(pool, datos.idTipoDespacho);
  if (!tipoValido) {
    throw new Error("TIPO_DESPACHO_INVALIDO");
  }

  const result = await DespachosRepository.crearDespachoRepo(pool, user, datos);
  return result;
};

exports.actualizarCantidadDespachadaService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que el detalle existe
  const detalleValido = await DespachosRepository.validarDetalleDespachoRepo(pool, datos.idDetalleDespacho, user.empresa);
  if (!detalleValido) {
    throw new Error("DETALLE_NO_ENCONTRADO");
  }

  const result = await DespachosRepository.actualizarCantidadDespachadaRepo(pool, user, datos);
  return result;
};

exports.finalizarDespachoService = async (pool, user, idDespacho) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que el despacho existe y pertenece a la empresa
  const despachoValido = await DespachosRepository.validarDespachoEmpresaRepo(pool, idDespacho, user.empresa);
  if (!despachoValido) {
    throw new Error("DESPACHO_NO_ENCONTRADO");
  }

  const result = await DespachosRepository.finalizarDespachoRepo(pool, user, idDespacho);
  return result;
};

exports.obtenerTiposDespachoService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const tipos = await DespachosRepository.obtenerTiposDespachoRepo(pool);
  return tipos;
};

exports.obtenerEstadoDespachosService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const estado = await DespachosRepository.obtenerEstadoDespachosRepo(pool, user.empresa);
  return estado;
};

/** Buscar venta por compVenta o idVenta; devuelve venta + despachos + entregadoMismoDia. */
exports.buscarVentaDespachosService = async (pool, user, query) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const compVenta = query.compVenta ? String(query.compVenta).trim() : null;
  const idVenta = query.idVenta != null && query.idVenta !== '' ? query.idVenta : null;
  if (!compVenta && !idVenta) return null;
  return await DespachosRepository.buscarVentaDespachosRepo(pool, user.empresa, { compVenta, idVenta });
};

/** Obtener detalle de un despacho (DetalleDespachos). */
exports.obtenerDetalleDespachoService = async (pool, user, idDespacho) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  return await DespachosRepository.obtenerDetalleDespachoRepo(pool, idDespacho, user.empresa);
};

/** Detalle de venta por idVenta para despacho (cantidad, cantEntregada, cantPendiente, ubicaciones). */
exports.obtenerDetalleVentaParaDespachoService = async (pool, user, idVenta) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  return await DespachosRepository.obtenerDetalleVentaParaDespachoRepo(pool, user.empresa, idVenta);
};