function recortar(v, max = 400) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function trace(paso, datos) {
  console.error(`whatsappBot TRACE [${paso}]:`, recortar(datos, 700));
}

module.exports = { trace, recortar };
