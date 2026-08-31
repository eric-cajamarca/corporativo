function recortar(v, max = 400) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Trazas de WhatsApp (texto del cliente, ficha, respuestas).
 * Apagadas por defecto: no deben ir a stdout/PM2 en internet.
 * Solo si WHATSAPP_BOT_TRACE=1 en el servidor local.
 */
function trace(paso, datos) {
  if (process.env.WHATSAPP_BOT_TRACE !== '1') return;
  console.error(`whatsappBot TRACE [${paso}]:`, recortar(datos, 700));
}

module.exports = { trace, recortar };
