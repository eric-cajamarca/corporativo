const consumoHabitacionRepository = require('../repositories/consumoHabitacion.repository');
const estanciasRepository = require('../repositories/estancias.repository');
const { parseFechaHoraClienteASQL } = require('../utils/fechaHoraLocal.util');

async function listarPorHabitacion(pool, idEmpresa, idProductoHabitacion) {
  return consumoHabitacionRepository.listarPorHabitacion(pool, idEmpresa, idProductoHabitacion);
}

async function listarPorEmpresa(pool, idEmpresa) {
  return consumoHabitacionRepository.listarPorEmpresa(pool, idEmpresa);
}

async function agregar(pool, idEmpresa, body, idUsuario) {
  if (!idEmpresa) throw new Error('idEmpresa requerido');
  if (!body?.idProductoHabitacion) throw new Error('Habitación es requerida');
  if (!body?.idProducto) throw new Error('Producto es requerido');
  const cantidad = Number(body.cantidad);
  if (isNaN(cantidad) || cantidad <= 0) throw new Error('Cantidad debe ser mayor a 0');
  const pUnitario = body.pUnitario != null ? Number(body.pUnitario) : 0;
  if (pUnitario < 0) throw new Error('Precio unitario no puede ser negativo');

  let idEstancia = body.idEstancia || null;
  if (!idEstancia) {
    const activa = await estanciasRepository.obtenerActivaPorHabitacion(pool, idEmpresa, body.idProductoHabitacion);
    if (!activa) throw new Error('No hay estancia activa en esta habitación. Haga check-in primero.');
    idEstancia = activa.idEstancia;
  }

  return consumoHabitacionRepository.agregar(pool, idEmpresa, {
    idProductoHabitacion: body.idProductoHabitacion,
    idEstancia,
    idProducto: body.idProducto,
    cantidad,
    pUnitario,
    fRegistro: parseFechaHoraClienteASQL(body.fRegistro || body.fechaHoraCliente)
  }, idUsuario);
}

async function eliminar(pool, idConsumo, idEmpresa) {
  if (!idEmpresa) throw new Error('idEmpresa requerido');
  const row = await consumoHabitacionRepository.obtenerPorId(pool, idConsumo, idEmpresa);
  if (!row) throw new Error('Consumo no encontrado');
  if (row.estadoConsumo === 'facturado') throw new Error('No se puede eliminar consumo ya facturado');
  return consumoHabitacionRepository.eliminar(pool, idConsumo, idEmpresa);
}

async function actualizar(pool, idConsumo, idEmpresa, body) {
  if (!idEmpresa) throw new Error('idEmpresa requerido');
  const row = await consumoHabitacionRepository.obtenerPorId(pool, idConsumo, idEmpresa);
  if (!row) throw new Error('Consumo no encontrado');
  if (row.estadoConsumo === 'facturado') throw new Error('No se puede editar consumo ya facturado');
  const cantidad = Number(body.cantidad);
  if (isNaN(cantidad) || cantidad <= 0) throw new Error('Cantidad debe ser mayor a 0');
  const pUnitario = body.pUnitario != null ? Number(body.pUnitario) : 0;
  if (pUnitario < 0) throw new Error('Precio unitario no puede ser negativo');
  await consumoHabitacionRepository.actualizar(pool, idConsumo, idEmpresa, { cantidad, pUnitario });
}

async function limpiarPorHabitacion(pool, idEmpresa, idProductoHabitacion) {
  if (!idEmpresa) throw new Error('idEmpresa requerido');
  const activa = await estanciasRepository.obtenerActivaPorHabitacion(pool, idEmpresa, idProductoHabitacion);
  if (activa) {
    return consumoHabitacionRepository.limpiarPendientesPorEstancia(pool, idEmpresa, activa.idEstancia);
  }
  return consumoHabitacionRepository.limpiarPorHabitacion(pool, idEmpresa, idProductoHabitacion);
}

module.exports = {
  listarPorHabitacion,
  listarPorEmpresa,
  agregar,
  actualizar,
  eliminar,
  limpiarPorHabitacion
};
