const { withPool } = require('../utils/dbPool.util');
const repo = require('../repositories/whatsappBotLeadComercial.repository');
const whatsappBotLogRepository = require('../repositories/whatsappBotLog.repository');
const suscripcionRepository = require('../repositories/suscripcion.repository');
const ficha = require('../utils/whatsappBotComercial.conocimiento');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function estadoDesdeComercial(com, quiereLlamada) {
  const nombreOk = ficha.esNombrePersona(com?.nombre);
  const horarioOk = Boolean(com?.mejorHorario);
  const celOk = ficha.celularValido(com?.celular || com?.celularWeb);
  if (quiereLlamada && nombreOk && horarioOk && (celOk || !com?.requiereCelular)) return 'llamada_pendiente';
  if (com?.pagoReportado || com?.intencionCompra === 'alta' || com?.ofrecioDemo) return 'interesado';
  if (com?.rubro || com?.rubroLibre || nombreOk) return 'nuevo';
  return 'nuevo';
}

function assertUuid(id, code = 'NO_ENCONTRADO') {
  const v = String(id || '').trim();
  if (!UUID_RE.test(v)) {
    const e = new Error(code);
    e.code = code;
    throw e;
  }
  return v;
}

function parseFechaIso(v) {
  const s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function fechaLocalIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fechasMetricas(query) {
  const hoy = new Date();
  const hasta = parseFechaIso(query?.hasta) || fechaLocalIso(hoy);
  const hace6 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6);
  let desde = parseFechaIso(query?.desde) || fechaLocalIso(hace6);
  if (desde > hasta) {
    const tmp = desde;
    desde = hasta;
    return { desde: hasta, hasta: tmp };
  }
  return { desde, hasta };
}

async function conEmpresaPrincipal(fn) {
  return withPool(async (pool) => {
    const idEmpresa = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
    if (!idEmpresa) {
      const e = new Error('NO_PRINCIPAL');
      e.code = 'NO_PRINCIPAL';
      throw e;
    }
    return fn(pool, idEmpresa);
  });
}

async function registrarDesdeTurno(idEmpresa, ctx, ia, textoEntrada) {
  const com = ia?.comercial;
  if (!com) return;
  const nombreOk = ficha.esNombrePersona(com.nombre);
  const tieneAlgo =
    nombreOk ||
    com.rubro ||
    com.rubroLibre ||
    com.necesidad ||
    ia.quiereLlamada ||
    com.intencionCompra === 'alta' ||
    com.pagoReportado ||
    com.ofrecioDemo;
  if (!tieneAlgo) return;

  const tel = String(ctx?.telefonoLog || ctx?.digitosCelular || '').slice(0, 40);
  if (!tel) return;
  const celular = ctx?.digitosCelular || com.celular || com.celularWeb || null;

  await withPool((pool) =>
    repo.upsert(pool, {
      idEmpresa,
      telefonoLog: tel,
      digitosCelular: celular,
      nombre: nombreOk ? com.nombre : null,
      rubro: com.rubro,
      rubroLibre: com.rubroLibre,
      necesidad: com.necesidad,
      intencionCompra: com.intencionCompra,
      encaja: com.encaja,
      mejorHorario: com.mejorHorario,
      estado: estadoDesdeComercial(com, ia.quiereLlamada),
      quiereLlamada: Boolean(ia.quiereLlamada || com.quiereLlamada),
      ofrecioDemo: Boolean(com.ofrecioDemo),
      ultimoMensaje: String(textoEntrada || '').slice(0, 500)
    })
  );
}

async function listarParaPlataforma(filtros) {
  return conEmpresaPrincipal((pool, idEmpresa) => repo.listar(pool, idEmpresa, filtros));
}

async function metricasParaPlataforma(query) {
  const { desde, hasta } = fechasMetricas(query);
  return conEmpresaPrincipal(async (pool, idEmpresa) => {
    const raw = await repo.metricas(pool, idEmpresa, desde, hasta);
    const pctDemo =
      raw.ofrecioDemo > 0 ? Math.round((raw.empresas / raw.ofrecioDemo) * 1000) / 10 : 0;
    return { desde, hasta, ...raw, pctDemo };
  });
}

async function revisionParaPlataforma() {
  return conEmpresaPrincipal((pool, idEmpresa) => repo.listarRevision(pool, idEmpresa));
}

async function chatParaPlataforma(idLead) {
  const id = assertUuid(idLead);
  return conEmpresaPrincipal(async (pool, idEmpresa) => {
    const lead = await repo.obtenerPorId(pool, idEmpresa, id);
    if (!lead) {
      const e = new Error('NO_ENCONTRADO');
      e.code = 'NO_ENCONTRADO';
      throw e;
    }
    const tel = String(lead.telefonoLog || '').slice(0, 20);
    const mensajes = tel
      ? await whatsappBotLogRepository.listarPorTelefono(pool, idEmpresa, tel, 50)
      : [];
    return { lead, mensajes };
  });
}

async function actualizarEstadoPlataforma(idLead, estado) {
  const est = String(estado || '').trim();
  if (!repo.ESTADOS.has(est)) {
    const e = new Error('ESTADO_INVALIDO');
    e.code = 'ESTADO_INVALIDO';
    throw e;
  }
  const id = assertUuid(idLead);
  return conEmpresaPrincipal(async (pool, idEmpresa) => {
    const row = await repo.actualizarEstado(pool, idEmpresa, id, est);
    if (!row) {
      const e = new Error('NO_ENCONTRADO');
      e.code = 'NO_ENCONTRADO';
      throw e;
    }
    return row;
  });
}

async function guardarRevisionPlataforma(idLead, body) {
  const id = assertUuid(idLead);
  const nota = String(body?.notaRevision || '').trim().slice(0, 500);
  let estado = null;
  if (body?.estado != null && String(body.estado).trim() !== '') {
    estado = String(body.estado).trim();
    if (!repo.ESTADOS.has(estado)) {
      const e = new Error('ESTADO_INVALIDO');
      e.code = 'ESTADO_INVALIDO';
      throw e;
    }
  }
  return conEmpresaPrincipal(async (pool, idEmpresa) => {
    const row = await repo.guardarRevision(pool, idEmpresa, id, nota, estado);
    if (!row) {
      const e = new Error('NO_ENCONTRADO');
      e.code = 'NO_ENCONTRADO';
      throw e;
    }
    return row;
  });
}

async function marcarRegistroEmpresa(celular, idEmpresaNueva) {
  const nueve = ficha.last9Celular(celular);
  const idNueva = String(idEmpresaNueva || '').trim();
  if (!nueve || !UUID_RE.test(idNueva)) return;
  try {
    await withPool(async (pool) => {
      const idPrincipal = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
      if (!idPrincipal) return;
      if (String(idPrincipal).toLowerCase() === idNueva.toLowerCase()) return;
      await repo.marcarGanadoPorCelular(pool, idPrincipal, nueve, idNueva);
    });
  } catch (err) {
    console.error('lead comercial registro empresa:', err.message);
  }
}

module.exports = {
  registrarDesdeTurno,
  listarParaPlataforma,
  metricasParaPlataforma,
  revisionParaPlataforma,
  chatParaPlataforma,
  actualizarEstadoPlataforma,
  guardarRevisionPlataforma,
  marcarRegistroEmpresa
};
