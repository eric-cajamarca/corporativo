// services/ventas.service.js

const ventasRepository = require('../repositories/ventas.repository');

exports.crearVenta = async (datosVenta, idEmpresa, idUsuario) => {
  // El Service solo extrae datos y llama al Repository
  return await ventasRepository.insertar(datosVenta, idEmpresa, idUsuario);
};
