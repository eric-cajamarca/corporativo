/**
 * Servicio de envío de correos (recuperación de contraseña, etc.).
 * Requiere variables de entorno SMTP_* para producción.
 * Ver .env.example o documentación para configuración.
 */
const nodemailer = require('nodemailer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

function getTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP no configurado: defina SMTP_HOST, SMTP_USER y SMTP_PASS en .env');
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

/**
 * Envía el correo con el enlace de recuperación de contraseña.
 * Si SMTP no está configurado y NODE_ENV=development, solo registra el enlace en consola.
 * @param {string} to - Correo del destinatario (empresa o colaborador)
 * @param {string} recoveryLink - URL completa con token (ej. https://.../recuperar-password?token=xxx)
 * @param {'empresa'|'colaborador'} tipo - Para personalizar el mensaje
 */
exports.enviarLinkRecuperacion = async (to, recoveryLink, tipo) => {
  const tieneSmtp = SMTP_HOST && SMTP_USER && SMTP_PASS;

  if (!tieneSmtp) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[DEV] SMTP no configurado. Enlace de recuperación (copiar en navegador):', recoveryLink);
      return;
    }
    throw new Error('SMTP no configurado: defina SMTP_HOST, SMTP_USER y SMTP_PASS en .env');
  }

  const transporter = getTransport();
  const esEmpresa = tipo === 'empresa';
  const asunto = 'Recuperación de contraseña - ' + (esEmpresa ? 'Cuenta de empresa' : 'Cuenta de colaborador');
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
      <p style="color: #999; font-size: 12px;">Enlace directo: ${recoveryLink}</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || SMTP_USER,
    to,
    subject: asunto,
    text: texto,
    html
  });
};
