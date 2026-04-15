const categoriaRepository = require('../repositories/categoria.repository');

function asegurarUsuario(user) {
  if (!user || !user.empresa) {
    throw new Error('NO_ACCESS');
  }
}

async function obtenerCategorias(pool, user) {
  asegurarUsuario(user);
  return categoriaRepository.listarPorEmpresa(pool, user.empresa);
}

async function obtenerCategoriaPorId(pool, user, idCategoria) {
  asegurarUsuario(user);
  const id = parseInt(idCategoria, 10);
  if (Number.isNaN(id)) {
    throw new Error('idCategoria inválido');
  }
  return categoriaRepository.obtenerPorId(pool, user.empresa, id);
}

async function crearCategoria(pool, user, body) {
  asegurarUsuario(user);
  const { descripcion, nombre } = body || {};
  if (!nombre || descripcion === undefined || descripcion === null) {
    throw new Error('nombre y descripcion son requeridos');
  }
  return categoriaRepository.insertar(pool, user.empresa, {
    nombre: String(nombre).trim(),
    descripcion: String(descripcion).trim(),
    estado: 1
  });
}

async function editarCategoria(pool, user, idCategoria, body) {
  asegurarUsuario(user);
  const id = parseInt(idCategoria, 10);
  if (Number.isNaN(id)) {
    throw new Error('idCategoria inválido');
  }
  const { descripcion, nombre } = body || {};
  if (!nombre || descripcion === undefined || descripcion === null) {
    throw new Error('nombre y descripcion son requeridos');
  }
  return categoriaRepository.actualizar(pool, user.empresa, id, {
    nombre: String(nombre).trim(),
    descripcion: String(descripcion).trim()
  });
}

async function cambiarEstadoCategoria(pool, user, idCategoria, body) {
  asegurarUsuario(user);
  const id = parseInt(idCategoria, 10);
  if (Number.isNaN(id)) {
    throw new Error('idCategoria inválido');
  }
  const estadoActual = !!body?.estado;
  const cambioEstado = estadoActual ? 0 : 1;
  return categoriaRepository.actualizarEstado(pool, user.empresa, id, cambioEstado);
}

async function eliminarCategoria(pool, user, idCategoria) {
  asegurarUsuario(user);
  const id = parseInt(idCategoria, 10);
  if (Number.isNaN(id)) {
    throw new Error('idCategoria inválido');
  }
  return categoriaRepository.eliminar(pool, user.empresa, id);
}

module.exports = {
  obtenerCategorias,
  obtenerCategoriaPorId,
  crearCategoria,
  editarCategoria,
  cambiarEstadoCategoria,
  eliminarCategoria
};
