/**
 * Extrae la línea de dirección del cliente desde XML UBL 2.1 (Invoice / CreditNote / DebitNote)
 * generado por generadorXmlUblSunat (bloque AccountingCustomerParty → AddressLine → cbc:Line).
 * Devuelve cadena vacía si no se puede extraer o si la dirección es un placeholder ('-').
 */
function extraerDireccionClienteDesdeXmlUbl(xml) {
  if (xml == null) return '';
  const s = String(xml);
  if (!s.trim()) return '';
  const marker = '<cac:AccountingCustomerParty>';
  const start = s.indexOf(marker);
  if (start < 0) return '';
  const end = s.indexOf('</cac:AccountingCustomerParty>', start);
  const block = end > start ? s.slice(start, end) : s.slice(start, start + 12000);
  const m = block.match(/<cac:AddressLine>\s*<cbc:Line>([\s\S]*?)<\/cbc:Line>/i);
  if (!m || m[1] == null) return '';
  let line = String(m[1]).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
  line = line
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const limpio = line.trim();
  if (!limpio || limpio === '-' || /^sin\s*direcci/i.test(limpio)) return '';
  return limpio;
}

module.exports = { extraerDireccionClienteDesdeXmlUbl };
