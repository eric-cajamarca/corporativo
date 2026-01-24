const CreditosRepository = require('../repositories/creditos.repository');

exports.obtenerCreditosClienteService = async (pool, user, idCliente) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const creditos = await CreditosRepository.obtenerCreditosClienteRepo(pool, user.empresa, idCliente);
  return creditos;
};

exports.crearCreditoService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que el cliente existe y pertenece a la empresa
  const clienteValido = await CreditosRepository.validarClienteEmpresaRepo(pool, datos.idCliente, user.empresa);
  if (!clienteValido) {
    throw new Error("CLIENTE_NO_ENCONTRADO");
  }

  // Si hay venta asociada, validar que existe y pertenece a la empresa
  if (datos.idVenta) {
    const ventaValida = await CreditosRepository.validarVentaEmpresaRepo(pool, datos.idVenta, user.empresa);
    if (!ventaValida) {
      throw new Error("VENTA_NO_ENCONTRADA");
    }
  }

  const result = await CreditosRepository.crearCreditoRepo(pool, user, datos);
  return result;
};

exports.obtenerCuotasCreditoService = async (pool, user, idCredito) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const cuotas = await CreditosRepository.obtenerCuotasCreditoRepo(pool, user.empresa, idCredito);
  return cuotas;
};

exports.pagarCuotaService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que la cuota existe y está pendiente
  const cuotaValida = await CreditosRepository.validarCuotaPendienteRepo(pool, datos.idCuota, user.empresa);
  if (!cuotaValida) {
    throw new Error("CUOTA_NO_ENCONTRADA");
  }

  const result = await CreditosRepository.pagarCuotaRepo(pool, user, datos);
  return result;
};

exports.obtenerResumenCreditosService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const resumen = await CreditosRepository.obtenerResumenCreditosRepo(pool, user.empresa);
  return resumen;
};

exports.obtenerCuotasPendientesService = async (pool, user, dias = 7) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const cuotas = await CreditosRepository.obtenerCuotasPendientesRepo(pool, user.empresa, dias);
  return cuotas;
};

exports.obtenerEficienciaCobrosService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const eficiencia = await CreditosRepository.obtenerEficienciaCobrosRepo(pool, user.empresa);
  return eficiencia;
};