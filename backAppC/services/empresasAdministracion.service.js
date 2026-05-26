const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const empresasAdministracionRepository = require('../repositories/empresasAdministracion.repository');
const saasPlanLimitesService = require('./saasPlanLimites.service');

async function listarTodas(pool) {
  return empresasAdministracionRepository.listarTodasEmpresas(pool);
}

async function obtenerPorId(pool, idEmpresa) {
  return empresasAdministracionRepository.obtenerEmpresaPorId(pool, idEmpresa);
}

async function obtenerCabecera(pool, idEmpresa) {
  return empresasAdministracionRepository.obtenerEmpresaCabecera(pool, idEmpresa);
}

async function buscarPorRuc(pool, ruc) {
  return empresasAdministracionRepository.buscarEmpresaPorRuc(pool, ruc);
}

async function insertarEmpresa(pool, payload) {
  return empresasAdministracionRepository.insertarEmpresa(pool, payload);
}

async function obtenerIntegracionesYCredenciales(pool, idEmpresa) {
  const [integracionesRes, credencialesRes] = await Promise.all([
    empresasAdministracionRepository.obtenerIntegraciones(pool, idEmpresa),
    empresasAdministracionRepository.obtenerCredencialesApi(pool, idEmpresa)
  ]);
  return { integracionesRes, credencialesRes };
}

async function guardarIntegracionesFlags(pool, idEmpresa, body) {
  const {
    twilioHabilitado,
    izipayHabilitado,
    culqiHabilitado,
    apisPeruHabilitado,
    factilizaHabilitado
  } = body || {};
  await empresasAdministracionRepository.mergeEmpresaIntegraciones(pool, {
    idEmpresa,
    twilio: twilioHabilitado ? 1 : 0,
    izipay: izipayHabilitado ? 1 : 0,
    culqi: culqiHabilitado ? 1 : 0,
    apisPeru: apisPeruHabilitado ? 1 : 0,
    factiliza: factilizaHabilitado ? 1 : 0
  });
}

async function reemplazarCredencialesProveedor(pool, idEmpresa, proveedor, credenciales) {
  const proveedorNorm = String(proveedor).toLowerCase().trim();
  await empresasAdministracionRepository.eliminarCredencialesProveedor(pool, idEmpresa, proveedorNorm);
  for (const item of credenciales || []) {
    const clave = String(item.clave || '').trim();
    const valor = String(item.valor ?? '').trim();
    if (!clave) continue;
    await empresasAdministracionRepository.insertarCredencialApi(pool, {
      idEmpresa,
      proveedor: proveedorNorm,
      clave,
      valor
    });
  }
}

async function obtenerEmpresaCelularEstado(pool, idEmpresa) {
  return empresasAdministracionRepository.obtenerEmpresaCelularEstado(pool, idEmpresa);
}

/** undefined = no enviar el campo (no tocar BD). */
function parsePermitirVentaMultiSucursalDesdeBody(body) {
  if (!body || !Object.prototype.hasOwnProperty.call(body, 'permitirVentaMultiSucursal')) {
    return undefined;
  }
  const v = body.permitirVentaMultiSucursal;
  if (v === true || v === 1 || v === '1') return true;
  if (v === false || v === 0 || v === '0' || v === '' || v == null) return false;
  const s = String(v).toLowerCase().trim();
  return s === 'true' || s === 'on';
}

async function actualizarEmpresaDatosContacto(pool, idEmpresa, body, logoFilename) {
  const actualArr = await empresasAdministracionRepository.obtenerEmpresaPorId(pool, idEmpresa);
  const actual = Array.isArray(actualArr) ? actualArr[0] : actualArr;
  if (!actual) {
    throw new Error('EMPRESA_NO_ENCONTRADA');
  }
  const tienePropEnBody = (k) => body != null && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, k);
  const tomarTexto = (k) => {
    if (!tienePropEnBody(k)) return actual[k] != null ? String(actual[k]) : '';
    const v = body[k];
    return v == null ? '' : String(v);
  };
  const idRubroResuelto = tienePropEnBody('idRubro')
    ? (body.idRubro != null && body.idRubro !== ''
        ? (typeof body.idRubro === 'string' ? parseInt(body.idRubro, 10) : body.idRubro)
        : null)
    : (actual.idRubro != null ? actual.idRubro : null);
  const permitirEnBody = parsePermitirVentaMultiSucursalDesdeBody(body);
  const permitirResuelto = permitirEnBody === undefined
    ? !!actual.permitirVentaMultiSucursal
    : permitirEnBody;
  const row = {
    idEmpresa,
    rubro: tomarTexto('rubro'),
    idRubro: idRubroResuelto,
    celular: tomarTexto('celular'),
    nombreComercial: tomarTexto('nombreComercial'),
    correo: tomarTexto('correo'),
    alias: tomarTexto('alias'),
    permitirVentaMultiSucursal: permitirResuelto
  };
  if (logoFilename) {
    return empresasAdministracionRepository.actualizarEmpresaConLogoFilename(pool, {
      ...row,
      logoFilename
    });
  }
  return empresasAdministracionRepository.actualizarEmpresaSinLogo(pool, row);
}

async function cambiarEstadoEmpresa(pool, idEmpresa, nuevoEstado) {
  if (typeof nuevoEstado !== 'boolean') {
    throw new Error('nuevoEstado debe ser boolean');
  }
  return empresasAdministracionRepository.actualizarEmpresaEstado(pool, idEmpresa, nuevoEstado);
}

