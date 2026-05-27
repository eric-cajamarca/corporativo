const axios = require('axios');
const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');
const factilizaRepository = require('../repositories/factiliza.repository');
const clientesRepository = require('../repositories/clientes.repository');
const whatsappBotConsultasRepository = require('../repositories/whatsappBotConsultas.repository');
const { variantesBusquedaCelular } = require('../utils/telefonoWhatsApp.util');

const NOMBRE_SERVICIO_SUNAT = 'Factiliza SUNAT';
const FACTILIZA_BASE = 'https://api.factiliza.com/v1';
const FACTILIZA_TIMEOUT_MS = 8000;

const TEXTO_SOLICITAR_DOCUMENTO = [
  '*Cotización* 🛒',
  'Para cotizarte necesito tu *DNI* (8 dígitos) o *RUC* (11 dígitos).',
  'Vamos a validar tu documento en SUNAT/RENIEC antes de continuar.',
  '',
  'Ejemplo DNI: 12345678',
  'Ejemplo RUC: 20123456789',
  '',
  '_Escribe MENÚ si prefieres no continuar._'
].join('\n');

function soloDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function parseDocumentoEntrada(texto) {
  const num = soloDigitos(texto);
  if (num.length === 8) return { tipo: 'dni', numero: num, idDocumento: '1' };
  if (num.length === 11) return { tipo: 'ruc', numero: num, idDocumento: '6' };
  return null;
}

/** Validacion local basica antes de consultar API. */
function validarFormatoDocumento(doc) {
  if (!doc) return { ok: false, mensaje: 'Ingresa DNI (8 dígitos) o RUC (11 dígitos).' };
  if (doc.tipo === 'dni') {
    if (!/^\d{8}$/.test(doc.numero)) {
      return { ok: false, mensaje: 'Ese DNI no es válido. Debe tener 8 dígitos.' };
    }
    return { ok: true };
  }
  if (doc.tipo === 'ruc') {
    if (!/^(10|15|16|17|20)\d{9}$/.test(doc.numero)) {
      return { ok: false, mensaje: 'Ese RUC no es válido. Debe tener 11 dígitos y empezar en 10, 15, 16, 17 o 20.' };
    }
    return { ok: true };
  }
  return { ok: false, mensaje: 'Documento no reconocido.' };
}

function nombreDesdeDni(data) {
  const nombreCompleto = pick(data, 'nombreCompleto', 'nombre_completo');
  if (nombreCompleto) return String(nombreCompleto).trim();
  const nombres = pick(data, 'nombres', 'Nombres') || '';
  const apPat = pick(data, 'apellidoPaterno', 'apellido_paterno', 'ApellidoPaterno') || '';
  const apMat = pick(data, 'apellidoMaterno', 'apellido_materno', 'ApellidoMaterno') || '';
  const full = [nombres, apPat, apMat].map((x) => String(x).trim()).filter(Boolean).join(' ');
  return full.trim();
}

function normalizarRespuestaDni(raw) {
  const o = raw && (raw.data !== undefined ? raw.data : raw) || {};
  const nombre = nombreDesdeDni(o);
  if (!nombre) return null;
  return { rSocial: nombre.slice(0, 200), condicion: null };
}

function normalizarRespuestaRuc(raw) {
  const o = raw && (raw.data !== undefined ? raw.data : raw) || {};
  const razonSocial = pick(o, 'razonSocial', 'RazonSocial', 'nombre_o_razon_social', 'razon_social', 'nombre');
  if (!razonSocial) return null;
  const estado = String(pick(o, 'estado', 'Estado', 'condicion', 'Condicion') || 'ACTIVO').trim().toUpperCase();
  return {
    rSocial: String(razonSocial).trim().slice(0, 200),
    condicion: estado
  };
}

async function obtenerTokenFactilizaSunat(pool, idEmpresa) {
  const puede = await factilizaRepository.puedeUsarServicio(pool, idEmpresa, NOMBRE_SERVICIO_SUNAT);
  if (!puede) {
    throw new Error('Consulta SUNAT no habilitada para esta empresa. Contacte a la empresa.');
  }
  const cfg = await factilizaRepository.getConfigByNombre(pool, NOMBRE_SERVICIO_SUNAT);
  const acceso = await factilizaRepository.getTokenParaEmpresa(pool, idEmpresa);
  const token = acceso?.token || cfg?.tokenDefault || process.env.FACTILIZA_TOKEN || null;
  if (!token) {
    throw new Error('Servicio SUNAT no configurado (token Factiliza).');
  }
  return token;
}

