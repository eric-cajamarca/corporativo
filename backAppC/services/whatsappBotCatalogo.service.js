const Fuse = require('fuse.js');
const { withPool } = require('../utils/dbPool.util');
const whatsappBotCatalogoRepository = require('../repositories/whatsappBotCatalogo.repository');
const { normalizarTexto } = require('../utils/whatsappBotTexto.util');

const fuseCache = new Map();
const FUSE_TTL_MS = 5 * 60 * 1000;

function construirTextoBusqueda(row) {
  return normalizarTexto([
    row.codigo,
    row.descripcion,
    row.marca,
    row.categoria
  ].filter(Boolean).join(' '));
}

async function syncCatalogo(idEmpresa) {
  return withPool(async (pool) => {
    const rows = await whatsappBotCatalogoRepository.obtenerFilasSync(pool, idEmpresa);
    const filas = rows.map((r) => ({
      idProducto: r.idProducto,
      codigo: String(r.codigo || '').slice(0, 50),
      descripcion: String(r.descripcion || '').slice(0, 300),
      textoBusqueda: construirTextoBusqueda(r),
      precioLista: Number(r.precioLista) || 0,
      stockTotal: Number(r.stockTotal) || 0
    }));
    await whatsappBotCatalogoRepository.reemplazarCatalogo(pool, idEmpresa, filas);
    fuseCache.delete(String(idEmpresa));
    const stats = await whatsappBotCatalogoRepository.contarPorEmpresa(pool, idEmpresa);
    return { ok: true, productos: stats.total, ultimaSync: stats.ultimaSync };
  });
}

async function getFuseIndex(idEmpresa) {
  const key = String(idEmpresa);
  const cached = fuseCache.get(key);
  if (cached && Date.now() - cached.at < FUSE_TTL_MS) return cached.fuse;

  const rows = await withPool((pool) => whatsappBotCatalogoRepository.listarTodos(pool, idEmpresa));
  const fuse = new Fuse(rows, {
    keys: ['textoBusqueda', 'descripcion', 'codigo'],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2
  });
  fuseCache.set(key, { fuse, at: Date.now() });
  return fuse;
}

async function buscarFuzzy(idEmpresa, terminos, limite = 5) {
  const q = terminos.join(' ').trim();
  if (!q) return [];
  const fuse = await getFuseIndex(idEmpresa);
  return fuse.search(q, { limit: limite }).map((r) => r.item);
}

async function buscar(idEmpresa, terminos, limite = 5) {
  const result = await withPool((pool) =>
    whatsappBotCatalogoRepository.buscarPorTerminos(pool, idEmpresa, terminos, 20)
  );

  let items = result.items || [];
  if (items.length === 0 && terminos.length > 0) {
    items = await buscarFuzzy(idEmpresa, terminos, limite);
  }

  return {
    total: items.length,
    items: items.slice(0, limite)
  };
}

async function statusCatalogo(idEmpresa) {
  return withPool((pool) => whatsappBotCatalogoRepository.contarPorEmpresa(pool, idEmpresa));
}

module.exports = { syncCatalogo, buscar, statusCatalogo };