async function crearDireccionEmpresa(pool, payload) {
  const {
    idEmpresa,
    ubigeo,
    codPais,
    region,
    provincia,
    distrito,
    urbanizacion,
    direccion,
    principal,
    codLocal,
    crearSucursal,
    nombreSucursal
  } = payload;
  if (principal) {
    await empresasAdministracionRepository.direccionEmpresaResetPrincipal(pool, idEmpresa);
    await empresasAdministracionRepository.sucursalResetPrincipal(pool, idEmpresa);
  }
  const insertDireccionEmpresa = await empresasAdministracionRepository.insertarDireccionEmpresa(pool, {
    idEmpresa,
    ubigeo,
    codPais,
    region,
    provincia,
    distrito,
    urbanizacion,
    direccion,
    codLocal,
    principal
  });
  if (principal) {
    const dirTexto = direccion != null && direccion !== undefined ? String(direccion).trim() : '';
    await empresasAdministracionRepository.sucursalActualizarPrincipalDireccion(
      pool,
      idEmpresa,
      dirTexto || null
    );
  }
  if (crearSucursal === true && nombreSucursal && String(nombreSucursal).trim()) {
    const idSucursal = uuidv4();
    await empresasAdministracionRepository.insertarSucursalConPrincipal(pool, {
      idSucursal,
      idEmpresa,
      nombre: String(nombreSucursal).trim(),
      direccion: direccion || '',
      esPrincipal: !!principal,
      fregistro: moment().format('YYYY-MM-DD'),
      estado: true
    });
  }
  return insertDireccionEmpresa;
}

async function crearSucursalEmpresa(pool, payload) {
  const { idEmpresa, nombre, direccion } = payload;
  await saasPlanLimitesService.assertPuedeCrearSucursal(pool, idEmpresa);
  const idSucursal = uuidv4();
  await empresasAdministracionRepository.insertarSucursalSimple(pool, {
    idSucursal,
    idEmpresa,
    nombre,
    direccion: direccion != null ? String(direccion) : '',
    fregistro: moment().format('YYYY-MM-DD'),
    estado: true
  });
  await empresasAdministracionRepository.sucursalVincularSeriesPadreSiSecundaria(pool, idEmpresa, idSucursal);
  return { idSucursal, nombre, direccion };
}

async function actualizarDireccionEmpresaCompleto(pool, idEmpresa, body) {
  const {
    idDireccionEmpresa,
    ubigeo,
    codPais,
    region,
    provincia,
    distrito,
    urbanizacion,
    direccion,
    codLocal,
    principal
  } = body;
  const id = idDireccionEmpresa;
  const previo = await empresasAdministracionRepository.obtenerDireccionEmpresaPorId(pool, id);
  const direccionAnterior = previo?.direccion;
  const principalAnterior = previo?.principal === true || previo?.principal === 1;
  if (principal && idEmpresa) {
    await empresasAdministracionRepository.direccionEmpresaResetPrincipal(pool, idEmpresa);
    await empresasAdministracionRepository.sucursalResetPrincipal(pool, idEmpresa);
  }
  const result = await empresasAdministracionRepository.actualizarDireccionEmpresa(pool, {
    id,
    ubigeo,
    codPais,
    region,
    provincia,
    distrito,
    urbanizacion,
    direccion,
    codLocal,
    principal
  });
  if (idEmpresa) {
    const dirTexto = direccion != null && direccion !== undefined ? String(direccion).trim() : '';
    if (principal) {
      await empresasAdministracionRepository.sucursalActualizarPrincipalDireccion(
        pool,
        idEmpresa,
        dirTexto || null
      );
    }
    if (principalAnterior && !principal) {
      await empresasAdministracionRepository.sucursalQuitarPrincipalNombre(pool, idEmpresa);
    }
    if (direccionAnterior != null && String(direccionAnterior).trim() !== dirTexto) {
      await empresasAdministracionRepository.sucursalActualizarDireccionPorEmpresaYDireccionAnterior(pool, {
        idEmpresa,
        direccionAnterior: String(direccionAnterior),
        direccionNueva: dirTexto || null,
        esPrincipal: !!principal
      });
    }
  }
  return result;
}

async function cambiarPrincipalDireccion(pool, idEmpresa, idDireccionEmpresa) {
  await empresasAdministracionRepository.direccionEmpresaSetPrincipalFalseTodas(pool, idEmpresa);
  return empresasAdministracionRepository.direccionEmpresaSetPrincipalTrue(pool, idDireccionEmpresa);
}

module.exports = {
  listarTodas,
  obtenerPorId,
  obtenerCabecera,
  buscarPorRuc,
  insertarEmpresa,
  obtenerIntegracionesYCredenciales,
  guardarIntegracionesFlags,
  reemplazarCredencialesProveedor,
  obtenerEmpresaCelularEstado,
  actualizarEmpresaDatosContacto,
  cambiarEstadoEmpresa,
  crearDireccionEmpresa,
  crearSucursalEmpresa,
  actualizarDireccionEmpresaCompleto,
  listarDireccionesEmpresa: (pool, idEmpresa) =>
    empresasAdministracionRepository.listarDireccionesEmpresa(pool, idEmpresa),
  eliminarDireccionEmpresa: (pool, id) =>
    empresasAdministracionRepository.eliminarDireccionEmpresa(pool, id),
  direccionEmpresaSetPrincipalFalseTodas: (pool, idEmpresa) =>
    empresasAdministracionRepository.direccionEmpresaSetPrincipalFalseTodas(pool, idEmpresa),
  direccionEmpresaSetPrincipalTrue: (pool, idDireccionEmpresa) =>
    empresasAdministracionRepository.direccionEmpresaSetPrincipalTrue(pool, idDireccionEmpresa),
  cambiarPrincipalDireccion
};
