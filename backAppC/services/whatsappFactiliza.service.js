/**
 * Servicio para enviar mensajes y archivos vía API WhatsApp de Factiliza.
 * config: { urlApi, tokenDefault, parametroRuta } desde FactilizaConfig (nombre = 'Factiliza WHATSAPP').
 * Documentación: https://docs.factiliza.com/api-whatsapp/endpoint/send-text
 */

const axios = require('axios');
const NOMBRE_INSTANCIA_REQUERIDO = 'Factiliza WHATSAPP requiere parametroRuta (nombre-instancia) configurado';
const CONNECT_TIMEOUT_MS = 30000; // 30s para conexión lenta a apiwsp.factiliza.com

/**
 * Envía mensaje de texto.
 * @param {object} config - { urlApi, tokenDefault, parametroRuta }
 * @param {string} number - Número destino (código país + número, ej. 51999999999)
 * @param {string} text - Texto del mensaje
 * @returns {Promise<{ status: number, success: boolean, message: string }>}
 */
async function sendText(config, number, text) {
  if (!number || String(number).trim() === '') {
    throw new Error('El número de destino es requerido');
  }
  if (!text || String(text).trim() === '') {
    throw new Error('El texto del mensaje es requerido');
  }
  if (!config || !config.tokenDefault) {
    throw new Error('No hay token configurado para Factiliza WHATSAPP');
  }
  const nombreInstancia = config.parametroRuta != null ? String(config.parametroRuta).trim() : '';
  if (!nombreInstancia) {
    throw new Error(NOMBRE_INSTANCIA_REQUERIDO);
  }
  const baseUrl = (config.urlApi || 'https://apiwsp.factiliza.com/v1').replace(/\/$/, '');
  // parametroRuta va tal cual (ej. NTE5OTMyODk0NDA=); no usar encodeURIComponent para no convertir = en %3D
  const url = `${baseUrl}/message/sendtext/${nombreInstancia}`;
  const body = { number: String(number).trim(), text: String(text).trim() };
  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${config.tokenDefault}`,
        'Content-Type': 'application/json'
      },
      timeout: CONNECT_TIMEOUT_MS,
      validateStatus: () => true
    });
    const data = response.data || {};
    return {
      status: data.status != null ? data.status : response.status,
      success: data.success === true,
      message: data.message != null ? String(data.message) : (response.status >= 200 && response.status < 300 ? 'OK' : 'Error en API WhatsApp')
    };
  } catch (err) {
    const errData = { message: err?.message, code: err?.code, cause: err?.cause?.message || err?.cause?.code, url };
    console.error('whatsappFactiliza sendText failed:', errData);
    throw err;
  }
}

/**
 * Envía archivo (documento, imagen, etc.).
 * @param {object} config - { urlApi, tokenDefault, parametroRuta }
 * @param {string} number - Número destino (código país + número)
 * @param {string} mediatype - 'image' | 'document' | 'video' | 'audio'
 * @param {string} media - URL o base64 del archivo
 * @param {string} [filename] - Nombre del archivo con extensión (recomendado para base64)
 * @param {string} [caption] - Texto opcional que acompaña el archivo
 * @returns {Promise<{ status: number, success: boolean, message: string }>}
 */
async function sendMedia(config, number, mediatype, media, filename, caption) {
  if (!number || String(number).trim() === '') {
    throw new Error('El número de destino es requerido');
  }
  if (!media || String(media).trim() === '') {
    throw new Error('El contenido del archivo (media) es requerido');
  }
  const mt = String(mediatype || 'document').toLowerCase();
  if (!['image', 'document', 'video', 'audio'].includes(mt)) {
    throw new Error('mediatype debe ser image, document, video o audio');
  }
  if (!config || !config.tokenDefault) {
    throw new Error('No hay token configurado para Factiliza WHATSAPP');
  }
  const nombreInstancia = config.parametroRuta != null ? String(config.parametroRuta).trim() : '';
  if (!nombreInstancia) {
    throw new Error(NOMBRE_INSTANCIA_REQUERIDO);
  }
  const baseUrl = (config.urlApi || 'https://apiwsp.factiliza.com/v1').replace(/\/$/, '');
  const url = `${baseUrl}/message/sendmedia/${nombreInstancia}`;
  const body = {
    number: String(number).trim(),
    mediatype: mt,
    media: String(media).trim()
  };
  if (filename != null && String(filename).trim() !== '') body.filename = String(filename).trim();
  if (caption != null && String(caption).trim() !== '') body.caption = String(caption).trim();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.tokenDefault}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return {
    status: data.status != null ? data.status : response.status,
    success: data.success === true,
    message: data.message != null ? String(data.message) : (response.ok ? 'OK' : 'Error en API WhatsApp')
  };
}

module.exports = {
  sendText,
  sendMedia
};
