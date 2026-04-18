const sql = require('mssql');
const dbConfig = require('../dbconfig');
const { isSaas } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');

function fullPath(req) {
  return (req.originalUrl || '').split('?')[0];
}

function isWhitelistedPublic(pathname, method) {
  if (pathname.startsWith('/api/public')) return true;
  if (pathname.startsWith('/api/webhooks')) return true;
  if (pathname.startsWith('/api/activacion')) return true;
  if (pathname.startsWith('/api/external')) return true;
  if (pathname === '/api/database') return true;
  if (method === 'GET' && pathname.startsWith('/api/obtener_logo')) return true;
  if (pathname.startsWith('/api/empresa/verificar')) return true;
  if (pathname.startsWith('/api/empresa/enviar-codigo-activacion')) return true;
  if (pathname === '/api/empresa' && method === 'POST') return true;
  if (pathname === '/api/direccion_empresa' && method === 'POST') return true;
  if (pathname.startsWith('/api/getEmpresa_login')) return true;
  if (pathname.startsWith('/api/admin_login')) return true;
  if (pathname.startsWith('/api/admin_2fa')) return true;
  if (pathname.startsWith('/api/refresh_session')) return true;
  if (pathname.startsWith('/api/recuperar-password')) return true;
  if (pathname.startsWith('/api/restablecer-password')) return true;
  if (pathname.startsWith('/api/logout')) return true;
  if (pathname.startsWith('/api/suscripcion/vincular-checkout')) return true;
  if (pathname.startsWith('/api/suscripcion/mi-estado')) return true;
  if (pathname.startsWith('/api/suscripcion/crear-pago')) return true;
  if (pathname.startsWith('/api/suscripcion/solicitar-upgrade')) return true;
  return false;
}

function permiteEscrituraSegunSuscripcion(sub) {
  if (!sub) return false;
  if (sub.estado === 'ENTERPRISE') return true;
  if (sub.estado === 'ACTIVA') return true;
  if (sub.estado === 'DEMO') {
    if (!sub.fechaFin) return true;
    return new Date(sub.fechaFin) > new Date();
  }
  return false;
}

/**
 * En modo SaaS restringe POST/PUT/PATCH/DELETE si la empresa no tiene suscripción activa.
 * Modo Enterprise: no hace nada.
 */
exports.saasSuscripcionGate = async function saasSuscripcionGate(req, res, next) {
  if (!isSaas()) {
    return next();
  }

  const pathname = fullPath(req);
  const method = (req.method || 'GET').toUpperCase();

  if (isWhitelistedPublic(pathname, method)) {
    return next();
  }

  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (!mutating) {
    return next();
  }

  const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
  if (!idEmpresa) {
    return next();
  }

  try {
    const pool = await sql.connect(dbConfig);
    const sub = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
    if (permiteEscrituraSegunSuscripcion(sub)) {
      return next();
    }
    return res.status(402).json({
      code: 'SUBSCRIPTION_REQUIRED',
      message:
        'Su plan requiere completar el pago o renovar la suscripción para registrar operaciones. Puede navegar en modo lectura o ir a Planes.'
    });
  } catch (error) {
    console.error('saasSuscripcionGate:', error);
    return next();
  }
};
