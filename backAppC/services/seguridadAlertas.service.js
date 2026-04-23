const factilizaRepository = require('../repositories/factiliza.repository');
const empresaRepository = require('../repositories/empresa.repository');
const whatsappFactilizaService = require('./whatsappFactiliza.service');

const NOMBRE_SERVICIO_WHATSAPP = 'Factiliza WHATSAPP';

/** Número desarrollador (solo dígitos). Definir ALERT_DEV_WHATSAPP en .env; sin valor no se alerta al dev. */
const NUMERO_DESARROLLADOR =
  (process.env.ALERT_DEV_WHATSAPP && String(process.env.ALERT_DEV_WHATSAPP).replace(/\D/g, '')) || '';

/** Mínimo entre alertas globales de error de sistema (evita spam). */
const THROTTLE_MS_ERRORES_SISTEMA = parseInt(process.env.ALERT_SYSTEM_THROTTLE_MS, 10) || 15 * 60 * 1000;

let ultimoAlertaSistema = 0;

function soloDigitos(num) {
  if (num == null || num === '') return '';
  return String(num).replace(/\D/g, '');
}

async function obtenerConfigWhatsApp(pool) {
  return factilizaRepository.getConfigByNombre(pool, NOMBRE_SERVICIO_WHATSAPP);
}

/**
 * Envía texto por Factiliza WHATSAPP (config global). No lanza; registra error en consola.
 */
async function enviarTextoPlataforma(pool, numeroDestino, texto) {
  const digits = soloDigitos(numeroDestino);
  if (digits.length < 9) return;
  const t = String(texto || '').trim().slice(0, 3500);
  if (!t) return;

  try {
    const config = await obtenerConfigWhatsApp(pool);
    if (!config || !config.tokenDefault || !String(config.parametroRuta || '').trim()) {
      console.error('seguridadAlertas: Factiliza WHATSAPP no configurado (token o parametroRuta).');
      return;
    }
    const resultado = await whatsappFactilizaService.sendText(config, digits, t);
    if (!resultado.success) {
      console.error('seguridadAlertas: API WhatsApp respondió error:', resultado.message);
    }
  } catch (err) {
    console.error('seguridadAlertas enviarTextoPlataforma:', err.message);
  }
}

/**
 * Tras intento fallido de login: aviso a empresa (3.er y 5.to) y a desarrollador (3 y 5).
 */
exports.notificarLoginFallido = async (pool, params) => {
  const {
    empresa,
    email,
    intentosFallidos,
    recienBloqueado,
    ipCliente
  } = params;

  const razon = empresa.razon_Social || empresa.razonSocial || 'Empresa';
  const ruc = empresa.ruc || '';
  const celularEmpresa = soloDigitos(empresa.celular);
  const ipLinea =
    ipCliente && String(ipCliente).trim() ? `\nIP: ${String(ipCliente).trim().slice(0, 45)}` : '';

  const base = `[EFAF Login] RUC ${ruc} ${razon}\nEmail intentado: ${email}\nIntentos fallidos: ${intentosFallidos}${ipLinea}`;

  const alertaDev =
    intentosFallidos === 3 || intentosFallidos >= 5 || recienBloqueado;
  if (alertaDev) {
    const extra = recienBloqueado ? '\nEstado: CUENTA BLOQUEADA 30 min.' : '';
    await enviarTextoPlataforma(pool, NUMERO_DESARROLLADOR, base + extra);
  }

  if (celularEmpresa.length >= 9 && (intentosFallidos === 3 || recienBloqueado)) {
    const msgEmpresa = recienBloqueado
      ? `${base}\nSu acceso fue bloqueado temporalmente por seguridad. Espere 30 minutos o contacte soporte.`
      : `${base}\nAdvertencia de seguridad: si no fue usted, revise sus usuarios.`;
    await enviarTextoPlataforma(pool, celularEmpresa, msgEmpresa);
  }
};

const ROLES_ADMIN_LOGIN_WHATSAPP = ['Administrador', 'superAdmin'];

/**
 * Aviso por WhatsApp al celular registrado en Empresas tras login exitoso de administrador.
 * No lanza; fallos solo en consola. Requiere Factiliza WHATSAPP configurado (igual que alertas de login fallido).
 */
exports.notificarLoginAdminExitoso = async (pool, params) => {
  const { idEmpresa, email, ipCliente, rol } = params || {};
  if (!idEmpresa || !ROLES_ADMIN_LOGIN_WHATSAPP.includes(rol)) return;

  try {
    const emp = await empresaRepository.obtenerBasicaPorId(pool, idEmpresa);
    if (!emp) return;

    const celularEmpresa = soloDigitos(emp.celular);
    if (celularEmpresa.length < 9) return;

    const razon = emp.razon_Social || 'Empresa';
    const ruc = emp.ruc != null ? String(emp.ruc).trim() : '';
    const emailLinea = email != null && String(email).trim() ? String(email).trim().slice(0, 120) : '(sin correo)';
    const ipLinea =
      ipCliente != null && String(ipCliente).trim()
        ? String(ipCliente).trim().slice(0, 45)
        : 'desconocida';

    const texto = `[EFAF CRM] Inicio de sesión — administrador
${razon}
RUC: ${ruc || '—'}
Correo de la sesión: ${emailLinea}
IP de origen: ${ipLinea}`;

    await enviarTextoPlataforma(pool, celularEmpresa, texto);
  } catch (err) {
    console.error('notificarLoginAdminExitoso:', err.message);
  }
};

/**
 * Error interno (login u otro). Solo al desarrollador, con throttle.
 */
exports.notificarErrorSistema = async (pool, contexto) => {
  const now = Date.now();
  if (now - ultimoAlertaSistema < THROTTLE_MS_ERRORES_SISTEMA) return;
  ultimoAlertaSistema = now;

  const ctx = String(contexto || '').slice(0, 500);
  const texto = `[EFAF Sistema] Error interno\n${ctx}\nRevise logs del servidor.`;
  await enviarTextoPlataforma(pool, NUMERO_DESARROLLADOR, texto);
};

/**
 * Para middleware Express: path + mensaje breve.
 */
exports.notificarErrorSistemaDesdeRequest = async (pool, err, req) => {
  const path = req && req.originalUrl ? req.originalUrl : '';
  const msg = err && err.message ? err.message : String(err);
  await exports.notificarErrorSistema(pool, `${req?.method || ''} ${path}\n${msg.slice(0, 400)}`);
};
