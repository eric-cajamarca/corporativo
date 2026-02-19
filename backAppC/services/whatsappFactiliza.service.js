/**
 * Servicio para enviar mensajes y archivos vía API WhatsApp de Factiliza.
 * config: { urlApi, tokenDefault, parametroRuta } desde FactilizaConfig (nombre = 'Factiliza WHATSAPP').
 */

const NOMBRE_INSTANCIA_REQUERIDO = 'Factiliza WHATSAPP requiere parametroRuta (nombre-instancia) configurado';

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
  const url = `${baseUrl}/message/sendtext/${encodeURIComponent(nombreInstancia)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.tokenDefault}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ number: String(number).trim(), text: String(text).trim() })
  });
  const data = await response.json().catch(() => ({}));
  return {
    status: data.status != null ? data.status : response.status,
    success: data.success === true,
    message: data.message != null ? String(data.message) : (response.ok ? 'OK' : 'Error en API WhatsApp')
  };
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
  const url = `${baseUrl}/message/sendmedia/${encodeURIComponent(nombreInstancia)}`;
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
