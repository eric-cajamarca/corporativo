const sucursalRepository = require('../repositories/sucursal.repository');
const empresaService = require('./empresa.service');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');
const { idsSucursalesFiltroCatalogo, assertSucursalPermitidaParaUsuario } = require('../utils/sucursalUsuarioScope.util');

const E = {
  NO_ACCESS: 'NO_ACCESS',
  NO_PERMISO: 'NO_PERMISO',
  NO_PERMISO_403: 'NO_PERMISO_403',
  FALTA_EMPRESA: 'FALTA_EMPRESA',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  SUCURSAL_NO_PERMITIDA: 'SUCURSAL_NO_PERMITIDA'
};

/** Listado de sucursales (resumen/todos): operaciones que necesitan elegir sucursal sin ser admin de sucursales. */
const PERMISOS_LISTAR_SUCURSALES_OPERATIVO = [
  'GESTIONAR_SUCURSALES',
  'VER_CAJA',
  'ABRIR_CAJA',
  'CERRAR_CAJA',
  'REGISTRAR_MOVIMIENTOS',
  'VER_ARQUEO',
  'CREAR_COMPRAS',
  'EDITAR_COMPRAS',
  'VER_COMPRAS',
  'VER_INVENTARIO',
  'GESTIONAR_LOTES',
  'CREAR_VENTAS',
  'EDITAR_VENTAS',
  'VER_VENTAS',
  'VER_PRODUCTOS',
  'CREAR_PRECIOS',
  'EDITAR_PRECIOS',
  'TRANSFERIR_STOCK'
];

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

async function obtenerSucursalResumen(pool, user, opciones = {}) {
  if (!user) throw new Error(E.NO_ACCESS);
  await assertAlgunoPermiso(pool, user, ...PERMISOS_LISTAR_SUCURSALES_OPERATIVO);
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  const incluirInactivas = !!opciones.incluirInactivas;
  const rol = (user.rol || '').toString();
  const sinFiltroUsuarioSucursal =
    rol === 'Administrador' || rol === 'superAdmin' || incluirInactivas;
  const idsUsuario = sinFiltroUsuarioSucursal ? null : await idsSucursalesFiltroCatalogo(pool, user);
  const rows = await sucursalRepository.listarResumenPorEmpresa(pool, idEmpresa, !incluirInactivas, idsUsuario);
  return rows;
}

async function obtenerSucursalTodos(pool, user, opciones = {}) {
  if (!user) throw new Error(E.NO_ACCESS);
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  await assertAlgunoPermiso(pool, user, ...PERMISOS_LISTAR_SUCURSALES_OPERATIVO);
  const incluirInactivas = !!opciones.incluirInactivas;
  const rol = (user.rol || '').toString();
  const sinFiltroUsuarioSucursal =
    rol === 'Administrador' || rol === 'superAdmin' || incluirInactivas;
  const idsUsuario = sinFiltroUsuarioSucursal ? null : await idsSucursalesFiltroCatalogo(pool, user);
  const rows = await sucursalRepository.listarTodosPorEmpresa(pool, idEmpresa, !incluirInactivas, idsUsuario);
  return normalizarFechaRegistro(rows);
}

/** Empresa gestora: sucursales de una empresa gestionada (o la propia). */
async function obtenerSucursalesPorEmpresaDestino(pool, user, idEmpresaDestino, opciones = {}) {
  if (!user) throw new Error(E.NO_ACCESS);
  const dest = String(idEmpresaDestino || '').trim();
  if (!dest) throw new Error(E.FALTA_EMPRESA);
  const idEmpresaJwt = idEmpresaDesdeUser(user);
  if (!idEmpresaJwt) throw new Error(E.FALTA_EMPRESA);
  const { assertEmpresaAutorizada } = require('../utils/empresaGestora.util');
  await assertEmpresaAutorizada(pool, idEmpresaJwt, dest);
  await assertAlgunoPermiso(pool, user, ...PERMISOS_LISTAR_SUCURSALES_OPERATIVO);
  const incluirInactivas = !!opciones.incluirInactivas;
  const rol = (user.rol || '').toString();
  const sinFiltroUsuarioSucursal =
    rol === 'Administrador' || rol === 'superAdmin' || incluirInactivas;
  const idsUsuario = sinFiltroUsuarioSucursal ? null : await idsSucursalesFiltroCatalogo(pool, user);
  const rows = await sucursalRepository.listarTodosPorEmpresa(pool, dest, !incluirInactivas, idsUsuario);
  return normalizarFechaRegistro(rows);
}

async function establecerPrincipal(pool, user, idSucursal) {
  if (!user) throw new Error(E.NO_ACCESS);
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  await assertAlgunoPermiso(pool, user, 'GESTIONAR_SUCURSALES');
  if (!idSucursal) throw new Error(E.BAD_REQUEST);
  const existe = await sucursalRepository.existeSucursalEnEmpresa(pool, idSucursal, idEmpresa);
  if (!existe) throw new Error(E.NOT_FOUND);
  await sucursalRepository.quitarPrincipalTodas(pool, idEmpresa);
  await sucursalRepository.marcarSucursalPrincipal(pool, idSucursal, idEmpresa);
  return { idSucursal };
}

