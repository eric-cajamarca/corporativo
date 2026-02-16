/**
 * Cifrado/descifrado de la clave del certificado tributario para no almacenarla en claro.
 * Usa AES-256-GCM. La clave de cifrado se obtiene de CERT_ENCRYPTION_KEY (en producción definir en env).
 */

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX_ENCRYPTED = "enc:";

function getEncryptionKey() {
  const secret = process.env.CERT_ENCRYPTION_KEY || "clave-certificado-default-cambiar-en-produccion";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Cifra un texto (ej. clave del certificado). El resultado incluye prefijo "enc:" para detectar cifrado.
 * @param {string} texto - Texto en claro
 * @returns {string|null} "enc:" + base64(iv + ciphertext + authTag) o null si texto vacío
 */
function cifrar(texto) {
  if (texto == null || String(texto).trim() === "") return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(String(texto), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, enc, tag]);
  return PREFIX_ENCRYPTED + combined.toString("base64");
}

/**
 * Descifra un valor previamente cifrado con cifrar(). Si no está cifrado (sin prefijo "enc:"), devuelve el valor original.
 * @param {string} valor - Valor guardado (cifrado con "enc:" o en claro)
 * @returns {string|null} Texto en claro o null
 */
function descifrar(valor) {
  if (valor == null || String(valor).trim() === "") return null;
  const str = String(valor).trim();
  if (!str.startsWith(PREFIX_ENCRYPTED)) return str;
  try {
    const base64 = str.slice(PREFIX_ENCRYPTED.length);
    const combined = Buffer.from(base64, "base64");
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) return str;
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  } catch (err) {
    console.error("cifradoClaveCertificado.descifrar:", err.message);
    return str;
  }
}

module.exports = {
  cifrar,
  descifrar,
  PREFIX_ENCRYPTED
};
