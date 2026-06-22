const reservasRepository = require('../repositories/reservas.repository');
const hotelService = require('./hotel.service');
const { intervaloDesdeReserva } = require('../utils/hotelIntervalo.util');

const ESTADOS_VALIDOS = ['confirmada', 'cancelada', 'no_show', 'convertida'];

function normalizarEstado(estado) {
  const e = String(estado || 'confirmada').trim().toLowerCase();
  if (e === 'vigente') return 'confirmada';
  if (e === 'sin_efecto') return 'cancelada';
  return e;
}

async function validarFechasReserva(fechaEntrada, fechaSalida) {
  const a = new Date(String(fechaEntrada).slice(0, 10));
  const b = new Date(String(fechaSalida).slice(0, 10));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) {
    throw new Error('La fecha de salida debe ser posterior a la de entrada');
  }
}

async function validarSolapamientoReserva(pool, idEmpresa, body, excluirIdReserva = null) {
  const cfg = await hotelService.obtenerConfigInterno(pool, idEmpresa);
  const intervalo = intervaloDesdeReserva(body.fechaEntrada, body.fechaSalida, cfg);
  await hotelService.validarDisponibilidadIntervalo(pool, idEmpresa, body.idProductoHabitacion, intervalo, {
    excluirIdReserva
  });
}

async function listar(pool, idEmpresa, filtros = {}) {
    if (!idEmpresa) throw new Error('idEmpresa requerido');
    return reservasRepository.listar(pool, idEmpresa, filtros);
}

async function obtenerPorId(pool, idReserva, idEmpresa) {
    if (!idEmpresa) throw new Error('idEmpresa requerido');
    return reservasRepository.obtenerPorId(pool, idReserva, idEmpresa);
}

async function obtenerSiguienteCodigo(pool, idEmpresa) {
    if (!idEmpresa) throw new Error('idEmpresa requerido');
    return reservasRepository.siguienteCodigo(pool, idEmpresa);
}

async function crear(pool, idEmpresa, body, idUsuario = null) {
    if (!idEmpresa) throw new Error('idEmpresa requerido');
    if (!body?.idProductoHabitacion) throw new Error('Habitación (producto) es requerida');
    if (!body?.nombreHuesped?.trim()) throw new Error('Nombre del huésped es requerido');
    if (!body?.fechaEntrada || !body?.fechaSalida) throw new Error('Fechas de entrada y salida son requeridas');

    await validarFechasReserva(body.fechaEntrada, body.fechaSalida);
    await validarSolapamientoReserva(pool, idEmpresa, body);

    const codigo = body.codigo?.trim() || await reservasRepository.siguienteCodigo(pool, idEmpresa);
    const estado = normalizarEstado(body.estado || 'confirmada');
    if (estado !== 'confirmada') throw new Error('Al crear, la reserva debe quedar confirmada');

    const total = body.total != null ? Number(body.total) : 0;
    if (total < 0) throw new Error('El total no puede ser negativo');

    return reservasRepository.crear(pool, idEmpresa, {
        idProductoHabitacion: body.idProductoHabitacion,
        idCliente: body.idCliente || null,
        codigo,
        nombreHuesped: body.nombreHuesped.trim(),
        fechaEntrada: body.fechaEntrada,
        fechaSalida: body.fechaSalida,
        estado: 'confirmada',
        total,
        observaciones: body.observaciones?.trim() || null
    }, idUsuario);
}

async function actualizar(pool, idReserva, idEmpresa, body) {
    if (!idEmpresa) throw new Error('idEmpresa requerido');
    const reserva = await reservasRepository.obtenerPorId(pool, idReserva, idEmpresa);
    if (!reserva) throw new Error('Reserva no encontrada');
    if (reserva.estado === 'convertida') throw new Error('No se puede editar una reserva ya convertida a estancia');
    if (!body?.idProductoHabitacion) throw new Error('Habitación (producto) es requerida');
    if (!body?.nombreHuesped?.trim()) throw new Error('Nombre del huésped es requerido');
    if (!body?.fechaEntrada || !body?.fechaSalida) throw new Error('Fechas de entrada y salida son requeridas');

    await validarFechasReserva(body.fechaEntrada, body.fechaSalida);

    const payload = {
        idProductoHabitacion: body.idProductoHabitacion,
        fechaEntrada: body.fechaEntrada,
        fechaSalida: body.fechaSalida
    };
    await validarSolapamientoReserva(pool, idEmpresa, payload, idReserva);

    const estado = normalizarEstado(body.estado || reserva.estado);
    if (!ESTADOS_VALIDOS.includes(estado)) throw new Error('Estado de reserva no válido');
    if (estado === 'convertida') throw new Error('Use check-in para convertir la reserva');

    const total = body.total != null ? Number(body.total) : reserva.total;
    if (total < 0) throw new Error('El total no puede ser negativo');

    await reservasRepository.actualizar(pool, idReserva, idEmpresa, {
        idProductoHabitacion: body.idProductoHabitacion,
        idCliente: body.idCliente ?? reserva.idCliente,
        codigo: body.codigo?.trim() || reserva.codigo,
        nombreHuesped: body.nombreHuesped.trim(),
        fechaEntrada: body.fechaEntrada,
        fechaSalida: body.fechaSalida,
        estado,
        total,
        observaciones: body.observaciones?.trim() ?? reserva.observaciones
    });
}

async function cancelar(pool, idReserva, idEmpresa) {
    if (!idEmpresa) throw new Error('idEmpresa requerido');
    const reserva = await reservasRepository.obtenerPorId(pool, idReserva, idEmpresa);
    if (!reserva) throw new Error('Reserva no encontrada');
    if (reserva.estado !== 'confirmada') throw new Error('Solo se pueden cancelar reservas confirmadas');
    await reservasRepository.cancelar(pool, idReserva, idEmpresa);
}

async function eliminar(pool, idReserva, idEmpresa) {
    if (!idEmpresa) throw new Error('idEmpresa requerido');
    const reserva = await reservasRepository.obtenerPorId(pool, idReserva, idEmpresa);
    if (!reserva) throw new Error('Reserva no encontrada');
    if (reserva.estado === 'convertida') throw new Error('No se puede eliminar una reserva convertida');
    await reservasRepository.eliminar(pool, idReserva, idEmpresa);
}

module.exports = {
    listar,
    obtenerPorId,
    obtenerSiguienteCodigo,
    crear,
    actualizar,
    cancelar,
    eliminar
};
