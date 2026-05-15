const gestoresRepository = require('../repositories/gestores.repository');
const clientesRepository = require('../repositories/clientes.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');

async function idsEmpresaConGestionadas(pool, idEmpresaRaiz) {
  const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaRaiz);
  return [idEmpresaRaiz, ...(gestionadas || []).map((g) => g.idEmpresa).filter(Boolean)];
}

/** Normaliza RUC/DNI: solo dígitos (igual que el repo). */
function normalizarRucDni(valor) {
  if (valor == null) return '';
  return String(valor).replace(/\D/g, '');
}

async function crearCliente(pool, user, body) {
  if (!user) throw new Error('NO_AUTH');
  await assertAlgunoPermiso(pool, user, 'CREAR_CLIENTES');
  const idEmpresa = user.empresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  const { idDocumento, ruc, rSocial, correo, celular, condicion, sujetoCredito, lineaCredito } = body;
  const rucNorm = normalizarRucDni(ruc);
  if (!rucNorm) {
    const err = new Error('RUC_REQUERIDO');
    err.code = 'RUC_REQUERIDO';
    throw err;
  }
  const existente = await clientesRepository.obtenerPorRuc(pool, idEmpresa, rucNorm);
  if (existente) {
    return { ...existente, existente: true };
  }
  const esSujetoCredito =
    sujetoCredito === true || sujetoCredito === 1 || String(sujetoCredito).toLowerCase() === 'true';
  const linea = lineaCredito != null && !isNaN(Number(lineaCredito)) ? Math.max(0, Number(lineaCredito)) : 0;
  await clientesRepository.insertar(pool, {
    idEmpresa,
    idDocumento,
    ruc: rucNorm,
    rSocial,
    correo: correo || null,
    celular: celular || null,
    condicion: condicion || null,
    sujetoCredito: esSujetoCredito,
    lineaCredito: linea
  });
  return clientesRepository.obtenerPorRuc(pool, idEmpresa, rucNorm);
}

async function listarClientes(pool, user) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  await assertAlgunoPermiso(pool, user, 'VER_CLIENTES', 'CREAR_CLIENTES', 'EDITAR_CLIENTES');
  return clientesRepository.listarPorEmpresa(pool, idEmpresa);
}

async function listarPorRuc(pool, user, ruc) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  await assertAlgunoPermiso(pool, user, 'VER_CLIENTES', 'CREAR_CLIENTES', 'EDITAR_CLIENTES');
  const ids = await idsEmpresaConGestionadas(pool, idEmpresa);
  return clientesRepository.listarPorRucEmpresas(pool, ids, ruc);
}

async function listarPorId(pool, user, idCliente) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  await assertAlgunoPermiso(pool, user, 'VER_CLIENTES', 'CREAR_CLIENTES', 'EDITAR_CLIENTES');
  const ids = await idsEmpresaConGestionadas(pool, idEmpresa);
  return clientesRepository.listarPorIdClienteEmpresas(pool, ids, idCliente);
}

async function actualizarCliente(pool, user, idCliente, body) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  await assertAlgunoPermiso(pool, user, 'EDITAR_CLIENTES');
  const { idDocumento, ruc, rSocial, correo, celular, condicion, sujetoCredito, lineaCredito } = body;
  const esSujetoCredito =
    sujetoCredito === true || sujetoCredito === 1 || String(sujetoCredito).toLowerCase() === 'true';
  const linea = lineaCredito != null && !isNaN(Number(lineaCredito)) ? Math.max(0, Number(lineaCredito)) : 0;
  const ids = await idsEmpresaConGestionadas(pool, idEmpresa);
  const updateResult = await clientesRepository.actualizarEnEmpresas(pool, ids, {
    idCliente,
    idDocumento,
    ruc,
    rSocial,
    correo,
    celular,
    condicion,
    sujetoCredito: esSujetoCredito,
    lineaCredito: linea
  });
  if (!updateResult.rowsAffected || updateResult.rowsAffected[0] === 0) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return clientesRepository.obtenerPorIdCliente(pool, idCliente);
}

async function eliminarCliente(pool, user, idCliente) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  await assertAlgunoPermiso(pool, user, 'EDITAR_CLIENTES');
  const ids = await idsEmpresaConGestionadas(pool, idEmpresa);
  const deleteResult = await clientesRepository.eliminarEnEmpresas(pool, ids, idCliente);
  return deleteResult.rowsAffected[0];
}

async function cambiarCondicion(pool, user, idCliente, condicionActual) {
  if (!user) throw new Error('NO_AUTH');
  await assertAlgunoPermiso(pool, user, 'EDITAR_CLIENTES');
  const idEmpresa = user.empresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  const nuevacondicion = condicionActual === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
  return clientesRepository.actualizarCondicion(pool, idCliente, nuevacondicion, idEmpresa);
}

async function cambiarEstado(pool, user, idCliente, estadoBody) {
  if (!user) throw new Error('NO_AUTH');
  await assertAlgunoPermiso(pool, user, 'EDITAR_CLIENTES');
  const idEmpresa = user.empresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  const nuevoEstado = estadoBody ? 0 : 1;
  return clientesRepository.actualizarEstado(pool, idCliente, nuevoEstado, idEmpresa);
}

module.exports = {
  crearCliente,
  listarClientes,
  listarPorRuc,
  listarPorId,
  actualizarCliente,
  eliminarCliente,
  cambiarCondicion,
  cambiarEstado
};
