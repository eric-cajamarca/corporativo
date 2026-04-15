const gestoresRepository = require('../repositories/gestores.repository');
const proveedorRepository = require('../repositories/proveedor.repository');

async function idsEmpresaConGestionadas(pool, idEmpresaRaiz) {
  const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaRaiz);
  return [idEmpresaRaiz, ...(gestionadas || []).map((g) => g.idEmpresa).filter(Boolean)];
}

async function crearProveedor(pool, user, body) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador' && user.rol !== 'Almacenero') throw new Error('NO_PERM');
  const idEmpresa = user.empresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  const { idDocumento, ruc, rSocial, correo, celular, condicion } = body;
  const existe = await proveedorRepository.existeRucEnEmpresa(pool, idEmpresa, ruc);
  if (existe) {
    const err = new Error('RUC_DUPLICADO');
    err.code = 'RUC_DUPLICADO';
    throw err;
  }
  const r = await proveedorRepository.insertar(pool, {
    idEmpresa,
    idDocumento,
    ruc,
    rSocial,
    correo,
    celular,
    condicion
  });
  return r.rowsAffected;
}

async function listarProveedores(pool, user) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  if (user.rol !== 'Administrador' && user.rol !== 'Vendedor') throw new Error('NO_PERM');
  const ids = await idsEmpresaConGestionadas(pool, idEmpresa);
  return proveedorRepository.listarPorEmpresas(pool, ids);
}

async function listarPorRuc(pool, user, ruc) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  if (user.rol !== 'Administrador' && user.rol !== 'Vendedor') throw new Error('NO_PERM');
  const ids = await idsEmpresaConGestionadas(pool, idEmpresa);
  return proveedorRepository.listarPorRucEmpresas(pool, ids, ruc);
}

async function listarPorId(pool, user, idProveedor) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  if (user.rol !== 'Administrador' && user.rol !== 'Almacenero') throw new Error('NO_PERM');
  const ids = await idsEmpresaConGestionadas(pool, idEmpresa);
  return proveedorRepository.listarPorIdProveedorEmpresas(pool, ids, idProveedor);
}

async function actualizarProveedor(pool, user, idProveedor, body) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  if (user.rol !== 'Administrador' && user.rol !== 'Vendedor') throw new Error('NO_PERM');
  const { idDocumento, ruc, rSocial, correo, celular, condicion } = body;
  const ids = await idsEmpresaConGestionadas(pool, idEmpresa);
  const updateResult = await proveedorRepository.actualizarEnEmpresas(pool, ids, {
    idProveedor,
    idDocumento,
    ruc,
    rSocial,
    correo,
    celular,
    condicion
  });
  if (!updateResult.rowsAffected || updateResult.rowsAffected[0] === 0) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return updateResult.rowsAffected[0];
}

async function eliminarProveedor(pool, user, idProveedor) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador') throw new Error('NO_PERM');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  const tiene = await proveedorRepository.tieneCompras(pool, idProveedor);
  if (tiene) {
    const err = new Error('TIENE_COMPRAS');
    err.code = 'TIENE_COMPRAS';
    throw err;
  }
  const ids = await idsEmpresaConGestionadas(pool, idEmpresa);
  const deleteResult = await proveedorRepository.eliminarEnEmpresas(pool, ids, idProveedor);
  return deleteResult.rowsAffected[0];
}

async function cambiarCondicion(pool, user, idProveedor, condicionActual) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador') throw new Error('NO_PERM');
  const idEmpresa = user.empresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  const nuevacondicion = condicionActual === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
  return proveedorRepository.actualizarCondicion(pool, idProveedor, nuevacondicion, idEmpresa);
}

async function cambiarEstado(pool, user, idProveedor, estadoBody) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador') throw new Error('NO_PERM');
  const idEmpresa = user.empresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  const nuevoEstado = estadoBody ? 0 : 1;
  return proveedorRepository.actualizarEstado(pool, idProveedor, nuevoEstado, idEmpresa);
}

async function crearDireccion(pool, user, body) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador') throw new Error('NO_PERM');
  const idEmpresa = user.empresa;
  const {
    idProveedor,
    ubigeo,
    codpais,
    region,
    provincia,
    distrito,
    urbanizacion,
    direccion,
    referencia,
    codLocal,
    principal
  } = body;
  return proveedorRepository.insertarDireccion(pool, {
    idEmpresa,
    idProveedor,
    ubigeo,
    codPais: codpais,
    region,
    provincia,
    distrito,
    urbanizacion,
    direccion,
    referencia,
    codLocal,
    principal
  });
}

async function listarDireccionesEmpresa(pool, user) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador') throw new Error('NO_PERM');
  return proveedorRepository.listarDireccionesPorEmpresa(pool, user.empresa);
}

async function listarDireccionesPorProveedor(pool, user, idProveedor) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador') throw new Error('NO_PERM');
  const ids = await idsEmpresaConGestionadas(pool, user.empresa);
  return proveedorRepository.listarDireccionesPorProveedorYEmpresas(pool, ids, idProveedor);
}

async function actualizarDireccion(pool, user, idDireccionProveedor, body) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador') throw new Error('NO_PERM');
  const row = await proveedorRepository.obtenerDireccionPorId(pool, idDireccionProveedor, user.empresa);
  if (!row) throw new Error('NOT_FOUND');
  const {
    idProveedor,
    ubigeo,
    codPais,
    region,
    provincia,
    distrito,
    urbanizacion,
    direccion,
    referencia,
    codLocal,
    principal
  } = body;
  return proveedorRepository.actualizarDireccion(pool, {
    idDireccionProveedor,
    idProveedor,
    ubigeo,
    codPais,
    region,
    provincia,
    distrito,
    urbanizacion,
    direccion,
    referencia,
    codLocal,
    principal: principal === true || principal === 1
  });
}

async function eliminarDireccion(pool, user, idDireccionProveedor) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador') throw new Error('NO_PERM');
  const row = await proveedorRepository.obtenerDireccionPorId(pool, idDireccionProveedor, user.empresa);
  if (!row) throw new Error('NOT_FOUND');
  return proveedorRepository.eliminarDireccion(pool, idDireccionProveedor);
}

module.exports = {
  crearProveedor,
  listarProveedores,
  listarPorRuc,
  listarPorId,
  actualizarProveedor,
  eliminarProveedor,
  cambiarCondicion,
  cambiarEstado,
  crearDireccion,
  listarDireccionesEmpresa,
  listarDireccionesPorProveedor,
  actualizarDireccion,
  eliminarDireccion
};
