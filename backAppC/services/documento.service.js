const documentoRepository = require('../repositories/documento.repository');

function asegurarUsuario(user) {
  if (!user) {
    throw new Error('NO_ACCESS');
  }
}

function asegurarRol(user) {
  asegurarUsuario(user);
  if (!user.rol) {
    throw new Error('NO_PERMISOS');
  }
}

function asegurarAdministrador(user) {
  asegurarUsuario(user);
  if (user.rol !== 'Administrador') {
    throw new Error('NO_PERMISOS');
  }
}

async function crearDocumento(pool, user, body) {
  asegurarRol(user);
  const idDocumento = body?.idDocumento;
  const nombre = body?.nombre;
  const descripcion = body?.descripcion;
  if (!idDocumento || !nombre || descripcion === undefined || descripcion === null) {
    throw new Error('Datos incompletos para crear documento');
  }
  return documentoRepository.insertar(pool, {
    idDocumento: String(idDocumento).trim(),
    nombre: String(nombre).trim(),
    descripcion: String(descripcion).trim()
  });
}

async function listarDocumentos(pool, user) {
  asegurarRol(user);
  return documentoRepository.listarDocumentos(pool);
}

async function actualizarDocumento(pool, user, idDocumento, body) {
  asegurarAdministrador(user);
  const nombre = body?.nombre;
  const descripcion = body?.descripcion;
  if (!idDocumento || nombre === undefined || descripcion === undefined) {
    throw new Error('Datos incompletos para actualizar documento');
  }
  return documentoRepository.actualizar(pool, {
    idDocumento: String(idDocumento).trim(),
    nombre: String(nombre).trim(),
    descripcion: String(descripcion).trim()
  });
}

async function eliminarDocumento(pool, user, idDocumento) {
  asegurarAdministrador(user);
  if (!idDocumento) {
    throw new Error('idDocumento requerido');
  }
  return documentoRepository.eliminar(pool, String(idDocumento).trim());
}

async function listarFormasPago(pool, user) {
  asegurarUsuario(user);
  return documentoRepository.listarFormasPago(pool);
}

module.exports = {
  crearDocumento,
  listarDocumentos,
  actualizarDocumento,
  eliminarDocumento,
  listarFormasPago
};
