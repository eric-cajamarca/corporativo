const reservasRepository = require('../repositories/reservas.repository');

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

    const codigo = body.codigo?.trim() || await reservasRepository.siguienteCodigo(pool, idEmpresa);
    const estado = body.estado || 'vigente';
    const estadosValidos = ['vigente', 'sin_efecto'];
    if (!estadosValidos.includes(estado)) throw new Error('Estado de reserva no válido');

    const total = body.total != null ? Number(body.total) : 0;
    if (total < 0) throw new Error('El total no puede ser negativo');

    return reservasRepository.crear(pool, idEmpresa, {
        idProductoHabitacion: body.idProductoHabitacion,
        idCliente: body.idCliente || null,
        codigo,
        nombreHuesped: body.nombreHuesped.trim(),
        fechaEntrada: body.fechaEntrada,
        fechaSalida: body.fechaSalida,
        estado,
        total,
        observaciones: body.observaciones?.trim() || null
    }, idUsuario);
}

async function actualizar(pool, idReserva, idEmpresa, body) {
    if (!idEmpresa) throw new Error('idEmpresa requerido');
    const reserva = await reservasRepository.obtenerPorId(pool, idReserva, idEmpresa);
    if (!reserva) throw new Error('Reserva no encontrada');
    if (!body?.idProductoHabitacion) throw new Error('Habitación (producto) es requerida');
    if (!body?.nombreHuesped?.trim()) throw new Error('Nombre del huésped es requerido');
    if (!body?.fechaEntrada || !body?.fechaSalida) throw new Error('Fechas de entrada y salida son requeridas');
    const estado = body.estado || reserva.estado;
    const estadosValidos = ['vigente', 'sin_efecto'];
    if (!estadosValidos.includes(estado)) throw new Error('Estado de reserva no válido');
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

async function eliminar(pool, idReserva, idEmpresa) {
    if (!idEmpresa) throw new Error('idEmpresa requerido');
    const reserva = await reservasRepository.obtenerPorId(pool, idReserva, idEmpresa);
    if (!reserva) throw new Error('Reserva no encontrada');
    await reservasRepository.eliminar(pool, idReserva, idEmpresa);
}

module.exports = {
    listar,
    obtenerPorId,
    obtenerSiguienteCodigo,
    crear,
    actualizar,
    eliminar
};
