const EnviosRepository = require('../repositories/envios.repository');
const DespachosRepository = require('../repositories/despachos.repository');
const gestoresRepository = require('../repositories/gestores.repository');
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

/** Igual que despachos: empresa del token o gestora que gestiona a la destino. */
async function puedeUsuarioOperarEmpresaEnvio(pool, user, idEmpresaDestino) {
  if (!user?.empresa || !idEmpresaDestino) return false;
  if (String(user.empresa).toLowerCase() === String(idEmpresaDestino).toLowerCase()) return true;
  return gestoresRepository.verificarGestorGestionaEmpresa(pool, user.empresa, idEmpresaDestino);
}

/**
 * Usuario con `empresa` = dueña del envío, si el token puede operar ahí (propia o gestora).
 * @throws {Error} ENVIO_NO_ENCONTRADO | NO_PERMISSIONS
 */
async function usuarioOperativoDesdeEnvio(pool, user, idEnvio) {
  const idEmp = await EnviosRepository.obtenerIdEmpresaPorEnvioRepo(pool, idEnvio);
  if (!idEmp) throw new Error('ENVIO_NO_ENCONTRADO');
  if (!(await puedeUsuarioOperarEmpresaEnvio(pool, user, idEmp))) {
    throw new Error('NO_PERMISSIONS');
  }
  return { ...user, empresa: idEmp };
}

exports.obtenerEnviosProgramadosService = async (pool, user, filtros = {}) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaff(pool, user);

  const idEmpFiltro =
    filtros.idEmpresa != null && String(filtros.idEmpresa).trim() !== ''
      ? String(filtros.idEmpresa).trim()
      : null;

  // Empresa gestora: sin filtro explícito o filtro = propia JWT → ver envíos de gestora + gestionadas.
  if (!idEmpFiltro || idEmpFiltro.toLowerCase() === String(user.empresa).toLowerCase()) {
    const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
    if (esGestora) {
      const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
      const ids = [...new Set([String(user.empresa), ...gestionadas.map((g) => String(g.idEmpresa))])];
      return await EnviosRepository.obtenerEnviosProgramadosMultiEmpresaRepo(pool, ids, filtros);
    }
  }

  const idEmpresaListado = idEmpFiltro || String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaEnvio(pool, user, idEmpresaListado))) {
    throw new Error('NO_PERMISSIONS');
  }
  return await EnviosRepository.obtenerEnviosProgramadosRepo(pool, idEmpresaListado, filtros);
};

exports.obtenerDetalleEnvioService = async (pool, user, idEnvio) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaffOChofer(pool, user);
  const userOp = await usuarioOperativoDesdeEnvio(pool, user, idEnvio);
  const detalle = await EnviosRepository.obtenerDetalleEnvioRepo(pool, idEnvio, userOp.empresa);
  if (detalle === null) throw new Error('ENVIO_NO_ENCONTRADO');
  return detalle;
};

exports.obtenerEnviosVentaService = async (pool, user, idVenta, idEmpresaOpcional) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaff(pool, user);
  const idEmp =
    idEmpresaOpcional != null && String(idEmpresaOpcional).trim() !== ''
      ? String(idEmpresaOpcional).trim()
      : String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaEnvio(pool, user, idEmp))) {
    throw new Error('NO_PERMISSIONS');
  }
  return await EnviosRepository.obtenerEnviosVentaRepo(pool, idEmp, idVenta);
};

