const factilizaRepository = require('../repositories/factiliza.repository');
const empresaRepository = require('../repositories/empresa.repository');
const whatsappFactilizaService = require('./whatsappFactiliza.service');
const geoIpCliente = require('../utils/geoIpCliente.util');

const NOMBRE_SERVICIO_WHATSAPP = 'Factiliza WHATSAPP';

/** Número desarrollador (solo dígitos). Definir ALERT_DEV_WHATSAPP en .env; sin valor no se alerta al dev. */
const NUMERO_DESARROLLADOR =
  (process.env.ALERT_DEV_WHATSAPP && String(process.env.ALERT_DEV_WHATSAPP).replace(/\D/g, '')) || '';

/** Mínimo entre alertas globales de error de sistema (evita spam). */
const THROTTLE_MS_ERRORES_SISTEMA = parseInt(process.env.ALERT_SYSTEM_THROTTLE_MS, 10) || 15 * 60 * 1000;

/** Throttle por empresa para avisos de replay de refresh (mismo orden de magnitud que login fallido). */
const THROTTLE_MS_REFRESH_REPLAY = parseInt(process.env.ALERT_REFRESH_REPLAY_THROTTLE_MS, 10) || 15 * 60 * 1000;

let ultimoAlertaSistema = 0;
const ultimoAlertaRefreshReplayPorEmpresa = new Map();

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
/**
 * Ciudad/región/país aproximados según IP pública; LAN o fallo de API → texto corto.
 */
async function descripcionUbicacionPorIp(ipCliente) {
  const ipStr = geoIpCliente.normalizarIp(ipCliente);
  if (!ipStr) return '—';
  if (geoIpCliente.esIpPrivadaOLocal(ipStr)) return 'Red local / LAN';
  const loc = await geoIpCliente.ubicacionAproximadaPorIp(ipStr);
  return loc || 'No disponible';
}

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
/**
 * Posible robo de refresh: reintento con token ya rotado. Aviso al desarrollador (throttle por empresa).
 */
exports.notificarRefreshTokenReplay = async (pool, params) => {
  const { idEmpresa, idUsuario, ipCliente } = params || {};
  if (!idEmpresa || NUMERO_DESARROLLADOR.length < 9) return;

  const key = String(idEmpresa).toLowerCase();
  const now = Date.now();
  const ult = ultimoAlertaRefreshReplayPorEmpresa.get(key) || 0;
  if (now - ult < THROTTLE_MS_REFRESH_REPLAY) return;
  ultimoAlertaRefreshReplayPorEmpresa.set(key, now);

  try {
    const emp = await empresaRepository.obtenerBasicaPorId(pool, idEmpresa);
    const razon = emp ? (emp.razon_Social || 'Empresa').toString().slice(0, 120) : 'Empresa';
    const ruc = emp && emp.ruc != null ? String(emp.ruc).trim() : '—';
    const ipLinea =
      ipCliente != null && String(ipCliente).trim()
        ? String(ipCliente).trim().slice(0, 45)
        : '—';
    const texto = `[EFAF Seguridad] Posible replay de refresh token
${razon} (RUC ${ruc})
idUsuario: ${idUsuario || '—'}
IP: ${ipLinea}
Acción: todas las sesiones del usuario en esa empresa fueron revocadas.`;
    await enviarTextoPlataforma(pool, NUMERO_DESARROLLADOR, texto);
  } catch (err) {
    console.error('notificarRefreshTokenReplay:', err.message);
  }
};

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

/** Solo administrador de empresa: aviso al celular de Empresas. superAdmin usa notificarLoginSuperAdminExitoso. */
const ROLES_ADMIN_LOGIN_WHATSAPP = ['Administrador'];

/**
 * Número fijo (solo dígitos) para alertar inicio de sesión del super usuario de plataforma.
 * Sobrescribir con SUPERADMIN_LOGIN_ALERT_WHATSAPP en .env si cambia el destino.
 */
const NUMERO_SUPERADMIN_LOGIN_ALERT =
  (() => {
    const raw = process.env.SUPERADMIN_LOGIN_ALERT_WHATSAPP;
    const d = raw != null && String(raw).trim() !== '' ? soloDigitos(raw) : '';
    return d.length >= 9 ? d : '51993289440';
  })();

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
    const ubicacionTxt = await descripcionUbicacionPorIp(ipCliente);

    const texto = `[EFAF CRM] Inicio de sesión — administrador
${razon}
RUC: ${ruc || '—'}
Correo de la sesión: ${emailLinea}
IP de origen: ${ipLinea}
Ubicación aprox. (por IP): ${ubicacionTxt}`;

    await enviarTextoPlataforma(pool, celularEmpresa, texto);
  } catch (err) {
    console.error('notificarLoginAdminExitoso:', err.message);
  }
};

/**
 * Inicio de sesión con rol superAdmin: aviso al número de supervisión (Factiliza WHATSAPP global).
 * Incluye usuario, empresa, RUC, correo e IP de origen.
 */
exports.notificarLoginSuperAdminExitoso = async (pool, params) => {
  const { idEmpresa, nombres, apellidos, email, ipCliente } = params || {};
  if (!idEmpresa) return;

  try {
    const emp = await empresaRepository.obtenerBasicaPorId(pool, idEmpresa);
    if (!emp) return;

    const nombreUsuario = [nombres, apellidos]
      .map((x) => (x != null ? String(x).trim() : ''))
      .filter(Boolean)
      .join(' ')
      .slice(0, 200) || '(sin nombre)';
    const razon = (emp.razon_Social || '—').toString().trim().slice(0, 200);
    const ruc = emp.ruc != null ? String(emp.ruc).trim() : '—';
    const correo =
      email != null && String(email).trim() ? String(email).trim().slice(0, 120) : '(sin correo)';
    const ipLinea =
      ipCliente != null && String(ipCliente).trim()
        ? String(ipCliente).trim().slice(0, 45)
        : 'desconocida';
    const ubicacionTxt = await descripcionUbicacionPorIp(ipCliente);

    const texto = `[EFAF CRM] Inicio de sesión — SUPER USUARIO (superAdmin)

Usuario: ${nombreUsuario}
Empresa: ${razon}
RUC: ${ruc}
Correo: ${correo}
IP de origen: ${ipLinea}
Ubicación aprox. (por IP): ${ubicacionTxt}`;

    await enviarTextoPlataforma(pool, NUMERO_SUPERADMIN_LOGIN_ALERT, texto);
  } catch (err) {
    console.error('notificarLoginSuperAdminExitoso:', err.message);
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
