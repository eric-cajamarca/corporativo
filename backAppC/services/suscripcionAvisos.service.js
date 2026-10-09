/**
 * Avisos de suscripción al cliente (empresa tenant) por WhatsApp y correo:
 *   - pre-aviso de vencimiento (por defecto 1 día antes y el mismo día)
 *   - suscripción vencida / pendiente de pago
 *   - pago confirmado por el administrador de plataforma
 *
 * Idempotencia: cada intento se registra en OnboardingAutomationLog y el
 * cooldown se evalúa por (empresa, evento, canal), así WhatsApp y correo no
 * se bloquean entre sí ni se reintenta en cada ciclo del job.
 */
const emailService = require('./email.service');
const seguridadAlertasService = require('./seguridadAlertas.service');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const onboardingAutomationRepository = require('../repositories/onboardingAutomation.repository');
const suscripcionRepository = require('../repositories/suscripcion.repository');
const suscripcionCheckoutRepository = require('../repositories/suscripcionCheckout.repository');
const { normalizarTelefonoWhatsApp } = require('../utils/telefonoWhatsApp.util');
const plantillas = require('../utils/suscripcionAvisoPlantillas.util');
const { getPagoManualSuscripcionConfig } = require('../config/pagoManualSuscripcion.config');

const EVENTO_POR_VENCER = 'SUSCRIPCION_POR_VENCER';
const EVENTO_VENCIDA = 'SUSCRIPCION_VENCIDA';
const EVENTO_PAGO_CONFIRMADO = 'SUSCRIPCION_PAGO_CONFIRMADO';

const CANAL_WHATSAPP = 'WHATSAPP';
const CANAL_EMAIL = 'EMAIL';

function enteroEnv(nombre, porDefecto, minimo) {
  const n = Number(process.env[nombre]);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.max(minimo, Math.floor(n));
}

/** Días de anticipación del pre-aviso (1 = avisa mañana y hoy). */
function diasPreaviso() {
  return enteroEnv('SUSCRIPCION_AVISO_DIAS_PREAVISO', 1, 0);
}

/** Menor a 24 h para que salga una vez por día sin depender de la hora del job. */
function cooldownPorVencerHoras() {
  return enteroEnv('SUSCRIPCION_AVISO_POR_VENCER_COOLDOWN_HORAS', 20, 1);
}

/** Mientras siga vencida se repite cada 3 días para no saturar al cliente. */
function cooldownVencidaHoras() {
  return enteroEnv('SUSCRIPCION_AVISO_VENCIDA_COOLDOWN_HORAS', 72, 1);
}

/** Solo evita duplicados por doble confirmación del admin. */
function cooldownPagoHoras() {
  return enteroEnv('SUSCRIPCION_AVISO_PAGO_COOLDOWN_HORAS', 1, 1);
}

function maxEmpresasPorCiclo() {
  return enteroEnv('SUSCRIPCION_AVISO_MAX_POR_CICLO', 200, 1);
}

/** Pausa entre WhatsApps para no gatillar el anti-spam del proveedor. */
function pausaEntreEnviosMs() {
  return enteroEnv('SUSCRIPCION_AVISO_PAUSA_MS', 1200, 0);
}

