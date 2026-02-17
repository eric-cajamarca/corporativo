const catalogoTipoMovimientoRepository = require('../repositories/catalogoTipoMovimiento.repository');

async function listar(pool, idEmpresa, query) {
    const buscar = query.buscar || null;
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, parseInt(query.porPagina, 10) || 20));
    return catalogoTipoMovimientoRepository.listar(pool, { idEmpresa, buscar, pagina, porPagina });
}

async function obtenerPorId(pool, idTipoMovimiento, idEmpresa) {
    return catalogoTipoMovimientoRepository.obtenerPorId(pool, idTipoMovimiento, idEmpresa);
}

async function crear(pool, idEmpresa, body) {
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    const tipo = (body.tipo || '').toUpperCase();
    if (tipo !== 'INGRESO' && tipo !== 'SALIDA') throw new Error('El tipo debe ser INGRESO o SALIDA.');
    return catalogoTipoMovimientoRepository.crear(pool, {
        idEmpresa,
        descripcion,
        tipo,
        descripcionCorta: (body.descripcionCorta || '').trim() || null
    });
}

async function actualizar(pool, idTipoMovimiento, idEmpresa, body) {
    const registro = await catalogoTipoMovimientoRepository.obtenerPorId(pool, idTipoMovimiento, idEmpresa);
    if (!registro) throw new Error('Tipo de movimiento no encontrado.');
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    const tipo = (body.tipo || '').toUpperCase();
    if (tipo !== 'INGRESO' && tipo !== 'SALIDA') throw new Error('El tipo debe ser INGRESO o SALIDA.');
    await catalogoTipoMovimientoRepository.actualizar(pool, {
        idTipoMovimiento,
        idEmpresa,
        descripcion,
        tipo,
        descripcionCorta: (body.descripcionCorta || '').trim() || null
    });
}

async function eliminar(pool, idTipoMovimiento, idEmpresa) {
    const registro = await catalogoTipoMovimientoRepository.obtenerPorId(pool, idTipoMovimiento, idEmpresa);
    if (!registro) throw new Error('Tipo de movimiento no encontrado.');
    await catalogoTipoMovimientoRepository.eliminar(pool, idTipoMovimiento, idEmpresa);
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
