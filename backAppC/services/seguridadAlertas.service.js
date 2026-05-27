const factilizaRepository = require('../repositories/factiliza.repository');
const empresaRepository = require('../repositories/empresa.repository');
const whatsappFactilizaService = require('./whatsappFactiliza.service');
const geoIpCliente = require('../utils/geoIpCliente.util');

const NOMBRE_SERVICIO_WHATSAPP = 'Factiliza WHATSAPP';

/**
 * Override opcional por .env. Si se define, se usa SIEMPRE en lugar de la BD.
 * Util para entornos donde el numero de dev no coincide con la instancia Factiliza
 * (ej. notificar a un on-call distinto del numero dueño del bot).
 */
const NUMERO_DESARROLLADOR_OVERRIDE =
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
 * Decodifica el parametroRuta de FactilizaConfig (base64 del numero de la
 * instancia, ej "NTE5OTMyODk0NDA=" -> "51993289440") y lo retorna como
 * solo digitos. Si no es base64 valido pero ya luce como numero, lo retorna
 * tal cual (defensa contra cambios futuros).
 */
function decodificarNumeroDeParametroRuta(parametroRuta) {
  const raw = String(parametroRuta || '').trim();
  if (!raw) return '';
  if (/^\d{9,}$/.test(raw)) return raw;
  try {
    const dec = Buffer.from(raw, 'base64').toString('utf8');
    return soloDigitos(dec);
  } catch (e) {
    return '';
  }
}

/**
 * Cache breve en memoria para evitar query repetida en cada alerta.
 * TTL configurable; default 5 min.
 */
const ALERT_DEV_CACHE_TTL_MS = parseInt(process.env.ALERT_DEV_CACHE_TTL_MS, 10) || 5 * 60 * 1000;
let cacheNumeroDev = { numero: '', ts: 0 };

/**
 * Resuelve el numero del desarrollador para alertas:
 *   1) ALERT_DEV_WHATSAPP en .env si esta definido (override),
 *   2) decode(parametroRuta) de FactilizaConfig (Factiliza WHATSAPP, estado=1).
 * Retorna '' si ninguno produce un numero >= 9 digitos.
 */
async function obtenerNumeroDev(pool) {
  if (NUMERO_DESARROLLADOR_OVERRIDE.length >= 9) return NUMERO_DESARROLLADOR_OVERRIDE;
  const ahora = Date.now();
  if (cacheNumeroDev.numero && ahora - cacheNumeroDev.ts < ALERT_DEV_CACHE_TTL_MS) {
    return cacheNumeroDev.numero;
  }
  try {
    const cfg = await obtenerConfigWhatsApp(pool);
    const num = cfg ? decodificarNumeroDeParametroRuta(cfg.parametroRuta) : '';
    if (num.length >= 9) {
      cacheNumeroDev = { numero: num, ts: ahora };
      return num;
    }
  } catch (err) {
    console.error('context:', JSON.stringify({
      level: 'warn',
      message: 'alert_dev_lookup_error',
      err: err.message
    }));
  }
  return '';
}

/** Permite invalidar la cache (por ejemplo despues de actualizar FactilizaConfig). */
exports.invalidarCacheNumeroDev = function () {
  cacheNumeroDev = { numero: '', ts: 0 };
};

exports.obtenerNumeroDev = obtenerNumeroDev;

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

/**
 * Estado runtime para health-check de Factiliza WhatsApp:
 *   - falloConsecutivos: # de envios fallidos seguidos
 *   - ultimoExitoTs: timestamp ms del ultimo envio OK
 *   - ultimoErrorTs: timestamp ms del ultimo error
 *   - notificadoDownEmail: si ya se mando aviso por email para no repetirlo cada minuto
 */
