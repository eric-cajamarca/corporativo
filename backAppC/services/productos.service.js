// src/services/productos.service.js
const ProductosRepository = require('../repositories/productos.repository');

exports.obtenerProductosTodosService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador") {
    throw new Error("NO_PERMISSIONS");
  }
  
  const productos = await ProductosRepository.obtenerProductosTodosRepo(pool, user.empresa);
  return productos;
};

exports.obtenerProductosComprasService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador") {
    throw new Error("NO_PERMISSIONS");
  }

  const productos = await ProductosRepository.obtenerProductosCompras(pool, user.empresa);
  return productos;
};

exports.obtenerProductoPorIdService = async (pool, idProducto, user) => {
  // SIEMPRE valida reglas de negocio (regla 1.3)
  if (!user || !user.empresa) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador") {
    throw new Error("NO_PERMISSIONS");
  }

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