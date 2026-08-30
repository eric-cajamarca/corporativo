/**
 * Preventa EFAFERP en WhatsApp. Solo la empresa con Empresas.esPrincipal = 1.
 * El catálogo/pedidos siguen siendo los de esa misma empresa.
 */
const { withPool } = require('../utils/dbPool.util');
const suscripcionRepository = require('../repositories/suscripcion.repository');
const { normalizarGuid } = require('../utils/plataformaEmpresa.util');
const ficha = require('../utils/whatsappBotComercial.conocimiento');
const flayersCatalogo = require('../utils/whatsappBotFlayers.catalogo');
const comercialIa = require('./whatsappBotComercialIa.service');
const whatsappBotEscalamiento = require('./whatsappBotEscalamiento.service');
const whatsappBotLeadComercial = require('./whatsappBotLeadComercial.service');

const INTENCIONES = new Set([
  'info_sistema',
  'planes_saas',
  'flayer_comercial',
  'soporte_asistente',
  'consulta_comercial',
  'agendar_llamada'
]);

const INTENCIONES_IA = new Set([
  'info_sistema',
  'consulta_comercial',
  'agendar_llamada',
  'planes_saas',
  'soporte_asistente'
]);

const CACHE_PRINCIPAL_MS = 5 * 60 * 1000;
const cachePrincipal = { id: undefined, at: 0 };

async function idEmpresaPrincipal() {
  const now = Date.now();
  if (cachePrincipal.at && now - cachePrincipal.at < CACHE_PRINCIPAL_MS) {
    return cachePrincipal.id || null;
  }
  try {
    const id = await withPool((pool) => suscripcionRepository.obtenerIdEmpresaPrincipal(pool));
    cachePrincipal.id = id || null;
    cachePrincipal.at = now;
    return cachePrincipal.id;
  } catch (err) {
    console.error('whatsappBotComercial empresa principal:', err.message);
    return cachePrincipal.id || null;
  }
}

async function esEmpresaPrincipal(idEmpresa) {
  const principal = await idEmpresaPrincipal();
  if (!principal) return false;
  const a = normalizarGuid(idEmpresa);
  const b = normalizarGuid(principal);
  return a !== '' && a === b;
}

function textoMenu(base) {
  return [base, ficha.TEXTO_MENU_EXTRA_PRINCIPAL].join('\n');
}

function leerImagenFlayer(slug) {
  return flayersCatalogo.leerImagen(slug);
}

function turno(respuesta, conv, reaccion = '✨', adjunto = null) {
  const out = {
    respuesta,
    conv: conv || { estado: 'menu', slots: {}, candidatos: [] },
    reaccion
  };
  if (adjunto) out.adjunto = adjunto;
  return out;
}

function turnoFlayer(flayer, conv) {
  const img = leerImagenFlayer(flayer.slug);
  const adjunto = img
    ? { imagenes: [{ ...img, caption: `*${flayer.titulo}*` }] }
    : null;
  return turno(ficha.textoUnFlayer(flayer, !!img), conv, '✨', adjunto);
}

function enConversacionComercial(conv) {
  const com = conv?.slots?.comercial;
  return (
    conv?.estado === 'comercial_ia'
    || Boolean(com?.esperandoDatosLlamada)
    || Boolean(com?.quiereLlamada)
  );
}

function cederAlCatalogo(nlu, textoEntrada, conv) {
  if (enConversacionComercial(conv)) return false;
  if (ficha.extraerNombreHorario(textoEntrada)) return false;
  if (!['producto', 'precio', 'stock'].includes(nlu?.intencion)) return false;
  if (ficha.pareceConsultaComercial(textoEntrada, nlu, 'menu')) return false;
  const corto = String(textoEntrada || '').trim().split(/\s+/).filter(Boolean).length <= 6;
  return corto && !/\b(sistema|negocio|rubro|sirve|ayuda)\b/i.test(textoEntrada);
}

