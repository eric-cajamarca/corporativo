const onboardingAutomationRepository = require('../repositories/onboardingAutomation.repository');
const emailService = require('./email.service');

function pickCorreo(row) {
  const a = String(row?.correoEmpresa || '').trim();
  if (a) return a;
  const b = String(row?.correoUsuario || '').trim();
  return b || null;
}

function horasDesde(fechaIso) {
  if (!fechaIso) return null;
  const d = new Date(fechaIso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 3600000);
}

async function intentarNotificar(pool, row, payload, cooldownHoras = 24) {
  const totalReciente = await onboardingAutomationRepository.contarEventoReciente(
    pool,
    row.idEmpresa,
    payload.tipoEvento,
    cooldownHoras
  );
  if (totalReciente > 0) return false;

  const destinatario = pickCorreo(row);
  if (!destinatario) return false;

  await emailService.enviarNotificacionOperativa({
    to: destinatario,
    subject: payload.asunto,
    html: payload.html,
    text: payload.text
  });

  await onboardingAutomationRepository.registrarEvento(pool, {
    idEmpresa: row.idEmpresa,
    tipoEvento: payload.tipoEvento,
    destinatario,
    asunto: payload.asunto,
    detalle: payload.detalle || null,
    metadataJson: payload.metadataJson ? JSON.stringify(payload.metadataJson) : null
  });
  return true;
}

function htmlBase(titulo, cuerpoHtml) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <h2 style="margin-bottom: 12px;">${titulo}</h2>
      ${cuerpoHtml}
      <p style="font-size: 12px; color: #666; margin-top: 16px;">
        Este correo fue enviado por la automatización operativa (Fase 4).
      </p>
    </div>
  `;
}

async function ejecutarCiclo(pool) {
  const empresas = await onboardingAutomationRepository.listarEmpresasParaOnboarding(pool);
  let enviados = 0;

  for (const row of empresas) {
    const horas = horasDesde(row.fechaInicioSuscripcion);

    await intentarNotificar(
      pool,
      row,
      {
        tipoEvento: 'BIENVENIDA',
        asunto: `Bienvenido a la plataforma, ${row.razonSocial || 'equipo'}`,
        text:
          'Bienvenido. Recomendamos completar configuración SUNAT y emitir su primer comprobante dentro de las próximas 24 horas.',
        html: htmlBase(
          'Bienvenido a su nueva cuenta',
          '<p>Gracias por activar su suscripción. Para empezar rápido:</p><ol><li>Complete configuración SUNAT.</li><li>Registre productos/clientes base.</li><li>Emita su primer comprobante.</li></ol>'
        ),
        detalle: 'Correo de bienvenida onboarding'
      },
      24 * 365
    );

    if (
      row.estadoSuscripcion === 'PENDIENTE_PAGO' &&
      horas != null &&
      horas >= 6 &&
      (await intentarNotificar(
        pool,
        row,
        {
          tipoEvento: 'ACTIVA_PLAN',
          asunto: 'Complete la activación de su plan',
          text:
            'Detectamos que su cuenta sigue pendiente de pago. Complete el checkout para activar el plan y evitar bloqueo de ventas.',
          html: htmlBase(
            'Su plan aún no está activo',
            '<p>Detectamos que su suscripción sigue pendiente de pago.</p><p>Ingrese a <strong>Cuenta &gt; Mi suscripción</strong> y vincule su orden CHK para activar el plan.</p>'
          ),
          detalle: 'Recordatorio activación plan pendiente'
        },
        24
      ))
    ) {
      enviados += 1;
    }

    if (
      row.estadoSuscripcion !== 'PENDIENTE_PAGO' &&
      Number(row.tieneConfigSunat || 0) === 0 &&
      horas != null &&
      horas >= 12 &&
      (await intentarNotificar(
        pool,
        row,
        {
          tipoEvento: 'FALTA_SUNAT',
          asunto: 'Pendiente: configuración SUNAT',
          text:
            'Su empresa aún no termina la configuración SUNAT. Complete credenciales y certificado para poder emitir comprobantes electrónicos.',
          html: htmlBase(
            'Falta terminar configuración SUNAT',
            '<p>Aún no detectamos configuración SUNAT completa.</p><p>Ruta sugerida: <strong>Configuración &gt; Facturación</strong>.</p>'
          ),
          detalle: 'Recordatorio de configuración SUNAT'
        },
        24
      ))
    ) {
      enviados += 1;
    }
  }

  return { procesadas: empresas.length, enviados };
}

module.exports = {
  ejecutarCiclo
};

