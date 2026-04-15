const unidPorCajaRepository = require('../repositories/unidPorCaja.repository');

async function obtenerPorEmpresa(pool, idEmpresa) {
  if (!idEmpresa) {
    throw new Error('Empresa no identificada');
  }
  return unidPorCajaRepository.listarPorEmpresa(pool, idEmpresa);
}

async function editar(pool, idEmpresa, idUndPorCaja, body) {
  if (!idEmpresa) {
    throw new Error('Empresa no identificada');
  }
  const id = parseInt(idUndPorCaja, 10);
  if (Number.isNaN(id)) {
    throw new Error('idUndPorCaja inválido');
  }
  const unidxCaja = parseInt(body?.unidxCaja, 10);
  const pesoUnidad = Number(body?.pesoUnidad);
  const pesoCaja = Number(body?.pesoCaja);
  if (Number.isNaN(unidxCaja) || unidxCaja < 0) {
    throw new Error('unidxCaja inválido');
  }
  if (Number.isNaN(pesoUnidad) || pesoUnidad < 0) {
    throw new Error('pesoUnidad inválido');
  }
  if (Number.isNaN(pesoCaja) || pesoCaja < 0) {
    throw new Error('pesoCaja inválido');
  }
  return unidPorCajaRepository.actualizar(pool, {
    idEmpresa,
    idUndPorCaja: id,
    unidxCaja,
    pesoUnidad,
    pesoCaja
  });
}

module.exports = {
  obtenerPorEmpresa,
  editar
};
