const { withPool } = require('../utils/dbPool.util');
const caducidadAvisosService = require('../services/caducidadAvisos.service');

const INTERVAL_MS = Math.max(
  15 * 60 * 1000,
  Number(process.env.CADUCIDAD_WHATSAPP_INTERVAL_MS || 30 * 60 * 1000)
);

let timer = null;

async function ejecutarUnaVez() {
  try {
    const r = await withPool((pool) => caducidadAvisosService.ejecutarCiclo(pool));
    if (r && (r.enviados > 0 || r.errores > 0)) {
      console.error(
        'Caducidad WhatsApp: enviados:',
        r.enviados,
        'errores:',
        r.errores,
        'omitidos:',
        r.omitidos,
        'candidatas:',
        r.candidatas
      );
    }
  } catch (e) {
    console.error('Job caducidad WhatsApp:', e.message);
  }
}

function iniciar() {
  if (timer) return;
  void ejecutarUnaVez();
  timer = setInterval(() => {
    void ejecutarUnaVez();
  }, INTERVAL_MS);
}

module.exports = { iniciar, ejecutarUnaVez };
