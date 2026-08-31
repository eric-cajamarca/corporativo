const { withPool } = require('../utils/dbPool.util');
const repo = require('../repositories/whatsappBotLeadComercial.repository');
const suscripcionRepository = require('../repositories/suscripcion.repository');
const ficha = require('../utils/whatsappBotComercial.conocimiento');

function estadoDesdeComercial(com, quiereLlamada) {
  const nombreOk = ficha.esNombrePersona(com?.nombre);
  const horarioOk = Boolean(com?.mejorHorario);
  const celOk = ficha.celularValido(com?.celular || com?.celularWeb);
  if (quiereLlamada && nombreOk && horarioOk && (celOk || !com?.requiereCelular)) return 'llamada_pendiente';
  if (com?.pagoReportado || com?.intencionCompra === 'alta') return 'interesado';
  if (com?.rubro || nombreOk) return 'nuevo';
  return 'nuevo';
}

async function registrarDesdeTurno(idEmpresa, ctx, ia, textoEntrada) {
  const com = ia?.comercial;
  if (!com) return;
  const nombreOk = ficha.esNombrePersona(com.nombre);
  const tieneAlgo = nombreOk || com.rubro || com.necesidad || ia.quiereLlamada || com.intencionCompra === 'alta' || com.pagoReportado;
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
      ultimoMensaje: String(textoEntrada || '').slice(0, 500)
    })
  );
}

async function listarParaPlataforma(filtros) {
  return withPool(async (pool) => {
    const idEmpresa = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
    if (!idEmpresa) {
      const e = new Error('NO_PRINCIPAL');
      e.code = 'NO_PRINCIPAL';
      throw e;
    }
    return repo.listar(pool, idEmpresa, filtros);
  });
}

async function actualizarEstadoPlataforma(idLead, estado) {
  const est = String(estado || '').trim();
  if (!repo.ESTADOS.has(est)) {
    const e = new Error('ESTADO_INVALIDO');
    e.code = 'ESTADO_INVALIDO';
    throw e;
  }
  const id = String(idLead || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    const e = new Error('NO_ENCONTRADO');
    e.code = 'NO_ENCONTRADO';
    throw e;
  }
  return withPool(async (pool) => {
    const idEmpresa = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
    if (!idEmpresa) {
      const e = new Error('NO_PRINCIPAL');
      e.code = 'NO_PRINCIPAL';
      throw e;
    }
    const row = await repo.actualizarEstado(pool, idEmpresa, idLead, est);
    if (!row) {
      const e = new Error('NO_ENCONTRADO');
      e.code = 'NO_ENCONTRADO';
      throw e;
    }
    return row;
  });
}

module.exports = { registrarDesdeTurno, listarParaPlataforma, actualizarEstadoPlataforma };