async function editarSucursal(pool, user, body) {
  if (!user) throw new Error(E.NO_ACCESS);
  await assertAlgunoPermiso(pool, user, 'GESTIONAR_SUCURSALES');
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  const { idSucursal, id, nombre, direccion, idSucursalSeriesPadre } = body || {};
  const idSuc = idSucursal || id;
  if (!idSuc || !nombre) {
    throw new Error(E.BAD_REQUEST);
  }

  const actual = await sucursalRepository.obtenerSucursalPorId(pool, idEmpresa, idSuc);
  if (!actual) throw new Error(E.NOT_FOUND);

  let idPadreSeries = undefined;
  if (Object.prototype.hasOwnProperty.call(body || {}, 'idSucursalSeriesPadre')) {
    const raw = idSucursalSeriesPadre;
    if (raw === '' || raw === null || raw === undefined) {
      idPadreSeries = null;
    } else {
      const s = String(raw).trim();
      if (String(idSuc).toLowerCase() === s.toLowerCase()) {
        throw new Error(E.BAD_REQUEST);
      }
      const okPadre = await sucursalRepository.existeSucursalEnEmpresa(pool, s, idEmpresa);
      if (!okPadre) {
        throw new Error(E.BAD_REQUEST);
      }
      idPadreSeries = s;
    }
  }

  if (actual.esPrincipal) {
    idPadreSeries = null;
  }

  const affected = await sucursalRepository.actualizarNombreDireccion(
    pool,
    idEmpresa,
    idSuc,
    String(nombre).trim(),
    direccion != null ? String(direccion) : '',
    idPadreSeries
  );

  const finalIdPadreSeries = actual.esPrincipal
    ? null
    : idPadreSeries !== undefined
      ? idPadreSeries
      : actual.idSucursalSeriesPadre;

  if (!finalIdPadreSeries) {
    try {
      await empresaService.asegurarComprobantesPredeterminadosPorSucursal(pool, idEmpresa, idSuc);
    } catch (error) {
      console.error('contexto: comprobantes al guardar sucursal (series propias o principal):', error);
      throw error;
    }
  }

  return affected;
}

async function editarEstadoSucursal(pool, user, idSucursal, body) {
  if (!user) throw new Error(E.NO_ACCESS);
  await assertAlgunoPermiso(pool, user, 'GESTIONAR_SUCURSALES');
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
  await assertAlgunoPermiso(pool, user, 'GESTIONAR_SUCURSALES');
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error(E.FALTA_EMPRESA);
  return sucursalRepository.eliminarTodasPorEmpresa(pool, idEmpresa);
}

async function obtenerStockSucursalProducto(pool, user, idProducto, idSucursal) {
  if (!user) throw new Error(E.NO_ACCESS);
  await assertAlgunoPermiso(pool, user, 'VER_INVENTARIO', 'GESTIONAR_LOTES');
  if (!user.empresa || !idSucursal || !idProducto) throw new Error(E.BAD_REQUEST);
  await assertSucursalPermitidaParaUsuario(pool, user, idSucursal);
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
  await assertAlgunoPermiso(pool, user, 'VER_INVENTARIO', 'GESTIONAR_LOTES');
  const idsFiltro = await idsSucursalesFiltroCatalogo(pool, user);
  return sucursalRepository.listarLotesStockPorEmpresa(pool, idEmpresa, idsFiltro);
}

async function crearStockLote(pool, user, body) {
  if (!user) throw new Error(E.NO_ACCESS);
  await assertAlgunoPermiso(pool, user, 'GESTIONAR_LOTES');
  const idEmpresa = user.empresa;
  const { idSucursal, idProducto, cantidad, costoUnitario } = body || {};
  const cantidadVal = parseFloat(cantidad) || 0;
  const costoVal =
    parseFloat(costoUnitario) != null && !Number.isNaN(parseFloat(costoUnitario))
      ? parseFloat(costoUnitario)
      : 0;
  if (!idSucursal || !idProducto) throw new Error(E.BAD_REQUEST);
  await assertSucursalPermitidaParaUsuario(pool, user, idSucursal);
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
  await assertAlgunoPermiso(pool, user, 'GESTIONAR_LOTES');
  const idEmpresa = user.empresa;
  const idSucLote = await sucursalRepository.obtenerIdSucursalDeLote(pool, idEmpresa, idLote);
  if (!idSucLote) throw new Error(E.NOT_FOUND);
  await assertSucursalPermitidaParaUsuario(pool, user, idSucLote);
  return sucursalRepository.eliminarLote(pool, idEmpresa, idLote);
}

module.exports = {
  obtenerSucursalResumen,
  obtenerSucursalTodos,
  obtenerSucursalesPorEmpresaDestino,
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
