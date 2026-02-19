/**
 * Proxy a APIs externas para DNI/RUC.
 * - Primera opción: Factiliza (FACTILIZA_TOKEN, servicio de pago) = Servicio 1.
 * - Fallback: ApisPeru (APISPERU_TOKEN) = Servicio 2.
 *
 * Respuesta unificada: { _source: 'factiliza'|'apisperu', data: { ... campos normalizados } }
 */
const axios = require('axios');

const FACTILIZA_BASE = 'https://api.factiliza.com/v1';
const APISPERU_BASE = 'https://dniruc.apisperu.com/api/v1';
const FACTILIZA_TIMEOUT_MS = 5000;
const APISPERU_TIMEOUT_MS = 8000;

function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function normalizeDni(raw) {
  const o = raw && (raw.data !== undefined ? raw.data : raw) || {};
  const nombres = pick(o, 'nombres', 'Nombres');
  const apellidoPaterno = pick(o, 'apellidoPaterno', 'apellido_paterno', 'ApellidoPaterno', 'paterno');
  const apellidoMaterno = pick(o, 'apellidoMaterno', 'apellido_materno', 'ApellidoMaterno', 'materno');
  const nombreCompleto = pick(o, 'nombre_completo', 'nombreCompleto');
  return {
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    nombreCompleto
  };
}

function normalizeCee(raw) {
  const o = raw && (raw.data !== undefined ? raw.data : raw) || {};
  const nombres = pick(o, 'nombres', 'Nombres');
  const apellidoPaterno = pick(o, 'apellidoPaterno', 'apellido_paterno', 'ApellidoPaterno', 'paterno');
  const apellidoMaterno = pick(o, 'apellidoMaterno', 'apellido_materno', 'ApellidoMaterno', 'materno');
  const nombreCompleto = pick(o, 'nombre_completo', 'nombreCompleto');
  return {
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    nombreCompleto,
    numero: pick(o, 'numero', 'numeroCee')
  };
}

function normalizeRuc(raw) {
  const o = raw && (raw.data !== undefined ? raw.data : raw) || {};
  const razonSocial = pick(o, 'razonSocial', 'RazonSocial', 'nombre_o_razon_social', 'razon_social', 'nombre', 'nombreComercial');
  const ubigeoRaw = pick(o, 'ubigeo', 'Ubigeo', 'ubigeo_sunat');
  const ubigeo = Array.isArray(ubigeoRaw) ? (ubigeoRaw[ubigeoRaw.length - 1] || ubigeoRaw[0]) : ubigeoRaw;
  return {
    razonSocial,
    estado: pick(o, 'estado', 'Estado', 'condicion', 'Condicion') || 'ACTIVO',
    ubigeo: ubigeo || undefined,
    direccion: pick(o, 'direccion', 'Direccion', 'domicilioFiscal', 'direccion_completa'),
    departamento: pick(o, 'departamento', 'Departamento'),
    provincia: pick(o, 'provincia', 'Provincia'),
    distrito: pick(o, 'distrito', 'Distrito')
  };
}

