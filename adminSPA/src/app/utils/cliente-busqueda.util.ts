export function normalizarTextoClienteBusqueda(valor: string): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function clienteTextoBusqueda(cliente: Record<string, unknown>): string {
  const rSocial = cliente['rSocial'] ?? cliente['RSocial'] ?? cliente['r_Social'] ?? '';
  const ruc = cliente['ruc'] ?? cliente['Ruc'] ?? cliente['RUC'] ?? '';
  const correo = cliente['correo'] ?? cliente['Correo'] ?? '';
  return normalizarTextoClienteBusqueda(`${rSocial} ${ruc} ${correo}`);
}

/** Filtra catálogo en memoria (índice Redis). Mínimo 3 caracteres. */
export function filtrarClientesCatalogo(
  catalogo: unknown[],
  termino: string,
  limite = 50
): unknown[] {
  const term = String(termino || '').trim();
  if (term.length < 3) {
    return [];
  }
  const tokens = normalizarTextoClienteBusqueda(term).split(/\s+/).filter(Boolean);
  const filtrados = (catalogo || []).filter((item) => {
    const hay = clienteTextoBusqueda(item as Record<string, unknown>);
    return tokens.every((t) => hay.includes(t));
  });
  return filtrados.slice(0, Math.min(100, Math.max(1, limite)));
}