const factilizaWhatsAppHealth = {
  falloConsecutivos: 0,
  ultimoExitoTs: 0,
  ultimoErrorTs: 0,
  ultimoErrorMsg: '',
  notificadoDownEmail: false,
  notificadoDownEmailTs: 0
};
const FACTILIZA_DOWN_THRESHOLD = parseInt(process.env.FACTILIZA_WHATSAPP_DOWN_THRESHOLD, 10) || 3;
const FACTILIZA_DOWN_EMAIL_THROTTLE_MS = parseInt(process.env.FACTILIZA_WHATSAPP_DOWN_EMAIL_THROTTLE_MS, 10) || 60 * 60 * 1000;

function ofuscarNumero(num) {
  const d = soloDigitos(num);
  if (d.length < 5) return '***';
  return d.slice(0, 3) + '****' + d.slice(-2);
}

async function avisarPorEmailFactilizaCaida(detalle) {
  const ahora = Date.now();
  if (factilizaWhatsAppHealth.notificadoDownEmail
    && ahora - factilizaWhatsAppHealth.notificadoDownEmailTs < FACTILIZA_DOWN_EMAIL_THROTTLE_MS) {
    return;
  }
  factilizaWhatsAppHealth.notificadoDownEmail = true;
  factilizaWhatsAppHealth.notificadoDownEmailTs = ahora;
  try {
    const emailService = require('./email.service');
    const to = process.env.ALERT_DEV_EMAIL || process.env.SMTP_USER || process.env.SMTP_FROM;
    if (!to) {
      console.error('context:', JSON.stringify({
        level: 'warn',
        message: 'factiliza_whatsapp_down_email_skip',
        detail: 'No hay ALERT_DEV_EMAIL/SMTP_USER configurado para enviar aviso por email.'
      }));
      return;
    }
    await emailService.enviarCorreo({
      to,
      subject: '[EFAF] Factiliza WhatsApp caido - alertas de seguridad inactivas',
      text:
        'Las alertas WhatsApp del sistema fallan consecutivamente.\n' +
        `Fallos consecutivos: ${factilizaWhatsAppHealth.falloConsecutivos}\n` +
        `Ultimo error: ${factilizaWhatsAppHealth.ultimoErrorMsg}\n` +
        `Detalle: ${detalle}\n\n` +
        'Acciones recomendadas:\n' +
        ' 1) Revisar token e instancia en panel Factiliza.\n' +
        ' 2) Validar fila FactilizaConfig (nombre = "Factiliza WHATSAPP").\n' +
        ' 3) Reintentar manualmente con backAppC/scripts/_diag-factiliza-fix.js.'
    });
  } catch (err) {
    console.error('context:', JSON.stringify({
      level: 'error',
      message: 'factiliza_whatsapp_down_email_failed',
      err: err.message
    }));
  }
}

