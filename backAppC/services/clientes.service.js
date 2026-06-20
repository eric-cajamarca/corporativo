const gestoresRepository = require('../repositories/gestores.repository');
const clientesRepository = require('../repositories/clientes.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');
const cache = require('../cache/redis.client');
const { parseTtlSeconds } = require('../utils/cacheSkip.util');

const MIN_TERMINO_BUSCAR_CLIENTES = 3;

function clientesIndiceCacheKey(idEmpresa) {
  return `clientes:indice:v1:${String(idEmpresa || '').trim().toLowerCase()}`;
}

async function invalidarIndiceClientes(idEmpresa) {
  if (!idEmpresa) return;
  await cache.del(clientesIndiceCacheKey(idEmpresa));
}

async function obtenerIndiceClientes(pool, idEmpresa) {
  const ttlSeconds = parseTtlSeconds('REDIS_CLIENTES_INDICE_TTL_SECONDS', 300, 60);
  return cache.getCached(
    clientesIndiceCacheKey(idEmpresa),
    () => clientesRepository.listarPorEmpresa(pool, idEmpresa),
    ttlSeconds
  );
}

function normalizarTextoClienteBusqueda(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function clienteTextoBusqueda(c) {
  const rSocial = c.rSocial ?? c.RSocial ?? c.r_Social ?? '';
  const ruc = c.ruc ?? c.Ruc ?? c.RUC ?? '';
  const correo = c.correo ?? c.Correo ?? '';
  return normalizarTextoClienteBusqueda(`${rSocial} ${ruc} ${correo}`);
}

function filtrarClientesEnMemoria(lista, termino, limite) {
  const term = String(termino || '').trim();
  if (term.length < MIN_TERMINO_BUSCAR_CLIENTES) {
    return { rows: [], total: 0 };
  }
  const tokens = normalizarTextoClienteBusqueda(term).split(/\s+/).filter(Boolean).slice(0, 6);
  const filtrados = (lista || []).filter((c) => {
    const hay = clienteTextoBusqueda(c);
    return tokens.every((t) => hay.includes(t));
  });
  const lim = Math.min(100, Math.max(1, parseInt(limite, 10) || 50));
  return {
    rows: filtrados.slice(0, lim),
    total: filtrados.length
  };
}

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
  await invalidarIndiceClientes(idEmpresa);
  return clientesRepository.obtenerPorRuc(pool, idEmpresa, rucNorm);
}

async function listarClientes(pool, user) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  await assertAlgunoPermiso(pool, user, 'VER_CLIENTES', 'CREAR_CLIENTES', 'EDITAR_CLIENTES');
  return obtenerIndiceClientes(pool, idEmpresa);
}

async function buscarClientesRapido(pool, user, query = {}) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  await assertAlgunoPermiso(pool, user, 'VER_CLIENTES', 'CREAR_CLIENTES', 'EDITAR_CLIENTES');
  const termino = String(query.q || query.buscar || '').trim();
  if (termino.length < MIN_TERMINO_BUSCAR_CLIENTES) {
    const err = new Error('TERMINO_CORTO');
    err.code = 'TERMINO_CORTO';
    throw err;
  }
  const lista = await obtenerIndiceClientes(pool, idEmpresa);
  return filtrarClientesEnMemoria(lista, termino, query.limit);
}

async function listarClientesPaginado(pool, user, query = {}) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  await assertAlgunoPermiso(pool, user, 'VER_CLIENTES', 'CREAR_CLIENTES', 'EDITAR_CLIENTES');
  const { parsePaginacion } = require('../utils/paginacion.util');
  const pag = parsePaginacion(query);
  return clientesRepository.listarPorEmpresaPaginado(pool, idEmpresa, {
    pagina: pag.pagina,
    porPagina: pag.porPagina,
    buscar: query.buscar
  });
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
  await invalidarIndiceClientes(idEmpresa);
  return clientesRepository.obtenerPorIdCliente(pool, idCliente);
}

async function eliminarCliente(pool, user, idCliente) {
  if (!user) throw new Error('NO_AUTH');
  const idEmpresa = user.empresa || user.idEmpresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  await assertAlgunoPermiso(pool, user, 'EDITAR_CLIENTES');
  const ids = await idsEmpresaConGestionadas(pool, idEmpresa);
  const deleteResult = await clientesRepository.eliminarEnEmpresas(pool, ids, idCliente);
  await invalidarIndiceClientes(idEmpresa);
  return deleteResult.rowsAffected[0];
}

async function cambiarCondicion(pool, user, idCliente, condicionActual) {
  if (!user) throw new Error('NO_AUTH');
  await assertAlgunoPermiso(pool, user, 'EDITAR_CLIENTES');
  const idEmpresa = user.empresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  const nuevacondicion = condicionActual === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
  const rows = await clientesRepository.actualizarCondicion(pool, idCliente, nuevacondicion, idEmpresa);
  await invalidarIndiceClientes(idEmpresa);
  return rows;
}

async function cambiarEstado(pool, user, idCliente, estadoBody) {
  if (!user) throw new Error('NO_AUTH');
  await assertAlgunoPermiso(pool, user, 'EDITAR_CLIENTES');
  const idEmpresa = user.empresa;
  if (!idEmpresa) throw new Error('NO_EMPRESA');
  const nuevoEstado = estadoBody ? 0 : 1;
  const rows = await clientesRepository.actualizarEstado(pool, idCliente, nuevoEstado, idEmpresa);
  await invalidarIndiceClientes(idEmpresa);
  return rows;
}

module.exports = {
  crearCliente,
  listarClientes,
  buscarClientesRapido,
  listarClientesPaginado,
  listarPorRuc,
  listarPorId,
  actualizarCliente,
  eliminarCliente,
  cambiarCondicion,
  cambiarEstado
};