async function celularEmpresaPrincipal(idEmpresa, ctx) {
  if (ctx?.celularEmpresaPrincipal) return ctx.celularEmpresaPrincipal;
  try {
    return await withPool((pool) => suscripcionRepository.obtenerCelularEmpresa(pool, idEmpresa));
  } catch (err) {
    console.error('whatsappBotComercial celular empresa:', err.message);
    return null;
  }
}

async function avisarSoporteSiCorresponde(idEmpresa, ctx, ia, slots) {
  if (!ctx || !ia?.comercial) return { ok: false, skipped: true };
  const com = ia.comercial;
  const celularEmp = await celularEmpresaPrincipal(idEmpresa, ctx);
  const numero = whatsappBotEscalamiento.resolverNumeroVendedor(ctx.config, ctx.telefonoVinculadoBot, {
    celularEmpresa: celularEmp || process.env.PAGO_MANUAL_WHATSAPP
  });
  const tel = ctx.telefonoLog || ctx.digitosCelular;
  const celularLead = ctx.digitosCelular || com.celular || com.celularWeb || null;
  const payload = {
    numeroVendedor: numero,
    telefonoCliente: tel,
    nombreCliente: com.nombre || null,
    comercial: com,
    canal: ctx.canal === 'web' ? 'web' : 'whatsapp',
    digitosCelular: celularLead
  };

  const listaParaAvisarLlamada =
    ia.quiereLlamada
    && ficha.esNombrePersona(com.nombre)
    && com.mejorHorario
    && !com.avisoLlamadaOk
    && !(ctx.canal === 'web' && !ficha.celularValido(celularLead));
  if (listaParaAvisarLlamada) {
    slots.comercial = com;
    try {
      const r = await whatsappBotEscalamiento.notificarInteresComercial(idEmpresa, { ...payload, motivo: 'llamada' });
      if (r?.ok) {
        com.avisoLlamadaEnviado = true;
        com.avisoLlamadaOk = true;
        slots.comercial = com;
        return r;
      }
      console.error('whatsappBotComercial aviso llamada no enviado:', r?.error || r?.skipped);
      return r || { ok: false };
    } catch (err) {
      console.error('whatsappBotComercial aviso llamada:', err.message);
      return { ok: false, error: err.message };
    }
  }
  if (com.intencionCompra === 'alta' && !com.avisoAltaOk && !com.avisoLlamadaOk) {
    try {
      const r = await whatsappBotEscalamiento.notificarInteresComercial(idEmpresa, { ...payload, motivo: 'alta' });
      if (r?.ok) {
        com.avisoAltaEnviado = true;
        com.avisoAltaOk = true;
        slots.comercial = com;
      }
      return r;
    } catch (err) {
      console.error('whatsappBotComercial aviso alta:', err.message);
      return { ok: false, error: err.message };
    }
  }
  return { ok: false, skipped: true };
}

async function turnoIa(idEmpresa, conv, nlu, textoEntrada, ctx) {
  const slots = { ...(conv.slots || {}) };
  if (ctx?.digitosCelular) {
    slots.comercial = {
      ...(slots.comercial || {}),
      celular: ctx.digitosCelular,
      celularWeb: ctx.canal === 'web' ? ctx.digitosCelular : slots.comercial?.celularWeb
    };
  }
  const ia = await comercialIa.procesarTurnoIa({
    textoEntrada,
    slots,
    nlu,
    claveRateLimit: `${idEmpresa}:${ctx?.telefonoLog || ctx?.digitosCelular || 'x'}`,
    canal: ctx?.canal === 'web' ? 'web' : 'whatsapp'
  });
  const nextSlots = { ...slots, comercial: ia.comercial };
  let respuesta = ia.respuesta;
  let adjunto = null;
  if (ia.slugFlayer) {
    const fl =
      ficha.listarFlayers().find((x) => x.slug === ia.slugFlayer) || ficha.resolverFlayer(String(ia.slugFlayer));
    if (fl) {
      const img = leerImagenFlayer(fl.slug);
      if (img) adjunto = { imagenes: [{ ...img, caption: `*${fl.titulo}*` }] };
      if (!/\/flayers\//i.test(respuesta)) {
        respuesta = `${respuesta}\n\n${ficha.textoUnFlayer(fl, !!img)}`;
      }
    }
  }
  const aviso = await avisarSoporteSiCorresponde(idEmpresa, ctx, ia, nextSlots);
  whatsappBotLeadComercial.registrarDesdeTurno(idEmpresa, ctx, ia, textoEntrada).catch((err) => {
    console.error('whatsappBotComercial lead:', err.message);
  });
  const out = turno(respuesta, { estado: 'comercial_ia', slots: nextSlots, candidatos: [] }, '✨', adjunto);
  if (aviso && aviso.ok) out.avisoEnviado = true;
  return out;
}

