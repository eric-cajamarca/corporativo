const catalogoProductoSunatRepository = require('../repositories/catalogoProductoSunat.repository');
const {
  validarCodigoProductoSunatOpcional,
  esFormatoCodigoProductoSunatValido
} = require('../utils/codigoProductoSunat.util');

/**
 * Valida ítems de un CPE antes de armar XML/DET (ERR-3496 y obligatoriedad).
 * @param {object} pool
 * @param {Array} items
 */
async function validarItemsCodigoProductoSunatEmision(pool, items) {
  const lista = Array.isArray(items) ? items : [];
  for (let i = 0; i < lista.length; i++) {
    const it = lista[i];
    const linea = i + 1;
    const requiere =
      it.requiereCodigoSunat === true ||
      it.requiereCodigoSunat === 1 ||
      it.requiereCodigoSunat === '1';
    const raw = it.codigoProductoSunat != null ? String(it.codigoProductoSunat).trim() : '';

    if (requiere && !raw) {
      throw new Error(
        `Línea ${linea}: el producto requiere Código producto SUNAT (anexo 25.1/25.2/25.3). Asígnalo en el catálogo antes de emitir.`
      );
    }
    if (!raw) continue;

    const v = validarCodigoProductoSunatOpcional(raw);
    if (!v.ok) {
      throw new Error(`Línea ${linea}: ${v.message}`);
    }
    const existe = await catalogoProductoSunatRepository.existeCodigo(pool, v.codigo);
    if (!existe) {
      throw new Error(
        `Línea ${linea}: el Código producto de SUNAT (${v.codigo}) no se encuentra en el listado (Catálogo 25.1/25.2/25.3).`
      );
    }
  }
}

function codigoProductoSunatParaXml(item) {
  const raw = item && item.codigoProductoSunat != null ? String(item.codigoProductoSunat).trim() : '';
  if (!raw) return null;
  return esFormatoCodigoProductoSunatValido(raw) ? raw : null;
}

function fragmentoCommodityClassificationXml(codigoSunat) {
  if (!codigoSunat) return '';
  return `
        <cac:CommodityClassification>
          <cbc:ItemClassificationCode listID="UNSPSC" listAgencyName="GS1 US" listName="Item Classification">${codigoSunat}</cbc:ItemClassificationCode>
        </cac:CommodityClassification>`;
}

module.exports = {
  validarItemsCodigoProductoSunatEmision,
  codigoProductoSunatParaXml,
  fragmentoCommodityClassificationXml
};
