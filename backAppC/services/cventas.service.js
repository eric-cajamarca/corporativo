const cventasRepository = require('../repositories/cventas.repository');

async function obtenerPorSerieYDestino(pool, serieNumero, destino) {
  if (!serieNumero || destino == null || String(destino).trim() === '') {
    throw new Error('PARAMS_INVALIDOS');
  }
  return cventasRepository.obtenerPorSerieYDestino(pool, serieNumero, destino);
}

async function actualizarEstados(pool, body) {
  const { Serie_Numero, Estado, EstadoPedido, EstadoSunat } = body || {};
  if (!Serie_Numero) throw new Error('Serie_Numero requerido');
  return cventasRepository.actualizarEstadosTienda01(
    pool,
    Serie_Numero,
    Estado ?? '',
    EstadoPedido ?? '',
    EstadoSunat ?? ''
  );
}

async function eliminar(pool, idParam) {
  const id = parseInt(idParam, 10);
  if (Number.isNaN(id)) throw new Error('ID_INVALIDO');
  return cventasRepository.eliminarPorId(pool, id);
}

module.exports = {
  obtenerPorSerieYDestino,
  actualizarEstados,
  eliminar
};