exports.crearEnvioService = async (pool, user, datos) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaff(pool, user);

  const idVentaNum = parseInt(String(datos.idVenta ?? ''), 10);
  if (Number.isNaN(idVentaNum)) {
    throw new Error('ID_VENTA_INVALIDO');
  }
  datos.idVenta = idVentaNum;

  const idEmpresaOperativa =
    datos.idEmpresa != null && String(datos.idEmpresa).trim() !== ''
      ? String(datos.idEmpresa).trim()
      : String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaEnvio(pool, user, idEmpresaOperativa))) {
    throw new Error('NO_PERMISSIONS');
  }

  const ventaValida = await EnviosRepository.validarVentaEmpresaRepo(pool, datos.idVenta, idEmpresaOperativa);
  if (!ventaValida) {
    throw new Error('VENTA_NO_ENCONTRADA');
  }

  if (datos.idDespacho) {
    const despOk = await DespachosRepository.validarDespachoEmpresaRepo(pool, datos.idDespacho, idEmpresaOperativa);
    if (!despOk) {
      throw new Error('DESPACHO_NO_ENCONTRADO');
    }
  }

  if (!datos.idSucursal) {
    const sucVenta = await EnviosRepository.obtenerSucursalVentaRepo(pool, datos.idVenta, idEmpresaOperativa);
    datos.idSucursal = sucVenta || user.sucursal || null;
  }
  if (!datos.idSucursal) {
    const sucDefault = await EnviosRepository.obtenerSucursalDefaultEmpresaRepo(pool, idEmpresaOperativa);
    datos.idSucursal = sucDefault || null;
  }
  if (!datos.idSucursal) {
    throw new Error('SUCURSAL_NO_DEFINIDA');
  }

  const tipoValido = await EnviosRepository.validarTipoEnvioRepo(pool, datos.idTipoEnvio);
  if (!tipoValido) {
    throw new Error('TIPO_ENVIO_INVALIDO');
  }

  if (datos.idTransportista) {
    const idEmpTransportista = await EnviosRepository.obtenerIdEmpresaTransportistaActivaRepo(pool, datos.idTransportista);
    if (!idEmpTransportista) {
      throw new Error('TRANSPORTISTA_NO_ENCONTRADO');
    }
    if (!(await puedeUsuarioOperarEmpresaEnvio(pool, user, idEmpTransportista))) {
      throw new Error('NO_PERMISSIONS');
    }
    const transportistaValido = await EnviosRepository.validarTransportistaEmpresaRepo(
      pool,
      datos.idTransportista,
      idEmpTransportista
    );
    if (!transportistaValido) {
      throw new Error('TRANSPORTISTA_NO_ENCONTRADO');
    }
  }

  if (datos.idChofer) {
    const idEmpChofer = await EnviosRepository.obtenerIdEmpresaChoferActivaRepo(pool, datos.idChofer);
    if (!idEmpChofer) {
      throw new Error('CHOFER_NO_ENCONTRADO');
    }
    if (!(await puedeUsuarioOperarEmpresaEnvio(pool, user, idEmpChofer))) {
      throw new Error('NO_PERMISSIONS');
    }
    const choferValido = await EnviosRepository.validarChoferEmpresaRepo(pool, datos.idChofer, idEmpChofer);
    if (!choferValido) {
      throw new Error('CHOFER_NO_ENCONTRADO');
    }
    if (!datos.idVehiculoEntrega) {
      const idVehiculoChofer = await EnviosRepository.obtenerVehiculoChoferRepo(pool, datos.idChofer, idEmpChofer);
      datos.idVehiculoEntrega = idVehiculoChofer || null;
    }
  }

  datos.idEmpresaOperativa = idEmpresaOperativa;
  return await EnviosRepository.crearEnvioRepo(pool, user, datos);
};

exports.actualizarEstadoEnvioService = async (pool, user, datos) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaffOChofer(pool, user);

  const userOp = await usuarioOperativoDesdeEnvio(pool, user, datos.idEnvio);
  const envioInfo = await EnviosRepository.obtenerEnvioParaValidarRolRepo(pool, datos.idEnvio, userOp.empresa);
  if (!envioInfo?.existe) {
    throw new Error('ENVIO_NO_ENCONTRADO');
  }

  const soloChofer = await esSoloChoferEnvios(pool, user);
  if (soloChofer) {
    if (!envioInfo.idChoferUsuario || envioInfo.idChoferUsuario !== user.sub) {
      throw new Error('NO_PERMISSIONS');
    }
  }

  const estadoValido = await EnviosRepository.validarEstadoEnvioRepo(pool, datos.idEstadoEnvio);
  if (!estadoValido) {
    throw new Error('ESTADO_ENVIO_INVALIDO');
  }

  const nombreTarget = await EnviosRepository.obtenerNombreEstadoEnvioPorIdRepo(pool, datos.idEstadoEnvio);
  if (nombreTarget === 'AGENDADO') {
    throw new Error('AGENDADO_NO_MANUAL');
  }

  return await EnviosRepository.actualizarEstadoEnvioRepo(pool, userOp, datos);
};

exports.actualizarEnvioService = async (pool, user, datos) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaff(pool, user);
  const userOp = await usuarioOperativoDesdeEnvio(pool, user, datos.idEnvio);
  const result = await EnviosRepository.actualizarEnvioRepo(pool, userOp, datos);
  if (result === null) throw new Error('ENVIO_NO_ENCONTRADO');
  return result;
};

exports.eliminarEnvioService = async (pool, user, idEnvio) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaff(pool, user);
  const userOp = await usuarioOperativoDesdeEnvio(pool, user, idEnvio);
  const est = await EnviosRepository.obtenerEstadoNombreEnvioPorIdEnvioRepo(pool, idEnvio, userOp.empresa);
  const nombre = (est?.nombreEstado || '').trim();
  if (nombre !== 'AGENDADO') {
    throw new Error('SOLO_ELIMINAR_EN_AGENDADO');
  }
  const ok = await EnviosRepository.eliminarEnvioRepo(pool, idEnvio, userOp.empresa);
  if (!ok) throw new Error('ENVIO_NO_ENCONTRADO');
  return { mensaje: 'Envío eliminado' };
};

