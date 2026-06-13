const reservasRepository = require('../repositories/reservas.repository');

function validarFechasReserva(fechaEntrada, fechaSalida) {
    const entrada = new Date(String(fechaEntrada).slice(0, 10));
    const salida = new Date(String(fechaSalida).slice(0, 10));
    if (Number.isNaN(entrada.getTime()) || Number.isNaN(salida.getTime())) {
        throw new Error('Fechas de entrada o salida no válidas');
    }
    if (salida <= entrada) {
        throw new Error('La fecha de salida debe ser posterior a la fecha de entrada');
    }
}

async function validarSolapamiento(pool, idEmpresa, payload, excluirIdReserva = null) {
    const solapa = await reservasRepository.existeSolapamiento(
        pool,
        idEmpresa,
        payload.idProductoHabitacion,
        payload.fechaEntrada,
        payload.fechaSalida,
        excluirIdReserva
    );
    if (solapa) {
        throw new Error('Ya existe una reserva vigente que se solapa con las fechas indicadas para esta habitación');
    }
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

    validarFechasReserva(body.fechaEntrada, body.fechaSalida);

    const codigo = body.codigo?.trim() || await reservasRepository.siguienteCodigo(pool, idEmpresa);
    const estado = body.estado || 'vigente';
    const estadosValidos = ['vigente', 'sin_efecto'];
    if (!estadosValidos.includes(estado)) throw new Error('Estado de reserva no válido');

    const total = body.total != null ? Number(body.total) : 0;
    if (total < 0) throw new Error('El total no puede ser negativo');

    if (estado === 'vigente') {
        await validarSolapamiento(pool, idEmpresa, body);
    }

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

    validarFechasReserva(body.fechaEntrada, body.fechaSalida);

    const estado = body.estado || reserva.estado;
    const estadosValidos = ['vigente', 'sin_efecto'];
    if (!estadosValidos.includes(estado)) throw new Error('Estado de reserva no válido');
    const total = body.total != null ? Number(body.total) : reserva.total;
    if (total < 0) throw new Error('El total no puede ser negativo');

    if (estado === 'vigente') {
        await validarSolapamiento(pool, idEmpresa, {
            idProductoHabitacion: body.idProductoHabitacion,
            fechaEntrada: body.fechaEntrada,
            fechaSalida: body.fechaSalida
        }, idReserva);
    }

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

async function cerrarPostVenta(pool, idEmpresa, body) {
    if (!idEmpresa) throw new Error('idEmpresa requerido');
    if (!body?.idProductoHabitacion) throw new Error('Habitación requerida');
    const idVenta = Number(body.idVenta);
    if (!Number.isFinite(idVenta) || idVenta <= 0) throw new Error('idVenta inválido');

    await reservasRepository.cerrarPostVenta(pool, idEmpresa, {
        idProductoHabitacion: body.idProductoHabitacion,
        idVenta,
        idReserva: body.idReserva || null
    });
}

module.exports = {
    listar,
    obtenerPorId,
    obtenerSiguienteCodigo,
    crear,
    actualizar,
    eliminar,
    cerrarPostVenta
};
