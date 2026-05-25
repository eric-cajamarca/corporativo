const { withPool } = require('../utils/dbPool.util');
const whatsappBotSeguridadRepository = require('../repositories/whatsappBotSeguridad.repository');
const { variantesBusquedaCelular } = require('../utils/telefonoWhatsApp.util');

const COTIZ_MAX_DIA = parseInt(process.env.WHATSAPP_BOT_COTIZ_MAX_DIA, 10) || 3;

function crearErrorLimite(mensaje, codigo = 'RATE_LIMIT') {
  const err = new Error(mensaje);
  err.code = codigo;
  return err;
}

async function assertLimiteCotizacionesDia(idEmpresa, digitosCelular, idCliente) {
  const variantes = variantesBusquedaCelular(digitosCelular);
  const total = await withPool(async (pool) => {
    let n = await whatsappBotSeguridadRepository.contarCotizacionesHoyPorCelular(pool, idEmpresa, variantes);
    if (idCliente) {
      const porCliente = await whatsappBotSeguridadRepository.contarCotizacionesHoyPorCliente(
        pool,
        idEmpresa,
        idCliente
      );
      if (porCliente > n) n = porCliente;
    }
    return n;
  });
  if (total >= COTIZ_MAX_DIA) {
    throw crearErrorLimite(`Solo puede registrar ${COTIZ_MAX_DIA} cotizaciones por dia desde este numero.`);
  }
}

module.exports = {
  assertLimiteCotizacionesDia,
  COTIZ_MAX_DIA
};
