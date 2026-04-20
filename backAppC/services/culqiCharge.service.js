const axios = require('axios');

const CULQI_API = 'https://api.culqi.com/v2';

/**
 * Indica si Culqi considera el cargo como pagado / aprobado.
 * @param {object} data Cuerpo JSON de la respuesta de Culqi.
 */
function cargoCulqiPagado(data) {
  if (!data || !data.id) return false;
  if (data.paid === true || data.state === 'paid') return true;
  const tipo = data.outcome?.type;
  return tipo === 'venta_exitosa';
}

/**
 * Crea un cargo en Culqi con el token de la tarjeta (frontend Culqi Checkout).
 * @param {object} params
 * @param {string} params.secretKey
 * @param {number} params.amountCentimos
 * @param {string} params.email
 * @param {string} params.tokenId
 * @param {object} [params.metadata]
 * @param {object} [params.antifraudDetails] p. ej. { device_finger_print_id, first_name, last_name, phone_number }
 * @param {object} [params.authentication3DS] resultado Culqi3DS (postMessage parameters3DS) — segundo POST /charges
 */
async function crearCargo({ secretKey, amountCentimos, email, tokenId, metadata, antifraudDetails, authentication3DS }) {
  if (!secretKey) throw new Error('CULQI_SECRET_FALTANTE');
  const body = {
    amount: amountCentimos,
    currency_code: 'PEN',
    email: email || 'cliente@empresa.local',
    source_id: tokenId,
    metadata: metadata || {}
  };
  if (antifraudDetails && typeof antifraudDetails === 'object' && Object.keys(antifraudDetails).length > 0) {
    body.antifraud_details = antifraudDetails;
  }
  if (authentication3DS && typeof authentication3DS === 'object' && !Array.isArray(authentication3DS)) {
    body.authentication_3DS = authentication3DS;
  }

  const res = await axios.post(`${CULQI_API}/charges`, body, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    validateStatus: () => true
  });

  const data = res.data;

  // Culqi puede responder 200 o 201 según versión / flujo; el criterio fiable es el objeto del cargo.
  if (cargoCulqiPagado(data) && (res.status === 200 || res.status === 201)) {
    return { ok: true, data };
  }

  // Flujo oficial Culqi3DS: primer cargo HTTP 200, objeto charge, action_code REVIEW (demo culqi-php-demo-jsv4-culqi3ds).
  const actionCode = String(data?.action_code || '').toUpperCase();
  if (
    res.status === 200 &&
    data?.object === 'charge' &&
    actionCode === 'REVIEW' &&
    data?.id &&
    !cargoCulqiPagado(data)
  ) {
    return {
      ok: false,
      code: 'REQUIERE_3DS',
      actionCode: data.action_code,
      message:
        data?.user_message ||
        data?.merchant_message ||
        'Culqi requiere completar 3D Secure (Culqi3DS.initAuthentication y segundo cargo con authentication_3DS).',
      raw: data
    };
  }

  const partesMensaje = [
    data?.merchant_message,
    data?.user_message,
    data?.decline_code,
    data?.code,
    typeof data?.object === 'string' ? data.object : ''
  ];
  if (Array.isArray(data?.errors)) {
    for (const e of data.errors) {
      partesMensaje.push(e?.merchant_message, e?.user_message, e?.message);
    }
  }
  const msgText = partesMensaje.filter(Boolean).join(' ').toLowerCase();
  const pideAutenticacion =
    msgText.includes('autentic') ||
    msgText.includes('3ds') ||
    (data?.outcome?.type && String(data.outcome.type).toLowerCase().includes('autentic'));

  // Tarjetas de prueba 44565300… (tabla “3DS” de Culqi) suelen responder sin id de cargo o con cargo no pagado;
  // antes solo detectábamos 3DS si venía data.id, y el mensaje caía como error genérico.
  if (!cargoCulqiPagado(data) && pideAutenticacion) {
    return {
      ok: false,
      code: 'REQUIERE_3DS',
      actionCode: data?.action_code || null,
      message:
        data?.user_message ||
        data?.merchant_message ||
        'Culqi requiere autenticación del titular (3DS). Use una tarjeta de prueba sin 3DS o integre Culqi3DS (device + segundo cargo con authentication_3DS).',
      raw: data
    };
  }

  const errMsg =
    data?.merchant_message ||
    data?.user_message ||
    data?.object ||
    (typeof data === 'string' ? data : JSON.stringify(data || {}));

  return { ok: false, status: res.status, message: errMsg, raw: data };
}

module.exports = {
  crearCargo,
  cargoCulqiPagado
};
