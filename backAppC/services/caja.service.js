const CajaRepository = require('../repositories/caja.repository');

exports.obtenerCajasService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const cajas = await CajaRepository.obtenerCajasRepo(pool, user.empresa);
  return cajas;
};

exports.abrirCajaService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que la caja pertenezca a la empresa del usuario
  const cajaValida = await CajaRepository.validarCajaEmpresaRepo(pool, datos.idCaja, user.empresa);
  if (!cajaValida) {
    throw new Error("CAJA_NO_VALIDA");
  }

  // Verificar que no haya una caja abierta para esta caja
  const cajaAbierta = await CajaRepository.verificarCajaAbiertaRepo(pool, datos.idCaja);
  if (cajaAbierta) {
    throw new Error("CAJA_YA_ABIERTA");
  }

  const result = await CajaRepository.abrirCajaRepo(pool, user, datos);
  return result;
};

exports.cerrarCajaService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Verificar que la apertura pertenezca a la empresa del usuario y esté abierta
  const aperturaValida = await CajaRepository.validarAperturaEmpresaRepo(pool, datos.idApertura, user.empresa);
  if (!aperturaValida) {
    throw new Error("APERTURA_NO_ENCONTRADA");
  }

  const result = await CajaRepository.cerrarCajaRepo(pool, user, datos);
  return result;
};

exports.registrarMovimientoService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Verificar que la apertura esté abierta y pertenezca a la empresa
  const aperturaAbierta = await CajaRepository.verificarAperturaAbiertaRepo(pool, datos.idApertura, user.empresa);
  if (!aperturaAbierta) {
    throw new Error("CAJA_NO_ABIERTA");
  }

  // Validar que el tipo de movimiento existe
  const tipoValido = await CajaRepository.validarTipoMovimientoRepo(pool, datos.idTipoMovimientoCaja);
  if (!tipoValido) {
    throw new Error("TIPO_MOVIMIENTO_INVALIDO");
  }

  const result = await CajaRepository.registrarMovimientoRepo(pool, user, datos);
  return result;
};

exports.obtenerMovimientosCajaService = async (pool, user, filtros) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const movimientos = await CajaRepository.obtenerMovimientosCajaRepo(pool, user.empresa, filtros);
  return movimientos;
};

exports.obtenerTiposMovimientoCajaService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const tipos = await CajaRepository.obtenerTiposMovimientoCajaRepo(pool);
  return tipos;
};

exports.obtenerResumenCajaDiarioService = async (pool, user, fecha) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const resumen = await CajaRepository.obtenerResumenCajaDiarioRepo(pool, user.empresa, fecha);
  return resumen;
};