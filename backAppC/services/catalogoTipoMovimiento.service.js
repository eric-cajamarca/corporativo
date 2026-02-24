const catalogoTipoMovimientoRepository = require('../repositories/catalogoTipoMovimiento.repository');

async function listar(pool, query = {}) {
    const buscar = (query.buscar || '').trim() || null;
    return catalogoTipoMovimientoRepository.listar(pool, { buscar });
}

async function obtenerPorId(pool, idTipoMovimientoCaja) {
    const id = parseInt(idTipoMovimientoCaja, 10);
    if (Number.isNaN(id)) throw new Error('ID de tipo de movimiento inválido.');
    return catalogoTipoMovimientoRepository.obtenerPorId(pool, id);
}

async function crear(pool, body) {
    const nombre = (body.nombre || '').trim();
    if (!nombre) throw new Error('El nombre es obligatorio.');
    if (nombre.length > 30) throw new Error('El nombre no puede superar 30 caracteres.');
    const tipo = (body.tipo || '').toUpperCase().substring(0, 1);
    if (tipo !== 'I' && tipo !== 'E') throw new Error('El tipo debe ser I (Ingreso) o E (Egreso).');
    return catalogoTipoMovimientoRepository.crear(pool, {
        nombre,
        descripcion: (body.descripcion || '').trim() || null,
        tipo
    });
}

async function actualizar(pool, idTipoMovimientoCaja, body) {
    const id = parseInt(idTipoMovimientoCaja, 10);
    if (Number.isNaN(id)) throw new Error('ID de tipo de movimiento inválido.');
    const registro = await catalogoTipoMovimientoRepository.obtenerPorId(pool, id);
    if (!registro) throw new Error('Tipo de movimiento no encontrado.');
    const nombre = (body.nombre || '').trim();
    if (!nombre) throw new Error('El nombre es obligatorio.');
    if (nombre.length > 30) throw new Error('El nombre no puede superar 30 caracteres.');
    const tipo = (body.tipo || '').toUpperCase().substring(0, 1);
    if (tipo !== 'I' && tipo !== 'E') throw new Error('El tipo debe ser I (Ingreso) o E (Egreso).');
    await catalogoTipoMovimientoRepository.actualizar(pool, {
        idTipoMovimientoCaja: id,
        nombre,
        descripcion: (body.descripcion || '').trim() || null,
        tipo
    });
}

async function eliminar(pool, idTipoMovimientoCaja) {
    const id = parseInt(idTipoMovimientoCaja, 10);
    if (Number.isNaN(id)) throw new Error('ID de tipo de movimiento inválido.');
    const registro = await catalogoTipoMovimientoRepository.obtenerPorId(pool, id);
    if (!registro) throw new Error('Tipo de movimiento no encontrado.');
    await catalogoTipoMovimientoRepository.eliminar(pool, id);
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
