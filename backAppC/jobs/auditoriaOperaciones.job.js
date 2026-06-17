const { withPool } = require('../utils/dbPool.util');
const config = require('../config/auditoriaOperaciones.config');
const auditoriaOperacionesService = require('../services/auditoriaOperaciones.service');

let timer = null;

async function ejecutarPurge() {
  if (!config.enabled) return;
  try {
    const r = await withPool((pool) => auditoriaOperacionesService.purgarAntiguos(pool));
    if (r.eliminados > 0) {
      console.error(
        'auditoriaOperaciones purge:',
        r.eliminados,
        'registro(s) eliminados (retención',
        config.retentionMonths,
        'meses)'
      );
    }
  } catch (err) {
    console.error('auditoriaOperaciones job:', err.message || err);
  }
}

function iniciar() {
  if (timer || !config.enabled) return;
  void ejecutarPurge();
  timer = setInterval(() => {
    void ejecutarPurge();
  }, config.purgeIntervalMs);
}

module.exports = { iniciar, ejecutarPurge };
