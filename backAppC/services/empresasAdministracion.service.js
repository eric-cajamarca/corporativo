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

async function actualizarEmpresaDatosContacto(pool, idEmpresa, body, logoFilename) {
  const {
    rubro,
    idRubro,
    celular,
    nombreComercial,
    correo,
    alias
  } = body;
  const idRubroVal =
    idRubro != null && idRubro !== '' ? (typeof idRubro === 'string' ? parseInt(idRubro, 10) : idRubro) : null;
  const row = {
    idEmpresa,
    rubro: rubro || '',
    idRubro: idRubroVal,
    celular: celular || '',
    nombreComercial: nombreComercial || '',
    correo: correo || '',
    alias: alias || ''
  };
  if (logoFilename) {
    return empresasAdministracionRepository.actualizarEmpresaConLogoFilename(pool, {
      ...row,
      logoFilename
    });
  }
  return empresasAdministracionRepository.actualizarEmpresaSinLogo(pool, row);
}

async function cambiarEstadoEmpresa(pool, idEmpresa, estadoBody) {
  const nuevo_estado = !estadoBody;
  return empresasAdministracionRepository.actualizarEmpresaEstado(pool, idEmpresa, nuevo_estado);
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
