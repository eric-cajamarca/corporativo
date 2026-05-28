const Fuse = require('fuse.js');
const { withPool } = require('../utils/dbPool.util');
const whatsappBotCatalogoRepository = require('../repositories/whatsappBotCatalogo.repository');
const { normalizarTexto, tokenizar } = require('../utils/whatsappBotTexto.util');

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

async function buscarFuzzyConScore(idEmpresa, terminos, limite = 8, threshold = 0.45) {
  const q = Array.isArray(terminos) ? terminos.join(' ').trim() : String(terminos || '').trim();
  if (!q) return [];
  const rows = await withPool((pool) => whatsappBotCatalogoRepository.listarTodos(pool, idEmpresa));
  const fuseInst = new Fuse(rows, {
    keys: ['textoBusqueda', 'descripcion', 'codigo'],
    threshold,
    ignoreLocation: true,
    minMatchCharLength: 2
  });
  return fuseInst.search(q, { limit: limite }).map((r) => ({
    item: r.item,
    fuseScore: r.score
  }));
}

async function buscarFuzzy(idEmpresa, terminos, limite = 5, threshold = 0.4) {
  const hits = await buscarFuzzyConScore(idEmpresa, terminos, limite, threshold);
  return hits.map((h) => h.item);
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

function puntuarCoincidencia(producto, tokens) {
  const txt = normalizarTexto(
    [producto.descripcion, producto.codigo, producto.textoBusqueda].filter(Boolean).join(' ')
  );
  let score = 0;
  for (const t of tokens) {
    if (txt.includes(t)) score += t.length;
  }
  return score;
}

/**
 * Busca el mejor producto para una línea de lista (Excel/PDF): frase completa, luego palabras sueltas.
 * Con desdeLista: true siempre devuelve propuesta (mejor candidato) para confirmación.
 */
async function buscarMejorCoincidencia(idEmpresa, descripcion, limite = 8, opts = {}) {
  const desdeLista = opts.desdeLista === true;
  const desc = String(descripcion || '').trim();
  if (!desc) return { producto: null, propuesta: null, ambiguo: false, candidatos: [] };

  const tokens = tokenizar(desc);
  const fraseNorm = normalizarTexto(desc);

  let hits = await buscarFuzzyConScore(idEmpresa, desc, limite, 0.52);
  let items = hits.map((h) => h.item);

  if (!items.length && tokens.length) {
    const r = await buscar(idEmpresa, tokens, limite);
    items = r.items || [];
    if (items.length) {
      hits = items.map((item) => ({ item, fuseScore: 0.35 }));
    }
  }

  if (!items.length && tokens.length) {
    hits = await buscarFuzzyConScore(idEmpresa, tokens, limite, 0.58);
    items = hits.map((h) => h.item);
  }

  if (!items.length) {
    for (const tok of tokens.sort((a, b) => b.length - a.length)) {
      const r = await buscar(idEmpresa, [tok], 5);
      if (r.items?.length) {
        items = r.items;
        hits = items.map((item) => ({ item, fuseScore: 0.4 }));
        break;
      }
    }
  }

  if (!items.length) {
    return { producto: null, propuesta: null, ambiguo: false, candidatos: [] };
  }

  const scored = items
    .map((p, idx) => ({
      p,
      fuseScore: hits[idx]?.fuseScore ?? 0.5,
      score: puntuarCoincidencia(p, tokens.length ? tokens : fraseNorm.split(/\s+/))
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.fuseScore - b.fuseScore;
    });

  const top = scored[0];
  const segundo = scored[1];
  const candidatos = scored.slice(0, 3).map((s) => s.p);

  if (desdeLista) {
    const propuesta = top.p;
    const ambiguo =
      scored.length > 1 &&
      top.score > 0 &&
      segundo.score > 0 &&
      top.score < segundo.score + 2 &&
      top.score < segundo.score * 1.2;
    return { producto: null, propuesta, ambiguo, candidatos };
  }

  if (items.length === 1) {
    return { producto: items[0], propuesta: items[0], ambiguo: false, candidatos };
  }

  if (top.score > 0 && (!segundo || top.score >= segundo.score + 2 || top.score >= segundo.score * 1.25)) {
    return { producto: top.p, propuesta: top.p, ambiguo: false, candidatos };
  }

  return {
    producto: null,
    propuesta: top.p,
    ambiguo: true,
    candidatos
  };
}

module.exports = { syncCatalogo, buscar, buscarMejorCoincidencia, statusCatalogo };