async function consultarDocumentoFactiliza(pool, idEmpresa, doc) {
  const token = await obtenerTokenFactilizaSunat(pool, idEmpresa);
  const path = doc.tipo === 'dni'
    ? `/dni/info/${doc.numero}`
    : `/ruc/info/${doc.numero}`;
  try {
    const response = await axios.get(`${FACTILIZA_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: FACTILIZA_TIMEOUT_MS,
      validateStatus: () => true
    });
    const data = response.data;
    const inner = data && (data.data ?? data);
    const hasData = inner && (typeof inner === 'object' && Object.keys(inner).length > 0);
    if (response.status !== 200 || !hasData) {
      const msg = pick(data, 'message', 'Message') || `No encontré el documento ${doc.numero}.`;
      return { ok: false, mensaje: String(msg) };
    }
    if (doc.tipo === 'dni') {
      const norm = normalizarRespuestaDni(data);
      if (!norm) return { ok: false, mensaje: 'No encontré ese DNI en RENIEC.' };
      return { ok: true, datos: norm };
    }
    const norm = normalizarRespuestaRuc(data);
    if (!norm) return { ok: false, mensaje: 'No encontré ese RUC en SUNAT.' };
    if (norm.condicion && !/ACTIVO|HABIDO/i.test(norm.condicion)) {
      return { ok: false, mensaje: `El RUC ${doc.numero} no está activo/habido en SUNAT (${norm.condicion}).` };
    }
    return { ok: true, datos: norm };
  } catch (err) {
    console.error('whatsappBotRegistroCliente consulta:', err.message);
    return { ok: false, mensaje: 'No pude validar tu documento en este momento. Intenta de nuevo en un minuto.' };
  }
}

async function vincularCelularCliente(pool, idEmpresa, idCliente, celular) {
  if (!celular) return;
  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, idCliente)
    .input('celular', sql.VarChar(50), celular)
    .query(`
      UPDATE Clientes SET celular = @celular
      WHERE idEmpresa = @idEmpresa AND idCliente = @idCliente
    `);
}

async function validarCelularUnicoDocumento(pool, idEmpresa, variantesCelular, docNumero, idClientePermitido = null) {
  const rows = await whatsappBotConsultasRepository.buscarPorCelular(pool, idEmpresa, variantesCelular);
  const docNorm = soloDigitos(docNumero);
  for (const row of rows) {
    if (idClientePermitido && row.idCliente === idClientePermitido) continue;
    const rucNorm = soloDigitos(row.ruc);
    if (rucNorm && rucNorm !== docNorm) {
      return {
        ok: false,
        mensaje:
          'Este número de celular ya está registrado como contacto de otro cliente. ' +
          'Usa el documento asociado a tu número o contacta a la empresa.'
      };
    }
  }
  return { ok: true };
}

async function registrarOActualizarPorDocumento(pool, idEmpresa, doc, datosSunat, celularWhatsApp) {
  const existente = await clientesRepository.obtenerPorRuc(pool, idEmpresa, doc.numero);
  if (existente) {
    if (celularWhatsApp) {
      await vincularCelularCliente(pool, idEmpresa, existente.idCliente, celularWhatsApp);
    }
    return {
      idCliente: existente.idCliente,
      rSocial: existente.rSocial || datosSunat.rSocial,
      ruc: existente.ruc || doc.numero,
      existente: true
    };
  }

  await clientesRepository.insertar(pool, {
    idEmpresa,
    idDocumento: doc.idDocumento,
    ruc: doc.numero,
    rSocial: datosSunat.rSocial,
    correo: null,
    celular: celularWhatsApp || null,
    condicion: datosSunat.condicion || null,
    sujetoCredito: false,
    lineaCredito: 0
  });

  const creado = await clientesRepository.obtenerPorRuc(pool, idEmpresa, doc.numero);
  if (!creado) throw new Error('No se pudo registrar el cliente.');
  return {
    idCliente: creado.idCliente,
    rSocial: creado.rSocial,
    ruc: creado.ruc,
    existente: false
  };
}

/**
 * Valida DNI/RUC en Factiliza y crea o vincula cliente en la empresa.
 */
async function registrarPorDocumento(idEmpresa, digitosCelular, textoDocumento, idClienteConocido = null) {
  const doc = parseDocumentoEntrada(textoDocumento);
  const fmt = validarFormatoDocumento(doc);
  if (!fmt.ok) return { ok: false, mensaje: fmt.mensaje };

  const celular = soloDigitos(digitosCelular);
  const celularFmt = celular.length === 9 && celular.startsWith('9') ? `51${celular}` : celular;
  const variantes = variantesBusquedaCelular(celularFmt || digitosCelular);

  return withPool(async (pool) => {
    const celularOk = await validarCelularUnicoDocumento(
      pool,
      idEmpresa,
      variantes,
      doc.numero,
      idClienteConocido
    );
    if (!celularOk.ok) {
      return { ok: false, mensaje: celularOk.mensaje };
    }

    const consulta = await consultarDocumentoFactiliza(pool, idEmpresa, doc);
    if (!consulta.ok) return { ok: false, mensaje: consulta.mensaje };

    const cliente = await registrarOActualizarPorDocumento(
      pool,
      idEmpresa,
      doc,
      consulta.datos,
      celularFmt || null
    );

    return {
      ok: true,
      cliente,
      mensaje: cliente.existente
        ? `¡Te identifiqué! Hola *${cliente.rSocial}*. Continuamos con tu cotización.`
        : `¡Listo! Te registré como *${cliente.rSocial}*. Continuamos con tu cotización.`
    };
  });
}

module.exports = {
  TEXTO_SOLICITAR_DOCUMENTO,
  parseDocumentoEntrada,
  registrarPorDocumento
};
