const { withPool } = require('../utils/dbPool.util');
const { isSaas } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const suscripcionAvisosService = require('../services/suscripcionAvisos.service');

/**
 * Por defecto cada 6 h: el pre-aviso de 1 día necesita al menos una corrida
 * dentro del día previo al vencimiento.
 */
const INTERVAL_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.SUSCRIPCION_VENCIMIENTO_INTERVAL_MS || 6 * 60 * 60 * 1000)
);

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

      // Avisos al cliente después de actualizar estados, para que las recién
      // vencidas reciban el mensaje correcto en esta misma corrida.
      try {
        const avisos = await suscripcionAvisosService.ejecutarCicloVencimientos(pool);
        if (avisos.enviados > 0 || avisos.errores > 0) {
          console.error(
            'Suscripción avisos: enviados:', avisos.enviados,
            'errores:', avisos.errores,
            'candidatas:', avisos.candidatas
          );
        }
      } catch (errAviso) {
        console.error('Suscripción avisos vencimiento:', errAviso.message || errAviso);
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
