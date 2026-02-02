const colaboradorRepository = require('../repositories/colaborador.repository');

exports.cambiarEstado = async (pool, idColaborador, data, usuarioAutenticado ,idEmpresa)=> {
  if (usuarioAutenticado.rol !== 'Administrador') {
    throw new Error('PERMISO_DENEGADO');
  }
  console.log('data en service: ', data );
  const nuevoEstado = !data.estado;
  console.log('nuevoEstadoen service: ', nuevoEstado);
  await colaboradorRepository.updateEstado(pool,idColaborador, nuevoEstado, idEmpresa);
  //console.log('estado actualizado: ', estadoActualizado);
  return { message: 'Estado actualizado', nuevoEstado };
};