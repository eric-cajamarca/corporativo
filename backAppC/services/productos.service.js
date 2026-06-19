// src/services/productos.service.js
const ProductosRepository = require('../repositories/productos.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const sucursalRepository = require('../repositories/sucursal.repository');
const permisosService = require('./permisos.service');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');
const { idsSucursalesFiltroCatalogo } = require('../utils/sucursalUsuarioScope.util');
const cache = require('../cache/redis.client');
const { parseTtlSeconds } = require('../utils/cacheSkip.util');

function buscarVentaCacheKey(user, term, limite, idSucursalVenta) {
  const emp = String(user?.empresa || '').trim().toLowerCase();
  const uid = String(user?.idUsuario || user?.id || '').trim().toLowerCase();
  const rol = String(user?.rol || '').trim().toLowerCase();
  const q = String(term || '').trim().toLowerCase();
  const lim = Math.min(100, Math.max(1, parseInt(limite, 10) || 80));
  const suc = idSucursalVenta ? String(idSucursalVenta).trim().toLowerCase() : 'all';
  return `productos:buscar-venta:v1:${emp}:${uid}:${rol}:${q}:${lim}:${suc}`;
}

exports.obtenerProductosTodosService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const esAdmin = user.rol === "Administrador";
  const puedeVerLista =
    esAdmin ||
    (await permisosService.verificarPermisoUsuario(pool, "CREAR_VENTAS", user)) ||
    (await permisosService.verificarPermisoUsuario(pool, "VER_PRODUCTOS", user));

  if (!puedeVerLista) {
    throw new Error("NO_PERMISSIONS");
  }

  // Solo la empresa gestora (origen activo en Gestores_Empresas) ve stock de las empresas que gestiona.
  // Empresa gestionada o independiente: únicamente productos de su propia empresa (token).
  const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
  let idsEmpresa;
  if (esGestora) {
    const empresasGestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
    idsEmpresa = [
      user.empresa,
      ...(empresasGestionadas || []).map((e) => e.idEmpresa).filter(Boolean)
    ];
  } else {
    idsEmpresa = [user.empresa];
  }
  const rol = (user.rol || '').toString();
  const idsSucFiltro =
    esAdmin || rol === 'superAdmin' ? null : await idsSucursalesFiltroCatalogo(pool, user);
  const productos = await ProductosRepository.obtenerProductosTodosMultiEmpresaRepo(pool, idsEmpresa, idsSucFiltro);
  return productos;
};

exports.listarProductosPaginadoService = async (pool, user, query = {}) => {
  if (!user) throw new Error('NO_ACCESS');
  const esAdmin = user.rol === 'Administrador';
  const puedeVerLista =
    esAdmin ||
    (await permisosService.verificarPermisoUsuario(pool, 'CREAR_VENTAS', user)) ||
    (await permisosService.verificarPermisoUsuario(pool, 'VER_PRODUCTOS', user));
  if (!puedeVerLista) throw new Error('NO_PERMISSIONS');

  const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
  let idsEmpresa;
  if (esGestora) {
    const empresasGestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
    idsEmpresa = [user.empresa, ...(empresasGestionadas || []).map((e) => e.idEmpresa).filter(Boolean)];
  } else {
    idsEmpresa = [user.empresa];
  }
  const { parsePaginacion } = require('../utils/paginacion.util');
  const pag = parsePaginacion(query);
  return ProductosRepository.listarProductosPaginadoRepo(pool, idsEmpresa, {
    pagina: pag.pagina,
    porPagina: pag.porPagina,
    buscar: query.buscar
  });
};

/** Misma autorización y alcance multiempresa que el listado completo; búsqueda con límite para modal de ventas. */
exports.buscarProductosVentaService = async (pool, user, termino, limite, idSucursalVenta, options = {}) => {
  if (!user) {
    throw new Error('NO_ACCESS');
  }

  const term = String(termino || '').trim();
  if (term.length < 2) {
    throw new Error('TERMINO_CORTO');
  }

  const esAdmin = user.rol === 'Administrador';
  const puedeVerLista =
    esAdmin ||
    (await permisosService.verificarPermisoUsuario(pool, 'CREAR_VENTAS', user)) ||
    (await permisosService.verificarPermisoUsuario(pool, 'VER_PRODUCTOS', user));

  if (!puedeVerLista) {
    throw new Error('NO_PERMISSIONS');
  }

  const tokens = term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
  let idsEmpresa;
  if (esGestora) {
    const empresasGestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
    idsEmpresa = [
      user.empresa,
      ...(empresasGestionadas || []).map((e) => e.idEmpresa).filter(Boolean)
    ];
  } else {
    idsEmpresa = [user.empresa];
  }

  const rol = (user.rol || '').toString();
  const idsSucFiltro =
    esAdmin || rol === 'superAdmin' ? null : await idsSucursalesFiltroCatalogo(pool, user);

  let idSucursalFiltro = null;
  if (idSucursalVenta && String(idSucursalVenta).trim()) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(String(idSucursalVenta).trim())) {
      throw new Error('ID_SUCURSAL_INVALIDO');
    }
    idSucursalFiltro = String(idSucursalVenta).trim();
  }

  const lim = Math.min(100, Math.max(1, parseInt(limite, 10) || 80));
  const skipCache = options.skipCache === true;
  const ttlSeconds = parseTtlSeconds('REDIS_BUSCAR_VENTA_TTL_SECONDS', 120, 30);

  const fetchFn = () =>
    ProductosRepository.buscarProductosVentaRepo(
      pool,
      idsEmpresa,
      idsSucFiltro,
      tokens,
      lim,
      idSucursalFiltro
    );

  if (skipCache) {
    return fetchFn();
  }

  const cacheKey = buscarVentaCacheKey(user, term, lim, idSucursalFiltro);
  return cache.getCached(cacheKey, fetchFn, ttlSeconds);
};

