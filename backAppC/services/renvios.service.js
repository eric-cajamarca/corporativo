const renviosRepository = require('../repositories/renvios.repository');

function formatearCompEnvio(serie, numero) {
  const n = Number(numero);
  const pad = String(n).padStart(8, '0');
  return `${serie}-${pad}`;
}

async function listarEnvios(pool) {
  return renviosRepository.listarHistorial(pool);
}

async function obtenerPorCodigo(pool, codicion) {
  return renviosRepository.buscarHistorialPorCodigo(pool, codicion);
}

/**
 * Crea líneas de historial y actualiza correlativo comprobante.
 * @param {import('mssql').ConnectionPool} pool
 */
async function crearCompEnvio(pool, user, dataArray) {
  if (!user) throw new Error('NO_AUTH');
  if (!Array.isArray(dataArray) || dataArray.length === 0) throw new Error('DATOS_INVALIDOS');
  const alias = dataArray[0].Alias;
  const compRows = await renviosRepository.obtenerComprobanteFila15(pool, alias);
  if (!compRows) throw new Error('ALIAS_INVALIDO');
  if (!compRows.length) throw new Error('COMPROBANTE_NO_ENCONTRADO');

  let NumeroCompEnvio = compRows[0].Numero;
  const serieCompEnvio = compRows[0].Serie;
  let CompEnvio = formatearCompEnvio(serieCompEnvio, NumeroCompEnvio);

  const existe = await renviosRepository.existeCompEnvio(pool, CompEnvio);
  if (Array.isArray(existe) && existe.length > 0) {
    const err = new Error('COMP_DUPLICADO');
    err.code = 'COMP_DUPLICADO';
    throw err;
  }

  const fecha = new Date();
  const fechaActual = `${fecha.getFullYear()}-${fecha.getMonth() + 1}-${String(fecha.getDate()).padStart(2, '0')}`;

  for (const element of dataArray) {
    if (element.Cantidad <= 0) continue;
    await renviosRepository.insertarHistorialLinea(pool, {
      compEnvio: CompEnvio,
      compVentas: element.CompVentas,
      fEnvio: fechaActual,
      descripcion: element.Descripcion,
      presentacion: element.Presentacion,
      cantidad: element.Cantidad
    });
  }

  const siguienteNumero = Number(NumeroCompEnvio) + 1;
  await renviosRepository.actualizarNumeroComprobante(pool, alias, siguienteNumero);

  return { compEnvio: CompEnvio, filas: dataArray.filter((e) => e.Cantidad > 0).length };
}

async function actualizarCompEnvio(pool, compEnvio, body) {
  const { CompVentas, FEnvio, Descripcion, Presentacion, Cantidad } = body;
  return renviosRepository.actualizarHistorial(pool, {
    compEnvio,
    compVentas: CompVentas,
    fEnvio: FEnvio,
    descripcion: Descripcion,
    presentacion: Presentacion,
    cantidad: Cantidad
  });
}

async function eliminarCompEnvio(pool, codicion) {
  return renviosRepository.eliminarPorCompEnvio(pool, codicion);
}

module.exports = {
  listarEnvios,
  obtenerPorCodigo,
  crearCompEnvio,
  actualizarCompEnvio,
  eliminarCompEnvio
};
