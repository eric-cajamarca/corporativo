const catalogoProductoSunatRepository = require('../repositories/catalogoProductoSunat.repository');
const {
  tokensBusqueda,
  normalizarTextoBusqueda,
  etiquetaAnexo
} = require('../utils/codigoProductoSunat.util');

let cacheCatalogo = null;
let cacheAt = 0;
const CACHE_MS = 5 * 60 * 1000;

async function obtenerCatalogoCached(pool) {
  const now = Date.now();
  if (cacheCatalogo && now - cacheAt < CACHE_MS) return cacheCatalogo;
  const rows = await catalogoProductoSunatRepository.listarTodosActivos(pool);
  cacheCatalogo = rows.map((r) => ({
    codigo: String(r.codigo).trim(),
    anexo: String(r.anexo).trim(),
    descripcion: String(r.descripcion || '').trim(),
    partidaArancelaria: String(r.partidaArancelaria || '').trim(),
    tokens: tokensBusqueda(r.descripcion),
    textoNorm: normalizarTextoBusqueda(r.descripcion)
  }));
  cacheAt = now;
  return cacheCatalogo;
}

function invalidarCacheCatalogo() {
  cacheCatalogo = null;
  cacheAt = 0;
}

/**
 * Sugerencias por descripción/categoría (match débil).
 * @returns {Promise<Array<{codigo,anexo,descripcion,partidaArancelaria,etiquetaAnexo,score}>>}
 */
async function sugerirCodigoProductoSunat(pool, { descripcion, categoria, limite } = {}) {
  const lim = Math.min(Math.max(parseInt(limite, 10) || 8, 1), 20);
  const texto = `${descripcion || ''} ${categoria || ''}`.trim();
  const tokensProd = tokensBusqueda(texto);
  if (!tokensProd.length) return [];

  const catalogo = await obtenerCatalogoCached(pool);
  const textoNorm = normalizarTextoBusqueda(texto);
  const scored = [];

  const tokenEnTexto = (texto, token) => {
    const re = new RegExp(`(?:^|\\s)${token}(?:\\s|$)`);
    return re.test(texto);
  };

  for (const cat of catalogo) {
    if (!cat.tokens.length) continue;
    let hits = 0;
    for (const t of tokensProd) {
      if (cat.tokens.includes(t) || tokenEnTexto(cat.textoNorm, t)) hits += 1;
    }
    if (hits === 0) continue;
    let score = hits / Math.max(tokensProd.length, 1);
    // Bonus si hay igualdad/contención de frase completa (palabras)
    if (textoNorm === cat.textoNorm || tokenEnTexto(textoNorm, cat.textoNorm) || tokenEnTexto(cat.textoNorm, textoNorm)) {
      score += 0.35;
    } else if (cat.tokens.every((t) => tokensProd.includes(t)) && cat.tokens.length >= 1) {
      score += 0.2;
    }
    for (const t of tokensProd) {
      if (t.length >= 5 && cat.tokens.includes(t)) score += 0.08;
    }
    if (score < 0.34) continue;
    scored.push({
      codigo: cat.codigo,
      anexo: cat.anexo,
      descripcion: cat.descripcion,
      partidaArancelaria: cat.partidaArancelaria,
      etiquetaAnexo: etiquetaAnexo(cat.anexo),
      score: Math.round(score * 1000) / 1000
    });
  }

  scored.sort((a, b) => b.score - a.score || a.codigo.localeCompare(b.codigo));
  // Deduplicar por codigo+anexo
  const seen = new Set();
  const out = [];
  for (const s of scored) {
    const k = `${s.anexo}|${s.codigo}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= lim) break;
  }
  return out;
}

module.exports = {
  sugerirCodigoProductoSunat,
  invalidarCacheCatalogo,
  obtenerCatalogoCached
};
