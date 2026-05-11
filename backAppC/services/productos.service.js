// src/services/productos.service.js
const ProductosRepository = require('../repositories/productos.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const permisosService = require('./permisos.service');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');
const { idsSucursalesFiltroCatalogo } = require('../utils/sucursalUsuarioScope.util');

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