/**
 * @returns {Promise<object|null>} turno o null si no aplica (otra empresa u otra intención).
 */
async function intentarProcesar(idEmpresa, conv, nlu, textoEntrada, ctx) {
  if (!(await esEmpresaPrincipal(idEmpresa))) return null;

  const slots = { ...(conv.slots || {}) };
  const estado = conv.estado || 'menu';
  const menuN = Number(nlu.entidades?.menuNumero);

  if (['menu', 'hola', 'ping', 'despedida', 'solicitar_agente'].includes(nlu.intencion)) {
    return null;
  }

  if (cederAlCatalogo(nlu, textoEntrada, conv)) return null;

  if (estado === 'comercial_flayer' && nlu.intencion !== 'menu' && nlu.intencion !== 'cancelar_cotizacion') {
    const elegido = ficha.resolverFlayer(textoEntrada);
    if (elegido) {
      return turnoFlayer(elegido, { estado: 'menu', slots: { ...slots, esperandoFlayer: false }, candidatos: [] });
    }
    if (nlu.intencion === 'flayer_comercial' || nlu.intencion === 'info_sistema') {
      return turno(ficha.textoListaFlayers(), { estado: 'comercial_flayer', slots: { ...slots, esperandoFlayer: true }, candidatos: [] });
    }
  }

  const planesExplicitos =
    nlu.intencion === 'planes_saas'
    && /^(planes)$/i.test(String(textoEntrada || '').trim())
    && estado !== 'comercial_ia';
  if (planesExplicitos) {
    return turno(ficha.textoPlanes(), { estado: 'menu', slots, candidatos: [] });
  }

  if (nlu.intencion === 'soporte_asistente' && estado !== 'comercial_ia') {
    return turno(ficha.textoSoporteAsistente(), { estado: 'menu', slots, candidatos: [] });
  }

  if (nlu.intencion === 'flayer_comercial' && !enConversacionComercial(conv)) {
    const uno = ficha.resolverFlayer(textoEntrada);
    if (uno) {
      return turnoFlayer(uno, { estado: 'menu', slots, candidatos: [] });
    }
    return turno(ficha.textoListaFlayers(), {
      estado: 'comercial_flayer',
      slots: { ...slots, esperandoFlayer: true },
      candidatos: []
    });
  }

  const usaIa =
    enConversacionComercial(conv)
    || Boolean(ficha.extraerNombreHorario(textoEntrada))
    || INTENCIONES_IA.has(nlu.intencion)
    || (nlu.intencion === 'menu_numero' && menuN === 5)
    || ficha.pareceConsultaComercial(textoEntrada, nlu, estado);

  if (!usaIa) return null;

  return turnoIa(idEmpresa, conv, nlu, textoEntrada, ctx);
}

module.exports = {
  esEmpresaPrincipal,
  idEmpresaPrincipal,
  textoMenu,
  intentarProcesar,
  avisarSoporteSiCorresponde,
  leerImagenFlayer,
  textoHolaExtra: ficha.textoHolaExtraPrincipal,
  textoQueVendesPrincipal: ficha.textoQueVendesPrincipal,
  INTENCIONES
};