exports.obtenerProductosComprasService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, "VER_COMPRAS", "CREAR_COMPRAS", "EDITAR_COMPRAS", "VER_PRODUCTOS");

  const rol = (user.rol || '').toString();
  const idsSucFiltro =
    rol === 'Administrador' || rol === 'superAdmin'
      ? null
      : await idsSucursalesFiltroCatalogo(pool, user);
  const productos = await ProductosRepository.obtenerProductosCompras(pool, user.empresa, idsSucFiltro);
  return productos;
};

exports.obtenerProductoPorIdService = async (pool, idProducto, user) => {
  // SIEMPRE valida reglas de negocio (regla 1.3)
  if (!user || !user.empresa) {
    throw new Error("NO_ACCESS");
  }

  await assertAlgunoPermiso(pool, user, "VER_PRODUCTOS", "CREAR_PRODUCTOS", "EDITAR_PRODUCTOS", "CREAR_COMPRAS", "EDITAR_COMPRAS");

  // Validar que idProducto sea UUID válido
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(idProducto)) {
    throw new Error("ID_PRODUCTO_INVALIDO");
  }

  const producto = await ProductosRepository.obtenerProductoPorIdRepo(pool, idProducto, user.empresa);

  if (!producto) {
    throw new Error("PRODUCTO_NO_ENCONTRADO");
  }

  return producto;
};

/**
 * Dado un array de descripciones, retorna los idProducto que coinciden (misma empresa, descripción igual tras trim).
 * Para uso en compras al cargar detalle desde XML.
 */
exports.matchProductosPorDescripcionService = async (pool, user, descripciones) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const list = Array.isArray(descripciones) ? descripciones.map(d => (d || "").trim()).filter(Boolean) : [];
  if (list.length === 0) return [];
  const todos = await ProductosRepository.obtenerProductosPorDescripcionRepo(pool, user.empresa);
  const mapDesc = {};
  todos.forEach(p => {
    const d = (p.descripcion || "").trim();
    if (d && !mapDesc[d]) mapDesc[d] = p.idProducto;
  });
  return list.map(desc => ({ descripcion: desc, idProducto: mapDesc[desc] || null }));
};

exports.obtenerStockUbicacionesProductoSucursalService = async (pool, idProducto, idSucursal, user) => {
  if (!user || !user.empresa) {
    throw new Error('NO_ACCESS');
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(idProducto)) {
    throw new Error('ID_PRODUCTO_INVALIDO');
  }
  if (!uuidRegex.test(idSucursal)) {
    throw new Error('ID_SUCURSAL_INVALIDO');
  }
  await assertAlgunoPermiso(
    pool,
    user,
    'VER_PRODUCTOS',
    'CREAR_VENTAS',
    'EDITAR_VENTAS',
    'CREAR_COMPRAS',
    'EDITAR_COMPRAS'
  );
  const idEmpresaProducto = await ProductosRepository.obtenerIdEmpresaProductoPorId(pool, idProducto);
  if (!idEmpresaProducto) {
    throw new Error('PRODUCTO_NO_ENCONTRADO');
  }
  const empresaDelToken = String(user.empresa).toLowerCase();
  const empresaProducto = String(idEmpresaProducto).toLowerCase();
  const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
  if (esGestora) {
    const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
    const permitidas = new Set([
      empresaDelToken,
      ...(Array.isArray(gestionadas) ? gestionadas : [])
        .map((e) => String(e.idEmpresa || '').toLowerCase())
        .filter(Boolean)
    ]);
    if (!permitidas.has(empresaProducto)) {
      throw new Error('PRODUCTO_NO_ENCONTRADO');
    }
  } else if (empresaProducto !== empresaDelToken) {
    throw new Error('PRODUCTO_NO_ENCONTRADO');
  }
  const ex = await sucursalRepository.existeSucursalEnEmpresa(pool, idSucursal, idEmpresaProducto);
  if (!ex) {
    throw new Error('SUCURSAL_INVALIDA');
  }
  return ProductosRepository.listarStockUbicacionesProductoSucursal(pool, idEmpresaProducto, idSucursal, idProducto);
};