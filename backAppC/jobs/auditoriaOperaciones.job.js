const { withPool } = require('../utils/dbPool.util');
const config = require('../config/auditoriaOperaciones.config');
const auditoriaOperacionesService = require('../services/auditoriaOperaciones.service');
const whatsappBotLogRepository = require('../repositories/whatsappBotLog.repository');

const DIAS_LOG_BOT = 60;

let timer = null;

async function purgarLogsBot() {
  try {
    const eliminados = await withPool((pool) =>
      whatsappBotLogRepository.eliminarAntiguos(pool, DIAS_LOG_BOT)
    );
    if (eliminados > 0) {
      console.error('whatsappBotLog purge:', eliminados);
    }
  } catch (err) {
    console.error('whatsappBotLog purge:', err.message || err);
  }
}

async function ejecutarPurge() {
  await purgarLogsBot();
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
  if (timer) return;
  void ejecutarPurge();
  timer = setInterval(() => {
    void ejecutarPurge();
  }, config.purgeIntervalMs || 24 * 60 * 60 * 1000);
}

module.exports = { iniciar, ejecutarPurge };
