/**
 * Plantillas de los avisos de suscripción (WhatsApp y correo).
 * Cada armador devuelve { asunto, texto, html } para reutilizar el mismo
 * contenido en ambos canales sin duplicar redacción.
 */

const RUTA_MI_SUSCRIPCION = '/cuenta/suscripcion';

const NOMBRES_PLAN = {
  demo: 'Demo',
  basico: 'Básico',
  profesional: 'Profesional',
  empresarial: 'Empresarial',
  enterprise: 'Enterprise'
};

const NOMBRES_CICLO = {
  monthly: 'mensual',
  yearly: 'anual',
  annual: 'anual'
};

function nombrePlan(planCode) {
  const code = String(planCode || '').toLowerCase().trim();
  if (!code) return 'su plan';
  if (NOMBRES_PLAN[code]) return NOMBRES_PLAN[code];
  return code.charAt(0).toUpperCase() + code.slice(1);
}

function nombreCiclo(billingCycle) {
  const c = String(billingCycle || '').toLowerCase().trim();
  return NOMBRES_CICLO[c] || c || '';
}

/** 'YYYY-MM-DD HH:mm:ss' o Date -> 'DD/MM/YYYY'. */
function fechaLegible(valor) {
  if (!valor) return '';
  const ymd = valor instanceof Date
    ? `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`
    : String(valor).slice(0, 10);
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return String(valor).slice(0, 19);
  return `${d}/${m}/${y}`;
}

function montoLegible(monto, moneda) {
  const n = Number(monto);
  if (!Number.isFinite(n) || n <= 0) return '';
  const simbolo = String(moneda || 'PEN').toUpperCase() === 'USD' ? '$ ' : 'S/ ';
  return `${simbolo}${n.toFixed(2)}`;
}

function urlMiSuscripcion(frontendUrl) {
  const base = String(frontendUrl || '').replace(/\/+$/, '');
  return `${base}${RUTA_MI_SUSCRIPCION}`;
}

function etiquetaPlanCiclo(planCode, billingCycle) {
  const plan = nombrePlan(planCode);
  const ciclo = nombreCiclo(billingCycle);
  return ciclo ? `${plan} (${ciclo})` : plan;
}