exports.asignarTransportistaService = async (pool, user, datos) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaff(pool, user);
  const userOp = await usuarioOperativoDesdeEnvio(pool, user, datos.idEnvio);
  const envioValido = await EnviosRepository.validarEnvioEmpresaRepo(pool, datos.idEnvio, userOp.empresa);
  if (!envioValido) {
    throw new Error('ENVIO_NO_ENCONTRADO');
  }
  const idEmpTransportista = await EnviosRepository.obtenerIdEmpresaTransportistaActivaRepo(pool, datos.idTransportista);
  if (!idEmpTransportista) {
    throw new Error('TRANSPORTISTA_NO_ENCONTRADO');
  }
  if (!(await puedeUsuarioOperarEmpresaEnvio(pool, user, idEmpTransportista))) {
    throw new Error('NO_PERMISSIONS');
  }
  const transportistaValido = await EnviosRepository.validarTransportistaEmpresaRepo(
    pool,
    datos.idTransportista,
    idEmpTransportista
  );
  if (!transportistaValido) {
    throw new Error('TRANSPORTISTA_NO_ENCONTRADO');
  }
  return await EnviosRepository.asignarTransportistaRepo(pool, userOp, datos);
};

exports.obtenerTransportistasService = async (pool, user, idEmpresaOpcional) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaff(pool, user);
  const idEmpF =
    idEmpresaOpcional != null && String(idEmpresaOpcional).trim() !== ''
      ? String(idEmpresaOpcional).trim()
      : null;

  if (!idEmpF || idEmpF.toLowerCase() === String(user.empresa).toLowerCase()) {
    const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
    if (esGestora) {
      const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
      const ids = [...new Set([String(user.empresa), ...gestionadas.map((g) => String(g.idEmpresa))])];
      return await EnviosRepository.obtenerTransportistasMultiEmpresaRepo(pool, ids);
    }
  }

  const idEmp = idEmpF || String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaEnvio(pool, user, idEmp))) {
    throw new Error('NO_PERMISSIONS');
  }
  return await EnviosRepository.obtenerTransportistasRepo(pool, idEmp);
};

exports.crearTransportistaService = async (pool, user, datos) => {
  if (!user) throw new Error('NO_ACCESS');
  if (user.rol !== 'Administrador' && user.rol !== 'Vendedor') {
    throw new Error('NO_PERMISSIONS');
  }
  const idEmp =
    datos.idEmpresa != null && String(datos.idEmpresa).trim() !== ''
      ? String(datos.idEmpresa).trim()
      : String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaEnvio(pool, user, idEmp))) {
    throw new Error('NO_PERMISSIONS');
  }
  return await EnviosRepository.crearTransportistaRepo(pool, idEmp, datos);
};

exports.obtenerTiposEnvioService = async (pool, user) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaffOChofer(pool, user);
  return await EnviosRepository.obtenerTiposEnvioRepo(pool);
};

exports.obtenerEstadosEnvioService = async (pool, user) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaffOChofer(pool, user);
  return await EnviosRepository.obtenerEstadosEnvioRepo(pool);
};

exports.obtenerEnviosPorEstadoService = async (pool, user, estado, idEmpresaOpcional) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaff(pool, user);
  const idEmp =
    idEmpresaOpcional != null && String(idEmpresaOpcional).trim() !== ''
      ? String(idEmpresaOpcional).trim()
      : String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaEnvio(pool, user, idEmp))) {
    throw new Error('NO_PERMISSIONS');
  }
  return await EnviosRepository.obtenerEnviosPorEstadoRepo(pool, idEmp, estado);
};

exports.obtenerEnviosPorTransportistaService = async (pool, user, idTransportista, idEmpresaOpcional) => {
  if (!user) throw new Error('NO_ACCESS');
  await assertEnviosStaff(pool, user);
  const idEmp =
    idEmpresaOpcional != null && String(idEmpresaOpcional).trim() !== ''
      ? String(idEmpresaOpcional).trim()
      : String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaEnvio(pool, user, idEmp))) {
    throw new Error('NO_PERMISSIONS');
  }
  return await EnviosRepository.obtenerEnviosPorTransportistaRepo(pool, idEmp, idTransportista);
};

exports.obtenerEnviosMisChoferesService = async (pool, user) => {
  if (!user) throw new Error('NO_ACCESS');
  if (user.rol !== 'Chofer') {
    await assertAlgunoPermiso(pool, user, 'VER_ENVIOS_CHOFER');
  }
  return await EnviosRepository.obtenerEnviosPorChoferRepo(pool, user.empresa, user.sub);
};