async function tryFactiliza(path) {
  const token = process.env.FACTILIZA_TOKEN;
  if (!token) {
    return { ok: false, reason: 'FACTILIZA_TOKEN_not_configured' };
  }
  try {
    const response = await axios.get(`${FACTILIZA_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: FACTILIZA_TIMEOUT_MS,
      validateStatus: () => true
    });
    const data = response.data;
    const inner = data && (data.data ?? data);
    const hasData = inner && (Array.isArray(inner) ? inner.length > 0 : (typeof inner === 'object' && Object.keys(inner).length > 0));
    if (response.status === 200 && hasData) {
      return { ok: true, status: 200, raw: data, inner };
    }
    return { ok: false, status: response.status, raw: data };
  } catch (err) {
    console.error('externalController tryFactiliza error:', err.message);
    return { ok: false, error: err };
  }
}

async function callApisPeru(path) {
  const token = process.env.APISPERU_TOKEN;
  if (!token) {
    console.error('externalController: APISPERU_TOKEN no configurado');
    return {
      ok: false,
      status: 503,
      payload: null
    };
  }
  try {
    const response = await axios.get(`${APISPERU_BASE}${path}`, {
      params: { token },
      timeout: APISPERU_TIMEOUT_MS,
      validateStatus: () => true
    });
    return { ok: true, status: response.status, raw: response.data };
  } catch (err) {
    console.error('externalController callApisPeru error:', err.message);
    return { ok: false, status: 500, raw: null };
  }
}

async function getDni(req, res) {
  const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
  if (!idEmpresa) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const dni = (req.params.dni || '').trim();
  if (!dni) {
    return res.status(400).json({ error: 'DNI requerido' });
  }

  let factilizaResult = await tryFactiliza(`/dni/info/${dni}`);
  if (factilizaResult.ok && factilizaResult.inner) {
    const data = normalizeDni(factilizaResult.raw);
    return res.status(200).json({ _source: 'factiliza', data });
  }

  const apisRes = await callApisPeru(`/dni/${dni}`);
  const sourceLabel = 'apisperu';
  if (!apisRes.ok || apisRes.status !== 200) {
    return res.status(200).json({
      _source: sourceLabel,
      error: (apisRes.raw && apisRes.raw.message) || 'Error al consultar DNI'
    });
  }
  const raw = apisRes.raw;
  if (raw && raw.success === false) {
    return res.status(200).json({ _source: sourceLabel, error: raw.message || 'DNI no encontrado' });
  }
  const data = normalizeDni(raw);
  return res.status(200).json({ _source: sourceLabel, data });
}

async function getRuc(req, res) {
  const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
  if (!idEmpresa) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const ruc = (req.params.ruc || '').trim();
  if (!ruc) {
    return res.status(400).json({ error: 'RUC requerido' });
  }

  let factilizaResult = await tryFactiliza(`/ruc/info/${ruc}`);
  if (factilizaResult.ok && factilizaResult.inner) {
    const data = normalizeRuc(factilizaResult.raw);
    return res.status(200).json({ _source: 'factiliza', data });
  }

  const apisRes = await callApisPeru(`/ruc/${ruc}`);
  const sourceLabel = 'apisperu';
  if (!apisRes.ok || apisRes.status !== 200) {
    return res.status(200).json({
      _source: sourceLabel,
      error: (apisRes.raw && apisRes.raw.message) || 'Error al consultar RUC'
    });
  }
  const raw = apisRes.raw;
  if (raw && raw.success === false) {
    return res.status(200).json({ _source: sourceLabel, error: raw.message || 'RUC no encontrado' });
  }
  const data = normalizeRuc(raw);
  return res.status(200).json({ _source: sourceLabel, data });
}

/** Carnet de extranjería (CEE): solo Factiliza (ApisPeru no ofrece este servicio). GET /v1/cee/info/{cee} */
async function getCee(req, res) {
  const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
  if (!idEmpresa) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const cee = (req.params.cee || '').trim();
  if (!cee) {
    return res.status(400).json({ error: 'Número de carnet de extranjería requerido' });
  }

  const factilizaResult = await tryFactiliza(`/cee/info/${encodeURIComponent(cee)}`);
  if (factilizaResult.ok && factilizaResult.inner) {
    const data = normalizeCee(factilizaResult.raw);
    return res.status(200).json({ _source: 'factiliza', data });
  }

  const errorMsg = (factilizaResult.raw && factilizaResult.raw.message) || 'Carnet de extranjería no encontrado o servicio no disponible';
  return res.status(200).json({ _source: 'factiliza', error: errorMsg });
}

/** RUC - Establecimientos (anexos): solo Factiliza. GET /v1/ruc/anexo/{ruc} */
function normalizeEstablecimiento(item) {
  if (!item || typeof item !== 'object') return null;
  const ubigeoRaw = item.ubigeo_sunat ?? item.ubigeo;
  const ubigeo = Array.isArray(ubigeoRaw) ? (ubigeoRaw[ubigeoRaw.length - 1] || ubigeoRaw[0]) : ubigeoRaw;
  return {
    codigo: item.codigo ?? '',
    tipoEstablecimiento: item.tipo_establecimiento ?? item.tipoEstablecimiento ?? '',
    actividadEconomica: item.actividad_economica ?? item.actividadEconomica ?? '',
    direccion: item.direccion ?? '',
    direccionCompleta: item.direccion_completa ?? item.direccionCompleta ?? item.direccion ?? '',
    departamento: item.departamento ?? '',
    provincia: item.provincia ?? '',
    distrito: item.distrito ?? '',
    ubigeo: ubigeo || ''
  };
}

async function getRucAnexo(req, res) {
  const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
  if (!idEmpresa) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const ruc = (req.params.ruc || '').trim();
  if (!ruc) {
    return res.status(400).json({ error: 'RUC requerido' });
  }

  const factilizaResult = await tryFactiliza(`/ruc/anexo/${encodeURIComponent(ruc)}`);
  if (factilizaResult.ok && factilizaResult.inner) {
    const raw = factilizaResult.raw;
    const arr = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
    const data = arr.map(normalizeEstablecimiento).filter(Boolean);
    return res.status(200).json({ _source: 'factiliza', data });
  }

  const errorMsg = (factilizaResult.raw && factilizaResult.raw.message) || 'Sin establecimientos para el RUC o servicio no disponible';
  return res.status(200).json({ _source: 'factiliza', error: errorMsg });
}

module.exports = { getDni, getRuc, getCee, getRucAnexo };
