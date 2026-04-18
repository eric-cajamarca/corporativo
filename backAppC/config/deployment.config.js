/**
 * Modo de despliegue: SaaS (cobro, planes, enforcement) o Enterprise (licencia on-prem / dedicado, sin gate de suscripción).
 * Normaliza valor de process.env: quita comillas y comentarios en línea (ej. DEPLOYMENT_MODE=saas #nota en .env).
 */
function normalizarModoDesdeEnv(val) {
  let s = (val == null ? '' : String(val)).trim();
  const hash = s.indexOf('#');
  if (hash >= 0) {
    s = s.slice(0, hash).trim();
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.toLowerCase();
}

function getDeploymentMode() {
  const raw = normalizarModoDesdeEnv(process.env.DEPLOYMENT_MODE || 'enterprise');
  return raw === 'saas' ? 'saas' : 'enterprise';
}

function isSaas() {
  return getDeploymentMode() === 'saas';
}

function isEnterprise() {
  return getDeploymentMode() === 'enterprise';
}

module.exports = {
  getDeploymentMode,
  isSaas,
  isEnterprise
};
