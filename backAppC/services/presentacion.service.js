const presentacionRepository = require('../repositories/presentacion.repository');

function asegurarUsuario(user) {
  if (!user) {
    throw new Error('NO_ACCESS');
  }
}

async function obtenerPresentaciones(pool, user) {
  asegurarUsuario(user);
  return presentacionRepository.listarCatalogo(pool);
}

async function obtenerPresentacionPorId(pool, user, idPresentacion) {
  asegurarUsuario(user);
  const id = parseInt(idPresentacion, 10);
  if (Number.isNaN(id)) {
    throw new Error('idPresentacion inválido');
  }
  return presentacionRepository.obtenerPorId(pool, id);
}

async function crearPresentacion(pool, user, body) {
  asegurarUsuario(user);
  const idEmpresa = user.empresa;
  if (!idEmpresa) {
    throw new Error('Empresa no identificada en el token');
  }
  const { codigo, Descripcion, Multiplicador } = body || {};
  if (!codigo || Descripcion === undefined || Descripcion === null || Multiplicador === undefined) {
    throw new Error('codigo, Descripcion y Multiplicador son requeridos');
  }
  const mult = parseInt(Multiplicador, 10);
  if (Number.isNaN(mult)) {
    throw new Error('Multiplicador inválido');
  }
  return presentacionRepository.insertar(pool, {
    idEmpresa,
    codigo: String(codigo).trim(),
    descripcion: String(Descripcion).trim(),
    multiplicador: mult
  });
}

async function editarPresentacion(pool, user, idPresentacion, body) {
  asegurarUsuario(user);
  const id = parseInt(idPresentacion, 10);
  if (Number.isNaN(id)) {
    throw new Error('idPresentacion inválido');
  }
  const { codigo, Descripcion, Multiplicador } = body || {};
  if (!codigo || Descripcion === undefined || Descripcion === null || Multiplicador === undefined) {
    throw new Error('codigo, Descripcion y Multiplicador son requeridos');
  }
  const mult = parseInt(Multiplicador, 10);
  if (Number.isNaN(mult)) {
    throw new Error('Multiplicador inválido');
  }
  return presentacionRepository.actualizar(pool, {
    idPresentacion: id,
    codigo: String(codigo).trim(),
    descripcion: String(Descripcion).trim(),
    multiplicador: mult
  });
}

async function eliminarPresentacion(pool, user, idPresentacion) {
  asegurarUsuario(user);
  const id = parseInt(idPresentacion, 10);
  if (Number.isNaN(id)) {
    throw new Error('idPresentacion inválido');
  }
  return presentacionRepository.eliminar(pool, id);
}

module.exports = {
  obtenerPresentaciones,
  obtenerPresentacionPorId,
  crearPresentacion,
  editarPresentacion,
  eliminarPresentacion
};