async function enviarTextoPlataforma(pool, numeroDestino, texto) {
  const digits = soloDigitos(numeroDestino);
  if (digits.length < 9) {
    console.error('context:', JSON.stringify({
      level: 'info',
      message: 'alerta_whatsapp_skip_destino_invalido',
      destinoOfuscado: ofuscarNumero(digits || numeroDestino)
    }));
    return { ok: false, skipped: true, reason: 'destino_invalido' };
  }
  const t = String(texto || '').trim().slice(0, 3500);
  if (!t) return { ok: false, skipped: true, reason: 'texto_vacio' };

  let config;
  try {
    config = await obtenerConfigWhatsApp(pool);
  } catch (err) {
    console.error('context:', JSON.stringify({
      level: 'error',
      message: 'alerta_whatsapp_config_load_error',
      err: err.message
    }));
    return { ok: false, error: 'config_load_error' };
  }
  if (!config || !config.tokenDefault || !String(config.parametroRuta || '').trim()) {
    console.error('context:', JSON.stringify({
      level: 'warn',
      message: 'alerta_whatsapp_config_incompleta',
      detail: 'Factiliza WHATSAPP no tiene tokenDefault o parametroRuta. UPDATE FactilizaConfig requerido.'
    }));
    return { ok: false, error: 'config_incompleta' };
  }

  try {
    const resultado = await whatsappFactilizaService.sendText(config, digits, t);
    if (resultado.success) {
      factilizaWhatsAppHealth.falloConsecutivos = 0;
      factilizaWhatsAppHealth.ultimoExitoTs = Date.now();
      factilizaWhatsAppHealth.notificadoDownEmail = false;
      return { ok: true, status: resultado.status };
    }
    factilizaWhatsAppHealth.falloConsecutivos += 1;
    factilizaWhatsAppHealth.ultimoErrorTs = Date.now();
    factilizaWhatsAppHealth.ultimoErrorMsg = String(resultado.message || '').slice(0, 200);
    console.error('context:', JSON.stringify({
      level: 'error',
      message: 'alerta_whatsapp_api_no_ok',
      status: resultado.status,
      apiMessage: resultado.message,
      destinoOfuscado: ofuscarNumero(digits),
      falloConsecutivos: factilizaWhatsAppHealth.falloConsecutivos
    }));
    if (factilizaWhatsAppHealth.falloConsecutivos >= FACTILIZA_DOWN_THRESHOLD) {
      await avisarPorEmailFactilizaCaida(`API responde ${resultado.status} ${resultado.message}`);
    }
    return { ok: false, status: resultado.status, message: resultado.message };
  } catch (err) {
    factilizaWhatsAppHealth.falloConsecutivos += 1;
    factilizaWhatsAppHealth.ultimoErrorTs = Date.now();
    factilizaWhatsAppHealth.ultimoErrorMsg = String(err.message || '').slice(0, 200);
    console.error('context:', JSON.stringify({
      level: 'error',
      message: 'alerta_whatsapp_send_error',
      err: err.message,
      destinoOfuscado: ofuscarNumero(digits),
      falloConsecutivos: factilizaWhatsAppHealth.falloConsecutivos
    }));
    if (factilizaWhatsAppHealth.falloConsecutivos >= FACTILIZA_DOWN_THRESHOLD) {
      await avisarPorEmailFactilizaCaida(`Error en send: ${err.message}`);
    }
    return { ok: false, error: err.message };
  }
}

/**
 * Envoltorio para llamadas fire-and-forget (`void seguridadAlertasService.notificarXxx(...)`).
 * Garantiza que cualquier rejection quede como log JSON estructurado en lugar de
 * romper el process en `unhandledRejection`.
 */
exports.runSafeAlert = function runSafeAlert(promiseOrFn, label) {
  let p;
  try {
    p = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
  } catch (errSync) {
    console.error('context:', JSON.stringify({
      level: 'error',
      message: 'alerta_safe_sync_error',
      label,
      err: errSync.message
    }));
    return;
  }
  if (!p || typeof p.then !== 'function') return;
  p.catch((err) => {
    console.error('context:', JSON.stringify({
      level: 'error',
      message: 'alerta_safe_async_error',
      label,
      err: err && err.message ? err.message : String(err)
    }));
  });
};

/** Estado actual del health-check Factiliza WhatsApp (para endpoint admin opcional). */
exports.obtenerEstadoFactilizaWhatsApp = function () {
  return {
    falloConsecutivos: factilizaWhatsAppHealth.falloConsecutivos,
    ultimoExitoTs: factilizaWhatsAppHealth.ultimoExitoTs,
    ultimoErrorTs: factilizaWhatsAppHealth.ultimoErrorTs,
    ultimoErrorMsg: factilizaWhatsAppHealth.ultimoErrorMsg
  };
};

/**
 * Tras intento fallido de login: aviso a empresa (3.er y 5.to) y a desarrollador (3 y 5).
 */
/**
 * Posible robo de refresh: reintento con token ya rotado. Aviso al desarrollador (throttle por empresa).
 */
exports.notificarRefreshTokenReplay = async (pool, params) => {
  const { idEmpresa, idUsuario, ipCliente } = params || {};
  if (!idEmpresa) return;
  const numeroDev = await obtenerNumeroDev(pool);
  if (numeroDev.length < 9) return;

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
    await enviarTextoPlataforma(pool, numeroDev, texto);
  } catch (err) {
    console.error('notificarRefreshTokenReplay:', err.message);
  }
};

