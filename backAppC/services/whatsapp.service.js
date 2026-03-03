const axios = require('axios');

/**
 * Servicio simple para envío de mensajes WhatsApp vía Twilio.
 * Si se pasa creds (por empresa), se usan; si no, variables de entorno:
 *  - TWILIO_ACCOUNT_SID / creds.accountSid
 *  - TWILIO_AUTH_TOKEN / creds.authToken
 *  - TWILIO_WHATSAPP_FROM / creds.whatsappFrom o creds.from
 * @param {object} [creds] - Opcional. { accountSid, authToken, whatsappFrom } desde EmpresaApiCredenciales.
 */
async function enviarCodigoVerificacionWhatsApp(telefonoDestino, codigo, idEmpresa, creds = {}) {
  const accountSid = creds.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = creds.authToken || process.env.TWILIO_AUTH_TOKEN;
  const from = creds.whatsappFrom || creds.from || process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    console.error('Twilio WhatsApp no configurado (credenciales por empresa o variables de entorno).');
    return;
  }

  // Normalizar número: el frontend debe enviar en formato internacional (+51...), aquí solo validamos no vacío.
  if (!telefonoDestino) {
    console.error('Número de WhatsApp destino vacío, no se envía código.');
    return;
  }

  const body = `Tu código de verificación para activar tu empresa es: ${codigo}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams();
  params.append('From', from);
  params.append('To', telefonoDestino.startsWith('whatsapp:') ? telefonoDestino : `whatsapp:${telefonoDestino}`);
  params.append('Body', body);

  try {
    await axios.post(url, params, {
      auth: {
        username: accountSid,
        password: authToken
      }
    });
  } catch (error) {
    console.error('Error enviando WhatsApp de verificación:', error?.response?.data || error.message);
  }
}

module.exports = {
  enviarCodigoVerificacionWhatsApp
};

