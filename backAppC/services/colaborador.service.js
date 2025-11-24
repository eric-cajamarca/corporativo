const colaboradorRepository = require('../repositories/colaborador.repository');

exports.cambiarEstado = async (pool, idColaborador, data, usuarioAutenticado ,idEmpresa)=> {
  if (usuarioAutenticado.rol !== 'Administrador') {
    throw new Error('PERMISO_DENEGADO');
  }
  
  const nuevoEstado = !data.estado;
  await colaboradorRepository.updateEstado(pool,idColaborador, nuevoEstado, idEmpresa);
  
  return { message: 'Estado actualizado', nuevoEstado };
};