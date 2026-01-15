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