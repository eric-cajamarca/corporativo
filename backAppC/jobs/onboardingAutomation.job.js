const { withPool } = require('../utils/dbPool.util');
const { isSaas } = require('../config/deployment.config');
const onboardingAutomationService = require('../services/onboardingAutomation.service');

const INTERVAL_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.ONBOARDING_AUTOMATION_INTERVAL_MS || 60 * 60 * 1000)
);

let timer = null;

async function ejecutarUnaVez() {
  if (!isSaas()) return;
  try {
    await withPool(async (pool) => {
      const r = await onboardingAutomationService.ejecutarCiclo(pool);
      if (r.enviados > 0) {
        console.error('onboardingAutomation: correos enviados:', r.enviados, 'procesadas:', r.procesadas);
      }
    });
  } catch (err) {
    console.error('onboardingAutomation job:', err.message || err);
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

