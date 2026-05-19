const sql = require('mssql');

/**
 * Divide el texto de búsqueda en palabras (espacios).
 * @param {string|null|undefined} buscar
 * @returns {string[]}
 */
function tokenizarBusquedaProducto(buscar) {
  if (buscar == null || !String(buscar).trim()) {
    return [];
  }
  return String(buscar)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * AND por palabra: cada token debe coincidir en código, descripción, categoría o marca.
 * @param {import('mssql').Request} request
 * @param {string|null|undefined} buscar
 * @param {string} [paramPrefix]
 * @returns {{ clause: string, hasSearch: boolean }}
 */
function clausulaBusquedaProductoMultiPalabra(request, buscar, paramPrefix = 'busTok') {
  const tokens = tokenizarBusquedaProducto(buscar);
  if (!tokens.length) {
    return { clause: '', hasSearch: false };
  }

  const partes = tokens.map((tok, i) => {
    const param = `${paramPrefix}${i}`;
    request.input(param, sql.NVarChar(200), `%${tok}%`);
    return `(
      p.codigo LIKE @${param}
      OR p.descripcion LIKE @${param}
      OR c.nombre LIKE @${param}
      OR ISNULL(m.nombre, '') LIKE @${param}
    )`;
  });

  return {
    clause: `AND (${partes.join(' AND ')})`,
    hasSearch: true
  };
}

module.exports = {
  tokenizarBusquedaProducto,
  clausulaBusquedaProductoMultiPalabra
};
