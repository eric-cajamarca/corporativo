// services/empresa.service.js
const empresaRepository = require('../repositories/empresa.repository');

exports.getDatosEmpresaLogin = async (pool, userData) => {
  // Obtiene datos de empresa desde el repository
  const empresa = await empresaRepository.obtenerRazonSocial(pool, userData.empresa);
  
  // Construye objeto de respuesta
  const data = {
    razonSocial: empresa?.razon_Social || null,
    nombres: `${userData.nombres} ${userData.apellidos}`.trim(),
    roles: userData.rol
  };
  
  // Valida que haya al menos un dato
  if (!data.razonSocial && !data.nombres) {
    throw new Error('No se encontraron datos para el usuario/empresa');
  }
  
  return data;
};