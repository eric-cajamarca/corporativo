const EnviosRepository = require('../repositories/envios.repository');

exports.obtenerEnviosVentaService = async (pool, user, idVenta) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const envios = await EnviosRepository.obtenerEnviosVentaRepo(pool, user.empresa, idVenta);
  return envios;
};

exports.crearEnvioService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que la venta existe y pertenece a la empresa
  const ventaValida = await EnviosRepository.validarVentaEmpresaRepo(pool, datos.idVenta, user.empresa);
  if (!ventaValida) {
    throw new Error("VENTA_NO_ENCONTRADA");
  }

  // Validar tipo de envío
  const tipoValido = await EnviosRepository.validarTipoEnvioRepo(pool, datos.idTipoEnvio);
  if (!tipoValido) {
    throw new Error("TIPO_ENVIO_INVALIDO");
  }

  // Si hay transportista, validar que existe
  if (datos.idTransportista) {
    const transportistaValido = await EnviosRepository.validarTransportistaEmpresaRepo(pool, datos.idTransportista, user.empresa);
    if (!transportistaValido) {
      throw new Error("TRANSPORTISTA_NO_ENCONTRADO");
    }
  }

  const result = await EnviosRepository.crearEnvioRepo(pool, user, datos);
  return result;
};

exports.actualizarEstadoEnvioService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que el envío existe
  const envioValido = await EnviosRepository.validarEnvioEmpresaRepo(pool, datos.idEnvio, user.empresa);
  if (!envioValido) {
    throw new Error("ENVIO_NO_ENCONTRADO");
  }

  // Validar estado
  const estadoValido = await EnviosRepository.validarEstadoEnvioRepo(pool, datos.idEstadoEnvio);
  if (!estadoValido) {
    throw new Error("ESTADO_ENVIO_INVALIDO");
  }

  const result = await EnviosRepository.actualizarEstadoEnvioRepo(pool, user, datos);
  return result;
};

exports.asignarTransportistaService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  // Validar que el envío existe
  const envioValido = await EnviosRepository.validarEnvioEmpresaRepo(pool, datos.idEnvio, user.empresa);
  if (!envioValido) {
    throw new Error("ENVIO_NO_ENCONTRADO");
  }

  // Validar transportista
  const transportistaValido = await EnviosRepository.validarTransportistaEmpresaRepo(pool, datos.idTransportista, user.empresa);
  if (!transportistaValido) {
    throw new Error("TRANSPORTISTA_NO_ENCONTRADO");
  }

  const result = await EnviosRepository.asignarTransportistaRepo(pool, user, datos);
  return result;
};

exports.obtenerTransportistasService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const transportistas = await EnviosRepository.obtenerTransportistasRepo(pool, user.empresa);
  return transportistas;
};

exports.obtenerTiposEnvioService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const tipos = await EnviosRepository.obtenerTiposEnvioRepo(pool);
  return tipos;
};

exports.obtenerEstadosEnvioService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const estados = await EnviosRepository.obtenerEstadosEnvioRepo(pool);
  return estados;
};

exports.obtenerEnviosPorEstadoService = async (pool, user, estado) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const envios = await EnviosRepository.obtenerEnviosPorEstadoRepo(pool, user.empresa, estado);
  return envios;
};

exports.obtenerEnviosPorTransportistaService = async (pool, user, idTransportista) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  const envios = await EnviosRepository.obtenerEnviosPorTransportistaRepo(pool, user.empresa, idTransportista);
  return envios;
};