const { isSaas } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const avisosRepository = require('../repositories/avisos.repository');

const PLANES_CINTA_AVISOS = new Set(['profesional', 'empresarial', 'enterprise']);

async function empresaPlanPermiteCintaAvisos(pool, idEmpresa) {
  if (!idEmpresa) return false;
  if (!isSaas()) return true;
  const sub = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  if (!sub) return false;
  const estado = String(sub.estado || '').toUpperCase();
  if (!['ACTIVA', 'DEMO'].includes(estado)) return false;
  const p = String(sub.planCode || '').toLowerCase().trim();
  return PLANES_CINTA_AVISOS.has(p);
}

/**
 * Avisos para la cinta del navbar (SUNAT y cuotas/cobranza).
 * Solo planes profesional, empresarial y enterprise (SaaS); enterprise on-prem siempre.
 */
exports.obtenerCinta = async (pool, user) => {
  const idEmpresa = user && user.empresa ? String(user.empresa).trim() : '';
  if (!idEmpresa) {
    return { items: [] };
  }

  const permitePlan = await empresaPlanPermiteCintaAvisos(pool, idEmpresa);
  if (!permitePlan) {
    return { items: [] };
  }

  const items = [];

  try {
    const pend = await avisosRepository.contarComprobantesPendienteEnvioRepo(pool, idEmpresa);
    if (pend > 0) {
      items.push({
        id: 'cinta-sunat-pendiente',
        severity: 'warning',
        message: `Tiene ${pend} comprobante(s) electrónico(s) pendiente(s) de envío a SUNAT.`,
        link: '/ventas',
        linkLabel: 'Ventas',
        dismissible: true,
        dismissKey: 'cinta-sunat-pendiente'
      });
    }

    const errSunat = await avisosRepository.contarComprobantesSunatNoOkRepo(pool, idEmpresa);
    if (errSunat > 0) {
      items.push({
        id: 'cinta-sunat-rechazo',
        severity: 'danger',
        message: `Hay ${errSunat} comprobante(s) con estado SUNAT distinto de aceptado. Revise ventas y envío SUNAT.`,
        link: '/ventas',
        linkLabel: 'Ventas',
        dismissible: true,
        dismissKey: 'cinta-sunat-rechazo'
      });
    }

    const cuotasMan = await avisosRepository.contarCuotasCreditoPorVencerMananaRepo(pool, idEmpresa);
    if (cuotasMan > 0) {
      items.push({
        id: 'cinta-cuotas-manana',
        severity: 'warning',
        message: `${cuotasMan} cuota(s) de crédito vencen mañana. Revise cobranza.`,
        link: '/creditos',
        linkLabel: 'Créditos',
        dismissible: true,
        dismissKey: 'cinta-cuotas-manana'
      });
    }

    const cuotasVen = await avisosRepository.contarCuotasCreditoVencidasRepo(pool, idEmpresa);
    if (cuotasVen > 0) {
      items.push({
        id: 'cinta-cuotas-vencidas',
        severity: 'danger',
        message: `${cuotasVen} cuota(s) de crédito vencida(s) con saldo pendiente.`,
        link: '/creditos',
        linkLabel: 'Créditos',
        dismissible: true,
        dismissKey: 'cinta-cuotas-vencidas'
      });
    }
  } catch (err) {
    const code = err.number ?? err.originalError?.number;
    const msg = err.message || '';
    if (code === 208 || /Invalid object name/.test(msg)) {
      return { items: [] };
    }
    console.error('avisos obtenerCinta:', err.message);
    throw err;
  }

  return { items };
};