function htmlBase(titulo, cuerpoHtml, url) {
  const boton = url
    ? `<p style="margin: 24px 0;">
         <a href="${url}" style="display:inline-block;padding:12px 24px;background:#0d6efd;color:#fff;text-decoration:none;border-radius:8px;">Ver mi suscripción</a>
       </p>`
    : '';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #212529;">
      <h2 style="margin-bottom: 12px;">${titulo}</h2>
      ${cuerpoHtml}
      ${boton}
      <p style="font-size: 12px; color: #666; margin-top: 16px;">
        Mensaje automático del sistema de suscripciones. Si ya realizó el pago, ignore este aviso.
      </p>
    </div>
  `;
}

/**
 * Pre-aviso: la suscripción vence hoy o mañana (según diasRestantes).
 */
function avisoPorVencer(datos) {
  const { razonSocial, planCode, billingCycle, fechaFin, diasRestantes, frontendUrl } = datos;
  const dias = Number(diasRestantes || 0);
  const cuando = dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
  const url = urlMiSuscripcion(frontendUrl);
  const planTxt = etiquetaPlanCiclo(planCode, billingCycle);
  const fechaTxt = fechaLegible(fechaFin);
  const empresa = razonSocial || 'su empresa';

  const asunto = `Su plan ${nombrePlan(planCode)} vence ${cuando}`;

  const texto = [
    `*Su suscripción vence ${cuando}*`,
    `Empresa: ${empresa}`,
    `Plan: ${planTxt}`,
    `Vencimiento: ${fechaTxt}`,
    '',
    'Renueve antes del vencimiento para no interrumpir ventas ni facturación electrónica.',
    `Renovar: ${url}`
  ].join('\n');

  const html = htmlBase(
    `Su suscripción vence ${cuando}`,
    `<p>Le recordamos que la suscripción de <strong>${empresa}</strong> está por vencer.</p>
     <ul>
       <li>Plan: <strong>${planTxt}</strong></li>
       <li>Fecha de vencimiento: <strong>${fechaTxt}</strong></li>
     </ul>
     <p>Renueve antes del vencimiento para no interrumpir la emisión de comprobantes.</p>`,
    url
  );

  return { asunto, texto, html };
}

/**
 * Suscripción vencida: acceso limitado, queda pendiente de pago.
 */
function avisoVencida(datos) {
  const { razonSocial, planCode, billingCycle, fechaFin, diasRestantes, frontendUrl } = datos;
  const diasVencida = Math.abs(Number(diasRestantes || 0));
  const hace = diasVencida > 0 ? ` (hace ${diasVencida} día${diasVencida === 1 ? '' : 's'})` : '';
  const url = urlMiSuscripcion(frontendUrl);
  const planTxt = etiquetaPlanCiclo(planCode, billingCycle);
  const fechaTxt = fechaLegible(fechaFin);
  const empresa = razonSocial || 'su empresa';

  const asunto = 'Suscripción vencida: pendiente de pago';

  const texto = [
    '*Suscripción vencida*',
    `Empresa: ${empresa}`,
    `Plan: ${planTxt}`,
    `Venció: ${fechaTxt}${hace}`,
    'Estado: PENDIENTE DE PAGO',
    '',
    'Su acceso quedará limitado hasta registrar el pago.',
    `Regularizar: ${url}`
  ].join('\n');

  const html = htmlBase(
    'Su suscripción está vencida',
    `<p>La suscripción de <strong>${empresa}</strong> venció y figura como <strong>PENDIENTE DE PAGO</strong>.</p>
     <ul>
       <li>Plan: <strong>${planTxt}</strong></li>
       <li>Venció el: <strong>${fechaTxt}</strong>${hace}</li>
     </ul>
     <p>Regularice el pago para restablecer el acceso completo al sistema.</p>`,
    url
  );

  return { asunto, texto, html };
}

/**
 * Confirmación del administrador de plataforma: pago validado y plan aplicado.
 */
function avisoPagoConfirmado(datos) {
  const {
    razonSocial,
    planCode,
    billingCycle,
    fechaFin,
    orderNumber,
    monto,
    moneda,
    frontendUrl
  } = datos;
  const url = urlMiSuscripcion(frontendUrl);
  const planTxt = etiquetaPlanCiclo(planCode, billingCycle);
  const empresa = razonSocial || 'su empresa';
  const montoTxt = montoLegible(monto, moneda);
  const fechaTxt = fechaLegible(fechaFin);

  const asunto = 'Pago confirmado: su suscripción está activa';

  const lineas = [
    '*Pago confirmado*',
    `Empresa: ${empresa}`,
    `Plan: ${planTxt}`
  ];
  if (orderNumber) lineas.push(`Orden: ${orderNumber}`);
  if (montoTxt) lineas.push(`Monto: ${montoTxt}`);
  if (fechaTxt) lineas.push(`Vigencia hasta: ${fechaTxt}`);
  lineas.push('', 'Su suscripción quedó ACTIVA. Gracias por su pago.', `Detalle: ${url}`);

  const detalleHtml = [
    `<li>Plan: <strong>${planTxt}</strong></li>`,
    orderNumber ? `<li>Orden: <strong>${orderNumber}</strong></li>` : '',
    montoTxt ? `<li>Monto: <strong>${montoTxt}</strong></li>` : '',
    fechaTxt ? `<li>Vigencia hasta: <strong>${fechaTxt}</strong></li>` : ''
  ].join('');

  const html = htmlBase(
    'Pago confirmado',
    `<p>Registramos el pago de la suscripción de <strong>${empresa}</strong>. Su plan quedó <strong>ACTIVO</strong>.</p>
     <ul>${detalleHtml}</ul>
     <p>Gracias por su pago.</p>`,
    url
  );

  return { asunto, texto: lineas.join('\n'), html };
}

module.exports = {
  avisoPorVencer,
  avisoVencida,
  avisoPagoConfirmado,
  nombrePlan,
  fechaLegible,
  urlMiSuscripcion
};
