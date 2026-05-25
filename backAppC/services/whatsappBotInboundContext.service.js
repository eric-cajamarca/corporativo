const { withPool } = require('../utils/dbPool.util');
const factilizaRepository = require('../repositories/factiliza.repository');
const empresaWhatsAppRepository = require('../repositories/empresaWhatsApp.repository');
const whatsappBotConfigRepository = require('../repositories/whatsappBotConfig.repository');
const whatsappBotConversacionRepository = require('../repositories/whatsappBotConversacion.repository');
const whatsappBotSinonimoRepository = require('../repositories/whatsappBotSinonimo.repository');
const whatsappBotCatalogoRepository = require('../repositories/whatsappBotCatalogo.repository');
const whatsappBotConsultasRepository = require('../repositories/whatsappBotConsultas.repository');
const whatsappBotCliente = require('./whatsappBotCliente.service');
const { variantesBusquedaCelular } = require('../utils/telefonoWhatsApp.util');

const NOMBRE_SERVICIO_WHATSAPP_BOT = 'Factiliza WHATSAPP BOT';

/**
 * Una sola conexion SQL con consultas en paralelo (evita 10+ round-trips secuenciales por mensaje).
 */
async function precargar(idEmpresa, telefonoLog, digitosCelular) {
  const variantes = variantesBusquedaCelular(digitosCelular);

  return withPool(async (pool) => {
    const [
      autorizado,
      waRow,
      configRow,
      conv,
      sinonimosMap,
      catStats,
      clientRows
    ] = await Promise.all([
      factilizaRepository.puedeUsarServicio(pool, idEmpresa, NOMBRE_SERVICIO_WHATSAPP_BOT),
      empresaWhatsAppRepository.getByEmpresa(pool, idEmpresa),
      whatsappBotConfigRepository.getOrCreate(pool, idEmpresa),
      whatsappBotConversacionRepository.obtener(pool, idEmpresa, telefonoLog),
      whatsappBotSinonimoRepository.mapaPorEmpresa(pool, idEmpresa),
      whatsappBotCatalogoRepository.contarPorEmpresa(pool, idEmpresa),
      whatsappBotConsultasRepository.buscarPorCelular(pool, idEmpresa, variantes)
    ]);

    const resCliente = whatsappBotCliente.resolverDesdeFilas(clientRows);

    let convFinal = conv;
    if (!convFinal) {
      convFinal = { estado: 'menu', slots: {}, candidatos: [] };
    }

    const config = {
      ...configRow,
      activoBot: autorizado ? !!configRow.activoBot : false,
      servicioAutorizado: autorizado
    };

    return {
      autorizado,
      waRow,
      config,
      conv: convFinal,
      convNueva: !conv,
      sinonimosMap,
      catStats,
      resCliente
    };
  });
}

async function persistirTurno(pool, idEmpresa, telefonoLog, conv, convNueva) {
  if (convNueva && conv.estado === 'menu' && !Object.keys(conv.slots || {}).length) {
    await whatsappBotConversacionRepository.reiniciar(pool, idEmpresa, telefonoLog);
    return;
  }
  await whatsappBotConversacionRepository.guardar(pool, idEmpresa, telefonoLog, conv);
}

module.exports = {
  precargar,
  persistirTurno,
  NOMBRE_SERVICIO_WHATSAPP_BOT
};
