/**
 * Ubicación aproximada por IP (ciudad, región, país) vía API pública.
 * No sustituye GPS; útil para alertas de seguridad. Desactivar con GEOIP_LOGIN_LOOKUP=0 en .env.
 */
const https = require('https');

const LOOKUP_ENABLED = String(process.env.GEOIP_LOGIN_LOOKUP || '1').trim() !== '0';

/** IPv4 / IPv6 local o no enrutable: no se consulta API. */
function esIpPrivadaOLocal(ip) {
  if (ip == null || ip === '') return true;
  const s = String(ip).trim().toLowerCase();
  if (!s || s === 'unknown' || s === '::1') return true;
  if (s.startsWith('fe80:')) return true;
  if (s.startsWith('fc') || s.startsWith('fd')) return true; /* ULA IPv6 */
  if (s === '0.0.0.0') return true;

  if (s.startsWith('10.')) return true;
  if (s.startsWith('127.')) return true;
  if (s.startsWith('192.168.')) return true;
  const m = /^172\.(\d+)\./.exec(s);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

function normalizarIp(ip) {
  if (ip == null) return '';
  return String(ip)
    .trim()
    .replace(/^::ffff:/i, '')
    .slice(0, 45);
}

/**
 * @param {string|null|undefined} ipCliente
 * @param {number} [timeoutMs]
 * @returns {Promise<string|null>} Texto legible o null si no aplica / error
 */
function ubicacionAproximadaPorIp(ipCliente, timeoutMs = 2800) {
  if (!LOOKUP_ENABLED) return Promise.resolve(null);

  const ip = normalizarIp(ipCliente);
  if (!ip || esIpPrivadaOLocal(ip)) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(val);
    };

    const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
    const timer = setTimeout(() => {
      try {
        req.destroy();
      } catch (_e) {
        /* ignore */
      }
      done(null);
    }, timeoutMs);

    const req = https.get(
      url,
      {
        timeout: timeoutMs,
        headers: { Accept: 'application/json', 'User-Agent': 'EFAF-CRM-SecurityAlert/1.0' }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
          if (body.length > 8192) {
            req.destroy();
            done(null);
          }
        });
        res.on('end', () => {
          try {
            const j = JSON.parse(body);
            if (!j || j.success !== true) {
              done(null);
              return;
            }
            const parts = [j.city, j.region, j.country]
              .map((x) => (x != null ? String(x).trim() : ''))
              .filter((x) => x.length > 0);
            done(parts.length ? parts.join(', ').slice(0, 200) : null);
          } catch (_e) {
            done(null);
          }
        });
      }
    );

    req.on('error', () => done(null));
    req.on('timeout', () => {
      try {
        req.destroy();
      } catch (_e) {
        /* ignore */
      }
      done(null);
    });
  });
}

module.exports = {
  ubicacionAproximadaPorIp,
  esIpPrivadaOLocal,
  normalizarIp
};
