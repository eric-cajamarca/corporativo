const { withPool } = require('../utils/dbPool.util');
const { isSaas } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');

const INTERVAL_MS = 24 * 60 * 60 * 1000;

let timer = null;

async function ejecutarUnaVez() {
  if (!isSaas()) return;
  try {
    await withPool(async (pool) => {
      const ahora = new Date();
      const aplicados = await empresaSuscripcionRepository.aplicarPlanesPendientesAlVencer(pool, ahora);
      if (aplicados > 0) {
        console.error('Suscripción vencimiento: planes pendientes aplicados:', aplicados);
      }
      const n = await empresaSuscripcionRepository.marcarVencidas(pool, ahora);
      if (n > 0) {
        console.error('Suscripción vencimiento: empresas marcadas VENCIDA:', n);
      }
    });
  } catch (e) {
    console.error('Job suscripción vencimiento:', e.message);
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