/**
 * Tracker en memoria para detectar credential stuffing / email spraying:
 * por cada IP guarda los emails distintos que probo en una ventana de tiempo.
 * Con suficiente cantidad de emails distintos + total de intentos, dispara
 * alerta al desarrollador (con throttle por IP).
 */
const SPRAYING_VENTANA_MS = parseInt(process.env.SPRAYING_VENTANA_MS, 10) || 15 * 60 * 1000;
const SPRAYING_MIN_EMAILS = parseInt(process.env.SPRAYING_MIN_EMAILS, 10) || 5;
const SPRAYING_MIN_INTENTOS = parseInt(process.env.SPRAYING_MIN_INTENTOS, 10) || 10;
const SPRAYING_THROTTLE_MS = parseInt(process.env.SPRAYING_THROTTLE_MS, 10) || 30 * 60 * 1000;
const sprayingPorIp = new Map(); // ip -> { intentos, emails:Set, primerTs, ultimaAlertaTs }

function trackearIntentoFallidoIp(ipCliente, email) {
  const ip = String(ipCliente || '').trim();
  if (!ip) return null;
  const ahora = Date.now();
  let info = sprayingPorIp.get(ip);
  if (!info || ahora - info.primerTs > SPRAYING_VENTANA_MS) {
    info = { intentos: 0, emails: new Set(), primerTs: ahora, ultimaAlertaTs: 0 };
    sprayingPorIp.set(ip, info);
  }
  info.intentos += 1;
  if (email) info.emails.add(String(email).toLowerCase().slice(0, 120));
  if (info.intentos >= SPRAYING_MIN_INTENTOS
    && info.emails.size >= SPRAYING_MIN_EMAILS
    && ahora - info.ultimaAlertaTs > SPRAYING_THROTTLE_MS) {
    info.ultimaAlertaTs = ahora;
    return {
      intentos: info.intentos,
      emailsDistintos: info.emails.size,
      ventanaMs: ahora - info.primerTs
    };
  }
  return null;
}

