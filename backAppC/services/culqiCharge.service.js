const axios = require('axios');

const CULQI_API = 'https://api.culqi.com/v2';

/**
 * Crea un cargo en Culqi con el token de la tarjeta (frontend Culqi.js).
 */
async function crearCargo({ secretKey, amountCentimos, email, tokenId, metadata }) {
  if (!secretKey) throw new Error('CULQI_SECRET_FALTANTE');
  const body = {
    amount: amountCentimos,
    currency_code: 'PEN',
    email: email || 'cliente@empresa.local',
    source_id: tokenId,
    metadata: metadata || {}
  };
  const res = await axios.post(`${CULQI_API}/charges`, body, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    validateStatus: () => true
  });
  const data = res.data;
  const okCharge =
    res.status === 201 &&
    data &&
    data.id &&
    (data.outcome?.type === 'venta_exitosa' || data.state === 'paid' || data.paid === true);
  if (okCharge) {
    return { ok: true, data };
  }
  const errMsg =
    data?.merchant_message ||
    data?.user_message ||
    data?.object ||
    (typeof data === 'string' ? data : JSON.stringify(data || {}));
  return { ok: false, status: res.status, message: errMsg, raw: data };
}

module.exports = {
  crearCargo
};
