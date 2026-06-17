const enabled = process.env.AUDITORIA_OPERACIONES_ENABLED !== '0';

const retentionMonthsRaw = parseInt(process.env.AUDITORIA_OPERACIONES_RETENTION_MONTHS || '6', 10);
const retentionMonths = Number.isFinite(retentionMonthsRaw) && retentionMonthsRaw > 0 ? retentionMonthsRaw : 6;

const purgeIntervalRaw = parseInt(process.env.AUDITORIA_OPERACIONES_PURGE_INTERVAL_MS || '86400000', 10);
const purgeIntervalMs = Number.isFinite(purgeIntervalRaw) && purgeIntervalRaw >= 3600000
  ? purgeIntervalRaw
  : 86400000;

module.exports = {
  enabled,
  retentionMonths,
  purgeIntervalMs
};
