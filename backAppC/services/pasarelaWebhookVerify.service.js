const crypto = require('crypto');
const { withPool } = require('../utils/dbPool.util');
const integracionesService = require('./integraciones.service');
const suscripcionRepository = require('../repositories/suscripcion.repository');
const culqiChargeService = require('./culqiCharge.service');
const { timingSafeEqualString, timingSafeEqualHex } = require('../utils/cryptoSecure.util');

function skipVerifyEnDev() {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.WEBHOOK_SKIP_SIGNATURE_VERIFY === 'true'
  );
}

function secretEsperado(proveedor) {
  const global = process.env.PASARELA_WEBHOOK_SECRET || '';
  if (proveedor === 'culqi') {
    return process.env.CULQI_WEBHOOK_SECRET || global;
  }
  if (proveedor === 'izipay') {
    return process.env.IZIPAY_WEBHOOK_SECRET || global;
  }
  return global;
}

function secretRecibido(req) {
  const header =
    req.get('X-Pasarela-Webhook-Secret') ||
    req.get('X-Webhook-Secret') ||
    '';
  if (header) return header;
  const auth = req.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  if (req.query && req.query.webhook_secret) {
    return String(req.query.webhook_secret);
  }
  return '';
}

function verificarSecretCompartido(req, proveedor) {
  const expected = secretEsperado(proveedor);
  if (!expected) return false;
  const got = secretRecibido(req);
  return got && timingSafeEqualString(got, expected);
}

function verificarHmacRawBody(req, secret) {
  if (!secret || !req.rawBody) return false;
  const sigHeader =
    req.get('X-Webhook-Signature') ||
    req.get('X-Izipay-Signature') ||
    req.get('X-Hmac-Signature') ||
    '';
  if (!sigHeader) return false;
  const provided = sigHeader.replace(/^sha256=/i, '').trim();
  const calculated = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  return timingSafeEqualHex(calculated, provided);
}

function checkHashIzipayKrAnswer(krAnswer, krHash, secretKey) {
  if (!krAnswer || !krHash || !secretKey) return false;
  const normalized = String(krAnswer).replace(/\\\//g, '/');
  const calculated = crypto.createHmac('sha256', secretKey).update(normalized).digest('hex');
  return timingSafeEqualHex(calculated, krHash);
}

async function obtenerCredencialesPrincipal(proveedor) {
  return withPool(async (pool) => {
    const idEmpresaPrincipal = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
    if (!idEmpresaPrincipal) return null;
    return integracionesService.obtenerCredencialesProveedor(pool, idEmpresaPrincipal, proveedor);
  });
}

function extraerOrderNumberCulqi(event) {
  const obj = event?.data?.object ? event.data.object : event || {};
  return (
    obj.order_number ||
    obj.orderNumber ||
    (obj.metadata && (obj.metadata.order_number || obj.metadata.orderNumber)) ||
    null
  );
}

function eventoCulqiIndicaPagado(event) {
  const tipo = (event?.type || event?.data?.object?.status || '').toString().toLowerCase();
  return tipo.includes('paid') || tipo.includes('succeeded') || tipo.includes('success');
}

/**
 * Culqi no documenta HMAC en webhooks: validamos cargo real vía API con secretKey de la empresa principal.
 */
async function verificarCulqi(req) {
  if (verificarSecretCompartido(req, 'culqi')) return true;
  if (verificarHmacRawBody(req, secretEsperado('culqi'))) return true;

  const event = req.body || {};
  const obj = event.data?.object ? event.data.object : event;
  const chargeId = obj?.id || obj?.charge_id || event?.id;
  if (!chargeId || typeof chargeId !== 'string') {
    return false;
  }

  const credenciales = await obtenerCredencialesPrincipal('culqi');
  const secretKey = credenciales?.secretKey || credenciales?.secret_key;
  if (!secretKey) {
    return false;
  }

  const cargo = await culqiChargeService.obtenerCargo(secretKey, chargeId);
  if (!cargo || !cargo.id) {
    return false;
  }

  const orderNumberPayload = extraerOrderNumberCulqi(event);
  const orderEnCargo =
    cargo.metadata?.order_number ||
    cargo.metadata?.orderNumber ||
    cargo.order_number ||
    cargo.orderNumber;

  if (orderNumberPayload && orderEnCargo && orderNumberPayload !== orderEnCargo) {
    return false;
  }

  if (eventoCulqiIndicaPagado(event)) {
    return culqiChargeService.cargoCulqiPagado(cargo);
  }

  return true;
}

/**
 * Izipay IPN: HMAC-SHA256 de kr-answer con secretKey (PASSWORD) o hmacSha256 de credenciales.
 */
async function verificarIzipay(req) {
  if (verificarSecretCompartido(req, 'izipay')) return true;

  const body = req.body || {};
  const krAnswer = body['kr-answer'];
  const krHash = body['kr-hash'] || body.hash;

  if (krAnswer && krHash) {
    const credenciales = await obtenerCredencialesPrincipal('izipay');
    const ipnKey =
      credenciales?.secretKey ||
      credenciales?.password ||
      credenciales?.PASSWORD ||
      process.env.IZIPAY_WEBHOOK_SECRET ||
      process.env.PASARELA_WEBHOOK_SECRET;
    if (ipnKey && checkHashIzipayKrAnswer(krAnswer, krHash, ipnKey)) {
      return true;
    }
    const hmacKey = credenciales?.hmacSha256 || credenciales?.HMACSHA256;
    if (hmacKey && checkHashIzipayKrAnswer(krAnswer, krHash, hmacKey)) {
      return true;
    }
    return false;
  }

  const credenciales = await obtenerCredencialesPrincipal('izipay');
  const hmacKey =
    credenciales?.hmacSha256 ||
    credenciales?.HMACSHA256 ||
    credenciales?.secretKey ||
    secretEsperado('izipay');
  return verificarHmacRawBody(req, hmacKey);
}

async function verificar(req, proveedor) {
  if (skipVerifyEnDev()) {
    return true;
  }

  const p = (proveedor || '').toLowerCase();
  if (p === 'culqi') {
    return verificarCulqi(req);
  }
  if (p === 'izipay') {
    return verificarIzipay(req);
  }
  return false;
}

module.exports = {
  verificar,
  checkHashIzipayKrAnswer,
  verificarSecretCompartido
};
