const axios = require('axios');

/**
 * Servicio simple para envío de mensajes WhatsApp vía Twilio.
 * Si se pasa creds (por empresa), se usan; si no, variables de entorno:
 *  - TWILIO_ACCOUNT_SID / creds.accountSid
 *  - TWILIO_AUTH_TOKEN / creds.authToken
 *  - TWILIO_WHATSAPP_FROM / creds.whatsappFrom o creds.from
 * @param {object} [creds] - Opcional. { accountSid, authToken, whatsappFrom } desde EmpresaApiCredenciales. Para activación sin sesión usar {} para usar solo env.
 * @returns {{ sent: boolean, error?: string }}
 */
async function enviarCodigoVerificacionWhatsApp(telefonoDestino, codigo, idEmpresa, creds = {}) {
  const accountSid = creds.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = creds.authToken || process.env.TWILIO_AUTH_TOKEN;
  const from = creds.whatsappFrom || creds.from || process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    console.error('Twilio WhatsApp no configurado (credenciales por empresa o variables de entorno TWILIO_*).');
    return { sent: false, error: 'WhatsApp no configurado. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_FROM.' };
  }

  if (!telefonoDestino || !String(telefonoDestino).trim()) {
    console.error('Número de WhatsApp destino vacío, no se envía código.');
    return { sent: false, error: 'Número de WhatsApp destino vacío.' };
  }

  const body = `Tu código de verificación para activar tu empresa es: ${codigo}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams();
  params.append('From', from);
  params.append('To', telefonoDestino.startsWith('whatsapp:') ? telefonoDestino : `whatsapp:${telefonoDestino}`);
  params.append('Body', body);

  try {
    await axios.post(url, params, {
      auth: { username: accountSid, password: authToken }
    });
    return { sent: true };
  } catch (error) {
    const msg = error?.response?.data?.message || error.message;
    console.error('Error enviando WhatsApp de verificación:', error?.response?.data || error.message);
    return { sent: false, error: msg || 'Error al enviar por WhatsApp.' };
  }
}

module.exports = {
  enviarCodigoVerificacionWhatsApp
};

