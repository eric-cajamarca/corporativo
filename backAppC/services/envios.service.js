const EnviosRepository = require('../repositories/envios.repository');
const { assertAlgunoPermiso, tieneAlgunoPermiso } = require('../utils/autorizacionPermisos.util');

/** Coordinación de envíos (programación, listados, edición). */
async function assertEnviosStaff(pool, user) {
  await assertAlgunoPermiso(pool, user, 'VER_ENVIOS');
}

/** Ver envíos o actuar como chofer en campo. */
async function assertEnviosStaffOChofer(pool, user) {
  await assertAlgunoPermiso(pool, user, 'VER_ENVIOS', 'VER_ENVIOS_CHOFER');
}

async function esSoloChoferEnvios(pool, user) {
  if (user.rol === 'Administrador') return false;
  const staff = await tieneAlgunoPermiso(pool, user, 'VER_ENVIOS');
  if (staff) return false;
  return user.rol === 'Chofer' || (await tieneAlgunoPermiso(pool, user, 'VER_ENVIOS_CHOFER'));
}

exports.obtenerEnviosProgramadosService = async (pool, user, filtros = {}) => {
  if (!user) throw new Error("NO_ACCESS");
  await assertEnviosStaff(pool, user);
  return await EnviosRepository.obtenerEnviosProgramadosRepo(pool, user.empresa, filtros);
};

exports.obtenerDetalleEnvioService = async (pool, user, idEnvio) => {
  if (!user) throw new Error("NO_ACCESS");
  await assertEnviosStaffOChofer(pool, user);
  const detalle = await EnviosRepository.obtenerDetalleEnvioRepo(pool, idEnvio, user.empresa);
  if (detalle === null) throw new Error("ENVIO_NO_ENCONTRADO");
  return detalle;
};

exports.obtenerEnviosVentaService = async (pool, user, idVenta) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertEnviosStaff(pool, user);

  const envios = await EnviosRepository.obtenerEnviosVentaRepo(pool, user.empresa, idVenta);
  return envios;
};

exports.crearEnvioService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertEnviosStaff(pool, user);

  // Validar que la venta existe y pertenece a la empresa
  const ventaValida = await EnviosRepository.validarVentaEmpresaRepo(pool, datos.idVenta, user.empresa);
  if (!ventaValida) {
    throw new Error("VENTA_NO_ENCONTRADA");
  }

  // Resolver sucursal para el envío (Envios.idSucursal puede ser NOT NULL)
  if (!datos.idSucursal) {
    const sucVenta = await EnviosRepository.obtenerSucursalVentaRepo(pool, datos.idVenta, user.empresa);
    datos.idSucursal = sucVenta || user.sucursal || null;
  }
  if (!datos.idSucursal) {
    const sucDefault = await EnviosRepository.obtenerSucursalDefaultEmpresaRepo(pool, user.empresa);
    datos.idSucursal = sucDefault || null;
  }
  if (!datos.idSucursal) {
    throw new Error("SUCURSAL_NO_DEFINIDA");
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

  // Si hay chofer interno, validar que existe
  if (datos.idChofer) {
    const choferValido = await EnviosRepository.validarChoferEmpresaRepo(pool, datos.idChofer, user.empresa);
    if (!choferValido) {
      throw new Error("CHOFER_NO_ENCONTRADO");
    }

    if (!datos.idVehiculoEntrega) {
      const idVehiculoChofer = await EnviosRepository.obtenerVehiculoChoferRepo(pool, datos.idChofer, user.empresa);
      datos.idVehiculoEntrega = idVehiculoChofer || null;
    }
  }

  const result = await EnviosRepository.crearEnvioRepo(pool, user, datos);
  return result;
};

exports.actualizarEstadoEnvioService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertEnviosStaffOChofer(pool, user);

  // Validar que el envío existe
  const envioInfo = await EnviosRepository.obtenerEnvioParaValidarRolRepo(pool, datos.idEnvio, user.empresa);
  if (!envioInfo?.existe) {
    throw new Error("ENVIO_NO_ENCONTRADO");
  }

  const soloChofer = await esSoloChoferEnvios(pool, user);
  if (soloChofer) {
    // Chofer (o solo permiso chofer): solo envíos asignados a su usuario.
    if (!envioInfo.idChoferUsuario || envioInfo.idChoferUsuario !== user.sub) {
      throw new Error("NO_PERMISSIONS");
    }
  }

  // Validar estado
  const estadoValido = await EnviosRepository.validarEstadoEnvioRepo(pool, datos.idEstadoEnvio);
  if (!estadoValido) {
    throw new Error("ESTADO_ENVIO_INVALIDO");
  }

  const result = await EnviosRepository.actualizarEstadoEnvioRepo(pool, user, datos);
  return result;
};

exports.actualizarEnvioService = async (pool, user, datos) => {
  if (!user) throw new Error("NO_ACCESS");
  await assertEnviosStaff(pool, user);
  const result = await EnviosRepository.actualizarEnvioRepo(pool, user, datos);
  if (result === null) throw new Error("ENVIO_NO_ENCONTRADO");
  return result;
};

exports.eliminarEnvioService = async (pool, user, idEnvio) => {
  if (!user) throw new Error("NO_ACCESS");
  await assertEnviosStaff(pool, user);
  const ok = await EnviosRepository.eliminarEnvioRepo(pool, idEnvio, user.empresa);
  if (!ok) throw new Error("ENVIO_NO_ENCONTRADO");
  return { mensaje: "Envío eliminado" };
};

exports.asignarTransportistaService = async (pool, user, datos) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertEnviosStaff(pool, user);

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

  await assertEnviosStaff(pool, user);

  const transportistas = await EnviosRepository.obtenerTransportistasRepo(pool, user.empresa);
  return transportistas;
};

// Crear transportista (delivery externo)
exports.crearTransportistaService = async (pool, user, datos) => {
  if (!user) throw new Error("NO_ACCESS");

  if (user.rol !== "Administrador" && user.rol !== "Vendedor") {
    throw new Error("NO_PERMISSIONS");
  }

  return await EnviosRepository.crearTransportistaRepo(pool, user.empresa, datos);
};

exports.obtenerTiposEnvioService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertEnviosStaffOChofer(pool, user);

  const tipos = await EnviosRepository.obtenerTiposEnvioRepo(pool);
  return tipos;
};

exports.obtenerEstadosEnvioService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertEnviosStaffOChofer(pool, user);

  const estados = await EnviosRepository.obtenerEstadosEnvioRepo(pool);
  return estados;
};

exports.obtenerEnviosPorEstadoService = async (pool, user, estado) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertEnviosStaff(pool, user);

  const envios = await EnviosRepository.obtenerEnviosPorEstadoRepo(pool, user.empresa, estado);
  return envios;
};

exports.obtenerEnviosPorTransportistaService = async (pool, user, idTransportista) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertEnviosStaff(pool, user);

  const envios = await EnviosRepository.obtenerEnviosPorTransportistaRepo(pool, user.empresa, idTransportista);
  return envios;
};

// Mis envíos (rol Chofer)
exports.obtenerEnviosMisChoferesService = async (pool, user) => {
  if (!user) throw new Error("NO_ACCESS");
  if (user.rol !== 'Chofer') {
    await assertAlgunoPermiso(pool, user, 'VER_ENVIOS_CHOFER');
  }

  return await EnviosRepository.obtenerEnviosPorChoferRepo(pool, user.empresa, user.sub);
};