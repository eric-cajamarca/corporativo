const marcaRepository = require('../repositories/marca.repository');
const { assertEmpresaAutorizada } = require('../utils/empresaGestora.util');

function asegurarUsuario(user) {
  if (!user || !user.empresa) {
    throw new Error('NO_ACCESS');
  }
}

async function obtenerMarcas(pool, user) {
  asegurarUsuario(user);
  return marcaRepository.listarPorEmpresa(pool, user.empresa);
}

async function obtenerMarcasPorEmpresa(pool, user, idEmpresaDestino) {
  asegurarUsuario(user);
  const idDest = String(idEmpresaDestino || '').trim();
  if (!idDest) {
    throw new Error('idEmpresa inválido');
  }
  await assertEmpresaAutorizada(pool, user.empresa, idDest);
  return marcaRepository.listarPorEmpresa(pool, idDest);
}

async function obtenerMarcaPorId(pool, user, idMarca) {
  asegurarUsuario(user);
  const id = parseInt(idMarca, 10);
  if (Number.isNaN(id)) {
    throw new Error('idMarca inválido');
  }
  return marcaRepository.obtenerPorId(pool, user.empresa, id);
}

async function crearMarca(pool, user, body) {
  asegurarUsuario(user);
  const { nombre, descripcion, contacto, paginaWeb, idEmpresaDestino } = body || {};
  if (!nombre || String(nombre).trim() === '') {
    throw new Error('nombre es requerido');
  }
  let idEmpresa = user.empresa;
  const dest = idEmpresaDestino != null ? String(idEmpresaDestino).trim() : '';
  if (dest) {
    await assertEmpresaAutorizada(pool, user.empresa, dest);
    idEmpresa = dest;
  }
  return marcaRepository.insertar(pool, idEmpresa, {
    nombre: String(nombre).trim(),
    descripcion: descripcion != null ? String(descripcion) : '',
    contacto: contacto != null ? String(contacto) : '',
    paginaWeb: paginaWeb != null ? String(paginaWeb) : ''
  });
}

async function editarMarca(pool, user, idMarca, body) {
  asegurarUsuario(user);
  const id = parseInt(idMarca, 10);
  if (Number.isNaN(id)) {
    throw new Error('idMarca inválido');
  }
  const { nombre, descripcion, contacto, paginaWeb } = body || {};
  if (!nombre || String(nombre).trim() === '') {
    throw new Error('nombre es requerido');
  }
  return marcaRepository.actualizar(pool, user.empresa, id, {
    nombre: String(nombre).trim(),
    descripcion: descripcion != null ? String(descripcion) : '',
    contacto: contacto != null ? String(contacto) : '',
    paginaWeb: paginaWeb != null ? String(paginaWeb) : ''
  });
}

async function editarEstadoMarca(pool, user, idMarca, body) {
  asegurarUsuario(user);
  const id = parseInt(idMarca, 10);
  if (Number.isNaN(id)) {
    throw new Error('idMarca inválido');
  }
  const estado = !!body?.estado;
  const nuevoEstado = estado ? 0 : 1;
  return marcaRepository.actualizarEstado(pool, user.empresa, id, nuevoEstado);
}

module.exports = {
  obtenerMarcas,
  obtenerMarcasPorEmpresa,
  obtenerMarcaPorId,
  crearMarca,
  editarMarca,
  editarEstadoMarca
};
