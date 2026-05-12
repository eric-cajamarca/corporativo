/**
 * Servicio de envío de correos (recuperación de contraseña, notificaciones).
 * Variables: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM (opcional).
 * Gmail (puerto 587): SMTP_SECURE=false; use contraseña de aplicación en SMTP_PASS.
 */
const dns = require('dns');
const nodemailer = require('nodemailer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';
/**
 * En algunos equipos (p. ej. Windows) la resolución IPv4 se omite si Node no detecta
 * interfaces IPv4 “válidas”; nodemailer entonces solo intenta IPv6 y puede dar timeout.
 * SMTP_IPV4=true activa allowInternalNetworkInterfaces y prioriza orden DNS IPv4.
 */
const SMTP_IPV4 =
  process.env.SMTP_IPV4 === '1' || process.env.SMTP_IPV4 === 'true';

if (SMTP_IPV4 && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

/** Quita espacios y comillas envolventes típicas de .env */
function trimEnv(val) {
  if (val == null) return '';
  let s = String(val).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const SMTP_HOST = trimEnv(process.env.SMTP_HOST);
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = trimEnv(process.env.SMTP_USER);
const SMTP_PASS = trimEnv(process.env.SMTP_PASS);
const SMTP_FROM_RAW = trimEnv(process.env.SMTP_FROM);

let cachedTransport = null;

function isSmtpConfigured() {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

/**
 * Transport reutilizable (pool ligero) compatible con Gmail STARTTLS en 587.
 */
function getTransport() {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP no configurado: defina SMTP_HOST, SMTP_USER y SMTP_PASS en .env');
  }
  if (!cachedTransport) {
    const options = {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      pool: true,
      maxConnections: 2,
      maxMessages: 30
    };
    if (SMTP_IPV4) {
      options.allowInternalNetworkInterfaces = true;
    }
    if (!SMTP_SECURE && SMTP_PORT === 587) {
      options.requireTLS = true;
    }
    cachedTransport = nodemailer.createTransport(options);
  }
  return cachedTransport;
}

function resolveFrom() {
  return SMTP_FROM_RAW || SMTP_USER;
}

/**
 * Cierra el pool (p. ej. tests o reinicio); en producción normalmente no hace falta.
 */
exports.cerrarTransport = async () => {
  if (cachedTransport && typeof cachedTransport.close === 'function') {
    try {
      await cachedTransport.close();
    } catch (e) {
      console.error('email.service cerrarTransport:', e);
    }
    cachedTransport = null;
  }
};

exports.isSmtpConfigured = isSmtpConfigured;
exports.getFrontendUrl = () => FRONTEND_URL;

/**
 * Envía el correo con el enlace de recuperación de contraseña.
 * Si SMTP no está configurado y NODE_ENV=development, solo registra el enlace.
 */
exports.enviarLinkRecuperacion = async (to, recoveryLink, tipo) => {
  const tieneSmtp = isSmtpConfigured();

  if (!tieneSmtp) {
    if (process.env.NODE_ENV === 'development') {
      console.error(
        '[DEV] SMTP no configurado. Enlace de recuperación (copiar en navegador):',
        recoveryLink
      );
      return;
    }
    throw new Error('SMTP no configurado: defina SMTP_HOST, SMTP_USER y SMTP_PASS en .env');
  }

  const transporter = getTransport();
  const esEmpresa = tipo === 'empresa';
  const asunto =
    'Recuperación de contraseña - ' +
    (esEmpresa ? 'Cuenta de empresa' : 'Cuenta de colaborador');
  const texto = esEmpresa
    ? `Ha solicitado restablecer la contraseña de la cuenta de empresa. Abra el siguiente enlace para establecer una nueva contraseña (válido 15 minutos):\n\n${recoveryLink}\n\nSi no solicitó este correo, ignore este mensaje.`
    : `Ha solicitado restablecer la contraseña de su cuenta de colaborador. Abra el siguiente enlace para establecer una nueva contraseña (válido 15 minutos):\n\n${recoveryLink}\n\nSi no solicitó este correo, ignore este mensaje.`;

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #333;">Recuperación de contraseña</h2>
      <p>Ha solicitado restablecer la contraseña de su ${esEmpresa ? 'cuenta de empresa' : 'cuenta de colaborador'}.</p>
      <p>Haga clic en el enlace siguiente para establecer una nueva contraseña. El enlace es válido durante <strong>15 minutos</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${recoveryLink}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px;">Restablecer contraseña</a>
      </p>
      <p style="color: #666; font-size: 14px;">Si no solicitó este correo, ignore este mensaje.</p>
      <p style="color: #999; font-size: 12px; word-break: break-all;">Enlace directo: ${recoveryLink}</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: resolveFrom(),
      to,
      subject: asunto,
      text: texto,
      html
    });
  } catch (err) {
    console.error('email.service enviarLinkRecuperacion:', err);
    throw new Error('ERROR_ENVIO_CORREO');
  }
};

/**
 * Correo operativo genérico (onboarding, recordatorios, etc.).
 */
exports.enviarNotificacionOperativa = async ({ to, subject, text, html }) => {
  const tieneSmtp = isSmtpConfigured();
  if (!to || !subject) return;

  if (!tieneSmtp) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[DEV] SMTP no configurado. Notificación operativa:', {
        to,
        subject,
        text
      });
      return;
    }
    throw new Error('SMTP no configurado: defina SMTP_HOST, SMTP_USER y SMTP_PASS en .env');
  }

  const transporter = getTransport();
  try {
    await transporter.sendMail({
      from: resolveFrom(),
      to,
      subject,
      text: text || '',
      html: html || `<p>${String(text || '').replace(/\n/g, '<br>')}</p>`
    });
  } catch (err) {
    console.error('email.service enviarNotificacionOperativa:', err);
    throw new Error('ERROR_ENVIO_CORREO');
  }
};
