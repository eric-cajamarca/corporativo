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

module.exports = {
  normalizarTexto,
  esNumeroMenu,
  tokenizar,
  extraerComprobante,
  formatearPrecio
};
