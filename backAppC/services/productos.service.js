// src/services/productos.service.js
const {obtenerProductosTodosRepo} = require('../repositories/productos.repository');

exports.obtenerProductosTodosService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  if (user.rol !== "Administrador") {
    throw new Error("NO_PERMISSIONS");
  }
  
  console.log('user in service:', user);
  const productos = await obtenerProductosTodosRepo(pool, user.empresa);
  console.log('productos service:', productos);
  return productos;
};
