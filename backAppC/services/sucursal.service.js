const sucursalRepository = require('../repositories/sucursal.repository');

const E = {
  NO_ACCESS: 'NO_ACCESS',
  NO_PERMISO: 'NO_PERMISO',
  NO_PERMISO_403: 'NO_PERMISO_403',
  FALTA_EMPRESA: 'FALTA_EMPRESA',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST'
};

function idEmpresaDesdeUser(user) {
  return user?.empresa || user?.idEmpresa || null;
}

function normalizarFechaRegistro(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((el) => {
    const copy = { ...el };
    if (copy.fregistro && copy.fregistro instanceof Date) {
      copy.fregistro = copy.fregistro.toISOString().split('T')[0];
    }
    return copy;
  });
}

async function obtenerSucursalResumen(pool, user) {
  if (!user) throw new Error(E.NO_ACCESS);
  if (user.rol !== 'Administrador') throw new Error(E.NO_PERMISO);
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  const rows = await sucursalRepository.listarResumenPorEmpresa(pool, idEmpresa);
  return rows;
}

async function obtenerSucursalTodos(pool, user) {
  if (!user) throw new Error(E.NO_ACCESS);
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  if (user.rol !== 'Administrador') throw new Error(E.NO_PERMISO);
  const rows = await sucursalRepository.listarTodosPorEmpresa(pool, idEmpresa);
  return normalizarFechaRegistro(rows);
}

async function establecerPrincipal(pool, user, idSucursal) {
  if (!user) throw new Error(E.NO_ACCESS);
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  if (user.rol !== 'Administrador') throw new Error(E.NO_PERMISO_403);
  if (!idSucursal) throw new Error(E.BAD_REQUEST);
  const existe = await sucursalRepository.existeSucursalEnEmpresa(pool, idSucursal, idEmpresa);
  if (!existe) throw new Error(E.NOT_FOUND);
  await sucursalRepository.quitarPrincipalTodas(pool, idEmpresa);
  await sucursalRepository.marcarSucursalPrincipal(pool, idSucursal, idEmpresa);
  return { idSucursal };
}

async function editarSucursal(pool, user, body) {
  if (!user) throw new Error(E.NO_ACCESS);
  if (user.rol !== 'Administrador') throw new Error(E.NO_PERMISO);
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  const { idSucursal, nombre, direccion } = body || {};
  if (!idSucursal || !nombre) {
    throw new Error(E.BAD_REQUEST);
  }
  return sucursalRepository.actualizarNombreDireccion(
    pool,
    idEmpresa,
    idSucursal,
    String(nombre).trim(),
    direccion != null ? String(direccion) : ''
  );
}

async function editarEstadoSucursal(pool, user, idSucursal, body) {
  if (!user) throw new Error(E.NO_ACCESS);
  if (user.rol !== 'Administrador') throw new Error(E.NO_PERMISO_403);
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  const estado = body?.estado;
  const nuevoEstado = !estado;
  const affected = await sucursalRepository.actualizarEstado(pool, idEmpresa, idSucursal, nuevoEstado);
  if (affected === 0) throw new Error(E.NOT_FOUND);
  return affected;
}

async function eliminarTodasSucursalesEmpresa(pool, user) {
  if (!user) throw new Error(E.NO_ACCESS);
  if (user.rol !== 'Administrador') throw new Error(E.NO_PERMISO);
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  return sucursalRepository.eliminarTodasPorEmpresa(pool, idEmpresa);
}

async function obtenerStockSucursalProducto(pool, user, idProducto, idSucursal) {
  if (!user) throw new Error(E.NO_ACCESS);
  if (user.rol !== 'Administrador') throw new Error(E.NO_PERMISO);
  if (!user.empresa || !idSucursal || !idProducto) throw new Error(E.BAD_REQUEST);
  return sucursalRepository.listarLotesPorSucursalProducto(
    pool,
    user.empresa,
    idSucursal,
    idProducto
  );
}

async function obtenerStockSucursalesEmpresa(pool, user) {
  if (!user) throw new Error(E.NO_ACCESS);
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  if (user.rol !== 'Administrador' && user.rol !== 'Almacenero') throw new Error(E.NO_PERMISO);
  return sucursalRepository.listarLotesStockPorEmpresa(pool, idEmpresa);
}

async function crearStockLote(pool, user, body) {
  if (!user) throw new Error(E.NO_ACCESS);
  if (user.rol !== 'Administrador' && user.rol !== 'Almacenero') throw new Error(E.NO_PERMISO);
  const idEmpresa = user.empresa;
  const { idSucursal, idProducto, cantidad, costoUnitario } = body || {};
  const cantidadVal = parseFloat(cantidad) || 0;
  const costoVal =
    parseFloat(costoUnitario) != null && !Number.isNaN(parseFloat(costoUnitario))
      ? parseFloat(costoUnitario)
      : 0;
  if (!idSucursal || !idProducto) throw new Error(E.BAD_REQUEST);
  await sucursalRepository.insertarLote(pool, {
    idEmpresa,
    idSucursal,
    idProducto,
    costoUnitario: costoVal,
    cantidadIngresada: cantidadVal,
    cantidadDisponible: cantidadVal
  });
  return 1;
}

async function editarStockLote(pool, user, idLote, body) {
  if (!user || !user.empresa) throw new Error(E.NO_ACCESS);
  const { cantidad } = body || {};
  const idEmpresa = user.empresa;
  if (!idLote || cantidad == null || Number.isNaN(parseFloat(cantidad)) || parseFloat(cantidad) < 0) {
    throw new Error(E.BAD_REQUEST);
  }
  const affected = await sucursalRepository.actualizarCantidadLote(
    pool,
    idEmpresa,
    idLote,
    parseFloat(cantidad)
  );
  if (affected === 0) throw new Error(E.NOT_FOUND);
  return affected;
}

async function eliminarStockLote(pool, user, idLote) {
  if (!user) throw new Error(E.NO_ACCESS);
  if (user.rol !== 'Administrador') throw new Error(E.NO_PERMISO);
  const idEmpresa = user.empresa;
  return sucursalRepository.eliminarLote(pool, idEmpresa, idLote);
}

module.exports = {
  obtenerSucursalResumen,
  obtenerSucursalTodos,
  establecerPrincipal,
  editarSucursal,
  editarEstadoSucursal,
  eliminarTodasSucursalesEmpresa,
  obtenerStockSucursalProducto,
  obtenerStockSucursalesEmpresa,
  crearStockLote,
  editarStockLote,
  eliminarStockLote,
  errores: E
};
