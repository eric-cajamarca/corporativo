/**
 * Normaliza parámetros de paginación desde query/body.
 * @param {{ pagina?: unknown, porPagina?: unknown }} opts
 * @returns {{ pagina: number, porPagina: number, offset: number, activa: boolean }}
 */
exports.parsePaginacion = (opts = {}) => {
  const tienePagina = opts.pagina != null && String(opts.pagina).trim() !== '';
  const tienePorPagina = opts.porPagina != null && String(opts.porPagina).trim() !== '';
  const activa = tienePagina || tienePorPagina;
  const pagina = Math.max(1, parseInt(String(opts.pagina), 10) || 1);
  const porPagina = Math.min(100, Math.max(1, parseInt(String(opts.porPagina), 10) || 20));
  return { pagina, porPagina, offset: (pagina - 1) * porPagina, activa };
};

/** Escapa caracteres especiales de LIKE. */
exports.likePattern = (texto) => {
  const raw = texto != null ? String(texto).trim() : '';
  if (!raw) return null;
  return `%${raw.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
};