const PATRON_SOSPECHOSO_REGEX = [
  /'[\s]*(or|and)[\s]+/i,            // ' OR / ' AND
  /--/,                                // SQL comment
  /;\s*drop\s+/i,                       // ; DROP
  /\bunion\s+select\b/i,                // UNION SELECT
  /<\s*script\b/i,                      // XSS
  /\bonerror\s*=/i,
  /\bonload\s*=/i,
  /\${[a-z]/i,                          // template literal injection
  /\bxp_cmdshell\b/i,
  /\bexec\s*\(/i,
  /%00/,                                 // null byte
  /\.\.\//,                             // path traversal
  /\\x[0-9a-f]{2}/i,
  /<%[=@]/                              // server-side tags
];

function pareceInyeccion(valor) {
  const s = String(valor || '');
  if (s.length === 0 || s.length > 500) return s.length > 500;
  return PATRON_SOSPECHOSO_REGEX.some((re) => re.test(s));
}

const ultimaAlertaInyeccionPorIp = new Map();
const INYECCION_THROTTLE_MS = parseInt(process.env.INYECCION_ALERT_THROTTLE_MS, 10) || 5 * 60 * 1000;

function deberiaAlertarInyeccion(ipCliente) {
  const ip = String(ipCliente || '').trim() || 'desconocida';
  const ahora = Date.now();
  const ult = ultimaAlertaInyeccionPorIp.get(ip) || 0;
  if (ahora - ult < INYECCION_THROTTLE_MS) return false;
  ultimaAlertaInyeccionPorIp.set(ip, ahora);
  return true;
}

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

  const numeroDev = await obtenerNumeroDev(pool);

  // 1) Tracker de spraying por IP (independiente del email/empresa)
  const spraying = trackearIntentoFallidoIp(ipCliente, email);
  if (spraying && numeroDev.length >= 9) {
    const txt = `[EFAF Login] POSIBLE EMAIL-SPRAYING / CREDENTIAL STUFFING
IP: ${String(ipCliente || '').slice(0, 45)}
Intentos en ventana: ${spraying.intentos}
Emails distintos probados: ${spraying.emailsDistintos}
Ventana: ${Math.round(spraying.ventanaMs / 1000)}s
Ultima empresa: ${ruc} ${razon}`;
    await enviarTextoPlataforma(pool, numeroDev, txt);
  }

  // 2) Patrones de inyeccion en el email (SQLi/XSS/path-traversal)
  if (numeroDev.length >= 9 && pareceInyeccion(email) && deberiaAlertarInyeccion(ipCliente)) {
    const txt = `[EFAF Seguridad] Patron sospechoso en login
IP: ${String(ipCliente || '').slice(0, 45)}
Email recibido: ${String(email || '').slice(0, 200)}
RUC objetivo: ${ruc}`;
    await enviarTextoPlataforma(pool, numeroDev, txt);
  }

  // 3) Reglas existentes: 3+ fallos consecutivos por (empresa, email) o lockout
  const alertaDev =
    intentosFallidos === 3 || intentosFallidos >= 5 || recienBloqueado;
  if (alertaDev && numeroDev.length >= 9) {
    const extra = recienBloqueado ? '\nEstado: CUENTA BLOQUEADA 30 min.' : '';
    await enviarTextoPlataforma(pool, numeroDev, base + extra);
  }

  if (celularEmpresa.length >= 9 && (intentosFallidos === 3 || recienBloqueado)) {
    const msgEmpresa = recienBloqueado
      ? `${base}\nSu acceso fue bloqueado temporalmente por seguridad. Espere 30 minutos o contacte soporte.`
      : `${base}\nAdvertencia de seguridad: si no fue usted, revise sus usuarios.`;
    await enviarTextoPlataforma(pool, celularEmpresa, msgEmpresa);
  }
};

/**
 * Detecta payloads sospechosos en cualquier campo del request body de login
 * (RUC, email o password). Llamar desde el controlador con req.body.
 * Si encuentra patron sospechoso, alerta al dev (con throttle) sin importar
 * si el RUC/email son validos. Crucial contra atacantes que prueban RUCs
 * inexistentes (los cuales NO entran a aplicarFalloLogin).
 */
exports.notificarPatronSospechosoEnLogin = async (pool, params) => {
  const { ipCliente, email, password, ruc } = params || {};
  const sospechosos = [];
  if (pareceInyeccion(email)) sospechosos.push(`email=${String(email).slice(0, 80)}`);
  if (pareceInyeccion(password)) sospechosos.push(`password=<patron>`); // nunca loguear el password real
  if (pareceInyeccion(ruc)) sospechosos.push(`ruc=${String(ruc).slice(0, 40)}`);
  if (!sospechosos.length) return;
  if (!deberiaAlertarInyeccion(ipCliente)) return;

  const numeroDev = await obtenerNumeroDev(pool);
  if (numeroDev.length < 9) return;

  const ip = String(ipCliente || '').slice(0, 45) || 'desconocida';
  const txt = `[EFAF Seguridad] Patron sospechoso en /admin_login
IP: ${ip}
Hallazgos: ${sospechosos.join(' | ')}`;
  await enviarTextoPlataforma(pool, numeroDev, txt);
};

/** Solo administrador de empresa: aviso al celular de Empresas. superAdmin usa notificarLoginSuperAdminExitoso. */
const ROLES_ADMIN_LOGIN_WHATSAPP = ['Administrador'];

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
 * Inicio de sesión con rol superAdmin: aviso al número del desarrollador
 * (parametroRuta de Factiliza WHATSAPP, override por ALERT_DEV_WHATSAPP).
 * Incluye usuario, empresa, RUC, correo e IP de origen.
 */
exports.notificarLoginSuperAdminExitoso = async (pool, params) => {
  const { idEmpresa, nombres, apellidos, email, ipCliente } = params || {};
  if (!idEmpresa) return;

  try {
    const numeroDev = await obtenerNumeroDev(pool);
    if (numeroDev.length < 9) return;

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

    await enviarTextoPlataforma(pool, numeroDev, texto);
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

  const numeroDev = await obtenerNumeroDev(pool);
  if (numeroDev.length < 9) return;
  const ctx = String(contexto || '').slice(0, 500);
  const texto = `[EFAF Sistema] Error interno\n${ctx}\nRevise logs del servidor.`;
  await enviarTextoPlataforma(pool, numeroDev, texto);
};

/**
 * Para middleware Express: path + mensaje breve.
 */
exports.notificarErrorSistemaDesdeRequest = async (pool, err, req) => {
  const path = req && req.originalUrl ? req.originalUrl : '';
  const msg = err && err.message ? err.message : String(err);
  await exports.notificarErrorSistema(pool, `${req?.method || ''} ${path}\n${msg.slice(0, 400)}`);
};

// =============================================================================
// Health-check periodico de Factiliza WhatsApp.
// Cada FACTILIZA_HEALTHCHECK_INTERVAL_MS (default 6h) intenta enviar un
// mensaje silencioso al destino configurado. Si la API falla repetidamente,
// avisarPorEmailFactilizaCaida ya esta en enviarTextoPlataforma (al pasar
// FACTILIZA_DOWN_THRESHOLD fallos). Aqui ademas garantizamos que se realiza
// el ping aunque no haya logins / fallos en el dia.
// =============================================================================
let intervaloHealthCheck = null;

/**
 * Inicia el health-check periodico que envia un ping a Factiliza WhatsApp.
 * Si los envios fallan FACTILIZA_DOWN_THRESHOLD veces consecutivas, el aviso
 * por email se dispara desde enviarTextoPlataforma.
 *
 * @param {{ withPool: function(function(pool):Promise):Promise }} deps
 */
exports.iniciarHealthCheckFactiliza = function iniciarHealthCheckFactiliza(deps) {
  if (intervaloHealthCheck) return;
  const withPool = deps && typeof deps.withPool === 'function' ? deps.withPool : null;
  if (!withPool) {
    console.error('context:', JSON.stringify({
      level: 'warn',
      message: 'factiliza_healthcheck_skip',
      detail: 'No se paso withPool a iniciarHealthCheckFactiliza.'
    }));
    return;
  }
  const interval = parseInt(process.env.FACTILIZA_HEALTHCHECK_INTERVAL_MS, 10) || 6 * 60 * 60 * 1000;
  if (interval <= 0) return;

  const ejecutarPing = async () => {
    try {
      const ahora = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const r = await withPool(async (pool) => {
        const destino = await obtenerNumeroDev(pool);
        if (destino.length < 9) {
          console.error('context:', JSON.stringify({
            level: 'info',
            message: 'factiliza_healthcheck_skip_run',
            detail: 'No se pudo resolver numero del dev (BD/.env vacios).'
          }));
          return { ok: false, skipped: true };
        }
        return enviarTextoPlataforma(pool, destino, `[EFAF Health] Ping Factiliza WhatsApp ${ahora}.`);
      });
      if (r && r.ok) {
        console.error('context:', JSON.stringify({
          level: 'info',
          message: 'factiliza_healthcheck_ok',
          ts: ahora
        }));
      }
    } catch (err) {
      console.error('context:', JSON.stringify({
        level: 'error',
        message: 'factiliza_healthcheck_error',
        err: err.message
      }));
    }
  };

  intervaloHealthCheck = setInterval(ejecutarPing, interval);
  if (intervaloHealthCheck && typeof intervaloHealthCheck.unref === 'function') {
    intervaloHealthCheck.unref();
  }
  console.error('context:', JSON.stringify({
    level: 'info',
    message: 'factiliza_healthcheck_started',
    intervalMs: interval
  }));
};

exports.detenerHealthCheckFactiliza = function () {
  if (intervaloHealthCheck) {
    clearInterval(intervaloHealthCheck);
    intervaloHealthCheck = null;
  }
};
