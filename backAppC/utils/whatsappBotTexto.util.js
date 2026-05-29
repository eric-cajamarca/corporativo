const { STOPWORDS_ES } = require('./whatsappBotStopwords.es');

function normalizarTexto(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s\-.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function esNumeroMenu(texto) {
  return /^\d+$/.test(String(texto || '').trim());
}

function tokenizar(texto, stopwordsExtra = new Set()) {
  const norm = normalizarTexto(texto);
  if (!norm) return [];
  const stop = new Set([...STOPWORDS_ES, ...stopwordsExtra]);
  return norm
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t))
    .slice(0, 8);
}

function extraerComprobante(texto) {
  const m = String(texto || '').match(/\b([a-zA-Z0-9]{1,4})-(\d{1,8})\b/);
  if (!m) return null;
  return `${m[1].toUpperCase()}-${m[2]}`;
}

function formatearPrecio(valor, simbolo = 'S/') {
  const n = Number(valor);
  if (!Number.isFinite(n)) return `${simbolo} 0.00`;
  return `${simbolo} ${n.toFixed(2)}`;
}

/**
 * Variantes singular/plural simples (zapata ↔ zapatas) para mejorar coincidencias en catálogo.
 */
function expandirVariantesLexica(token) {
  const t = String(token || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w-]/g, '');
  if (!t || t.length < 2) return [];

  const set = new Set([t]);

  if (t.length > 3 && t.endsWith('es') && !t.endsWith('ses') && !t.endsWith('ces')) {
    set.add(t.slice(0, -2));
    set.add(t.slice(0, -1));
  }
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) {
    set.add(t.slice(0, -1));
  }
  if (!t.endsWith('s')) {
    set.add(`${t}s`);
    if (/[^aeiou]s$/.test(t) || /[aeiou]$/.test(t)) {
      set.add(`${t}s`);
    }
  }

  return [...set].filter((v) => v.length >= 2);
}

function textoIncluyeAlgunaVariante(textoNorm, token) {
  const txt = String(textoNorm || '');
  if (!txt || !token) return false;
  return expandirVariantesLexica(token).some((v) => txt.includes(v));
}

module.exports = {
  normalizarTexto,
  esNumeroMenu,
  tokenizar,
  extraerComprobante,
  formatearPrecio,
  expandirVariantesLexica,
  textoIncluyeAlgunaVariante
};