function dormir(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function destinoCorreo(row, correoAlternativo) {
  const candidatos = [row?.correoEmpresa, correoAlternativo, row?.correoUsuario];
  for (const c of candidatos) {
    const v = String(c || '').trim();
    if (v.includes('@')) return v;
  }
  return null;
}

function destinoWhatsApp(row) {
  const { digitos } = normalizarTelefonoWhatsApp(row?.celularEmpresa);
  return digitos && digitos.length >= 9 ? digitos : null;
}

function logAviso(nivel, mensaje, extra) {
  console.error('context:', JSON.stringify({
    level: nivel,
    message: mensaje,
    ...(extra || {})
  }));
}

/**
 * Envía por un canal respetando cooldown y registra el intento.
 * @returns {Promise<'enviado'|'error'|'cooldown'|'sin_destino'|'canal_no_disponible'>}
 */
async function enviarPorCanal(pool, params) {
  const { idEmpresa, tipoEvento, canal, destino, cooldownHoras, contenido } = params;

  if (!destino) return 'sin_destino';
  if (canal === CANAL_EMAIL && !emailService.isSmtpConfigured()) {
    return 'canal_no_disponible';
  }

  const yaEnviado = await onboardingAutomationRepository.contarEventoRecientePorCanal(
    pool,
    idEmpresa,
    tipoEvento,
    canal,
    cooldownHoras
  );
  if (yaEnviado > 0) return 'cooldown';

  let detalle = 'ok';
  let resultado = 'enviado';
  try {
    if (canal === CANAL_WHATSAPP) {
      const r = await seguridadAlertasService.enviarWhatsAppPlataforma(pool, destino, contenido.texto);
      if (!r || r.ok !== true) {
        resultado = 'error';
        detalle = `whatsapp no enviado: ${r?.reason || r?.message || 'sin detalle'}`.slice(0, 400);
      } else {
        detalle = `ok via ${r.canal || 'whatsapp'}`;
      }
    } else {
      await emailService.enviarNotificacionOperativa({
        to: destino,
        subject: contenido.asunto,
        text: contenido.texto,
        html: contenido.html
      });
    }
  } catch (err) {
    resultado = 'error';
    detalle = `error: ${String(err.message || err)}`.slice(0, 400);
  }

  try {
    await onboardingAutomationRepository.registrarEvento(pool, {
      idEmpresa,
      tipoEvento,
      canal,
      destinatario: canal === CANAL_EMAIL ? destino : `whatsapp:${destino}`,
      asunto: contenido.asunto,
      detalle
    });
  } catch (errLog) {
    logAviso('error', 'suscripcion_aviso_log_error', {
      tipoEvento,
      canal,
      err: String(errLog.message || errLog)
    });
  }

  return resultado;
}

/**
 * Envía un aviso por WhatsApp y correo. Un canal caído no impide el otro.
 */
async function enviarAvisoMultiCanal(pool, row, params) {
  const { tipoEvento, cooldownHoras, contenido, correoAlternativo } = params;
  const idEmpresa = row.idEmpresa;

  const rWhatsapp = await enviarPorCanal(pool, {
    idEmpresa,
    tipoEvento,
    canal: CANAL_WHATSAPP,
    destino: destinoWhatsApp(row),
    cooldownHoras,
    contenido
  });

  const rEmail = await enviarPorCanal(pool, {
    idEmpresa,
    tipoEvento,
    canal: CANAL_EMAIL,
    destino: destinoCorreo(row, correoAlternativo),
    cooldownHoras,
    contenido
  });

  const enviados = [rWhatsapp, rEmail].filter((x) => x === 'enviado').length;
  if (enviados === 0 && (rWhatsapp === 'error' || rEmail === 'error')) {
    logAviso('warn', 'suscripcion_aviso_sin_entrega', {
      tipoEvento,
      whatsapp: rWhatsapp,
      email: rEmail
    });
  }
  return { whatsapp: rWhatsapp, email: rEmail, enviados };
}

function contenidoSegunTipo(row, pagoManual) {
  const base = {
    razonSocial: row.razonSocial,
    planCode: row.planCode,
    billingCycle: row.billingCycle,
    fechaFin: row.fechaFin,
    diasRestantes: row.diasRestantes,
    frontendUrl: emailService.getFrontendUrl(),
    pagoManual
  };
  if (row.tipoAviso === 'POR_VENCER') {
    return {
      tipoEvento: EVENTO_POR_VENCER,
      cooldownHoras: cooldownPorVencerHoras(),
      contenido: plantillas.avisoPorVencer(base)
    };
  }
  return {
    tipoEvento: EVENTO_VENCIDA,
    cooldownHoras: cooldownVencidaHoras(),
    contenido: plantillas.avisoVencida(base)
  };
}

/**
 * Ciclo del job: pre-avisos y vencidas. Un fallo por empresa no corta el resto.
 */
async function ejecutarCicloVencimientos(pool) {
  let pagoManual = null;
  try {
    pagoManual = await getPagoManualSuscripcionConfig(pool);
  } catch (errPago) {
    console.error('suscripcionAvisos pagoManual:', errPago?.message || errPago);
  }

  const filas = await empresaSuscripcionRepository.listarParaAvisoVencimiento(pool, diasPreaviso());
  const tope = maxEmpresasPorCiclo();
  const pausa = pausaEntreEnviosMs();

  let enviados = 0;
  let errores = 0;
  let procesadas = 0;

  for (const row of filas) {
    if (procesadas >= tope) break;
    procesadas += 1;
    try {
      const plan = contenidoSegunTipo(row, pagoManual);
      const r = await enviarAvisoMultiCanal(pool, row, plan);
      enviados += r.enviados;
      if (r.whatsapp === 'error' || r.email === 'error') errores += 1;
      if (r.whatsapp === 'enviado') await dormir(pausa);
    } catch (err) {
      errores += 1;
      logAviso('error', 'suscripcion_aviso_empresa_error', {
        idEmpresa: row.idEmpresa,
        tipoAviso: row.tipoAviso,
        err: String(err.message || err)
      });
    }
  }

  return { candidatas: filas.length, procesadas, enviados, errores };
}

/**
 * Aviso de pago confirmado por el administrador de plataforma.
 * No lanza: la confirmación del pago no debe fallar por un aviso.
 */
async function notificarPagoConfirmado(pool, datos) {
  const idEmpresa = datos && datos.idEmpresa ? String(datos.idEmpresa).trim() : '';
  if (!idEmpresa) return { enviados: 0, motivo: 'sin_empresa' };

  try {
    const row = await empresaSuscripcionRepository.obtenerDatosAvisoPorEmpresa(pool, idEmpresa);
    if (!row) return { enviados: 0, motivo: 'sin_suscripcion' };

    const contenido = plantillas.avisoPagoConfirmado({
      razonSocial: row.razonSocial,
      planCode: datos.planCode || row.planCode,
      billingCycle: datos.billingCycle || row.billingCycle,
      fechaFin: row.fechaFin,
      orderNumber: datos.orderNumber,
      monto: datos.monto,
      moneda: datos.moneda,
      frontendUrl: emailService.getFrontendUrl()
    });

    return await enviarAvisoMultiCanal(pool, row, {
      tipoEvento: EVENTO_PAGO_CONFIRMADO,
      cooldownHoras: cooldownPagoHoras(),
      contenido,
      correoAlternativo: datos.emailContacto
    });
  } catch (err) {
    logAviso('error', 'suscripcion_aviso_pago_confirmado_error', {
      idEmpresa,
      err: String(err.message || err)
    });
    return { enviados: 0, motivo: 'error' };
  }
}

/**
 * Notificación comercial inmediata al WhatsApp del administrador de plataforma
 * cuando se registra una nueva cuenta demo o una cuenta con plan de pago.
 */
async function notificarRegistroEmpresaAdmin(pool, datos) {
  try {
    const idPrincipal = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
    let celPrincipal = idPrincipal ? await suscripcionRepository.obtenerCelularEmpresa(pool, idPrincipal) : null;
    const cfg = getPagoManualSuscripcionConfig();
    const destinoRaw = celPrincipal || cfg.whatsappE164 || process.env.PAGO_MANUAL_WHATSAPP;
    const destino = normalizarTelefonoWhatsApp(destinoRaw).digitos;

    if (!destino || destino.length < 9) {
      logAviso('warn', 'notificar_registro_admin_sin_destino', { destinoRaw });
      return { ok: false, reason: 'sin_destino_admin' };
    }

    let celCliente = String(datos.celular || '').replace(/\D/g, '');
    if (celCliente.length === 9 && celCliente.startsWith('9')) {
      celCliente = `51${celCliente}`;
    }

    const locArr = [datos.distrito, datos.provincia, datos.region].filter(Boolean);
    const ubicacion = locArr.length > 0 ? locArr.join(', ') : (datos.direccion || 'Perú');

    let planNombre = 'Demo 14 días (Gratis)';
    if (!datos.esDemo) {
      if (datos.checkoutOrderNumber) {
        try {
          const chk = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, datos.checkoutOrderNumber);
          if (chk?.planCode) {
            const ciclo = chk.billingCycle === 'yearly' ? 'Anual' : 'Mensual';
            const monto = Number(chk.montoSoles || 0).toFixed(2);
            planNombre = `Plan ${String(chk.planCode).toUpperCase()} (${ciclo} - S/ ${monto})`;
          } else {
            planNombre = `Plan de pago (Orden: ${datos.checkoutOrderNumber})`;
          }
        } catch {
          planNombre = `Plan de pago (Orden: ${datos.checkoutOrderNumber})`;
        }
      } else {
        planNombre = 'Plan de pago';
      }
    }

    const saludo = `Hola ${datos.razon_Social || ''}, vi que te registraste en EFAF ERP (${datos.esDemo ? 'cuenta Demo' : 'plan de pago'}). ¿Pudiste ingresar o necesitas ayuda con la configuración inicial?`.trim();
    const linkWa = celCliente ? `https://wa.me/${celCliente}?text=${encodeURIComponent(saludo)}` : null;

    const lineas = [
      datos.esDemo
        ? '🚀 *¡Nueva Cuenta Demo Registrada en EFAF ERP!*'
        : '🎉 *¡Nueva Cuenta Empresa Registrada en EFAF ERP!*',
      '',
      `🏢 *Empresa:* ${datos.razon_Social || 'Sin razón social'}`,
      `🆔 *RUC:* ${datos.ruc || '—'}${datos.estSunat ? ` (${datos.estSunat}${datos.condicion ? ` · ${datos.condicion}` : ''})` : ''}`,
      `📱 *Celular:* ${celCliente ? `+${celCliente}` : 'No indicado'}`,
      `✉️ *Correo:* ${datos.correo || 'No indicado'}`,
      `📍 *Ubicación:* ${ubicacion}`,
      `🔑 *Código activación:* *${datos.codigoActivacion || '—'}*${datos.claveAcceso ? ` (Clave: ${datos.claveAcceso})` : ''}`,
      `⏰ *Plan:* ${planNombre}`,
      ''
    ];

    if (linkWa) {
      lineas.push(
        '👉 *Escribir al cliente por WhatsApp:*',
        linkWa
      );
    }

    const texto = lineas.join('\n');
    const r = await seguridadAlertasService.enviarWhatsAppPlataforma(pool, destino, texto);
    return { ok: Boolean(r?.ok), canal: r?.canal };
  } catch (err) {
    logAviso('error', 'notificar_registro_admin_error', { err: String(err.message || err) });
    return { ok: false, error: err.message };
  }
}

module.exports = {
  ejecutarCicloVencimientos,
  notificarPagoConfirmado,
  notificarRegistroEmpresaAdmin,
  EVENTO_POR_VENCER,
  EVENTO_VENCIDA,
  EVENTO_PAGO_CONFIRMADO
};
