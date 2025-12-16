// src/services/productos.service.js
const {obtenerProductosTodosRepo} = require('../repositories/productos.repository');

exports.obtenerProductosTodosService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador") {
    throw new Error("NO_PERMISSIONS");
  }
  
  const productos = await obtenerProductosTodosRepo(pool, user.empresa);
  return productos;
};
