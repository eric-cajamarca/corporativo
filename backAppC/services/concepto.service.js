const conceptoRepository = require('../repositories/concepto.repository');

async function listar(pool, idEmpresa, query) {
    const buscar = query.buscar || null;
    const tipo = query.tipo || null;
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, parseInt(query.porPagina, 10) || 20));
    return conceptoRepository.listar(pool, { idEmpresa, buscar, tipo, pagina, porPagina });
}

async function obtenerPorId(pool, idConcepto, idEmpresa) {
    return conceptoRepository.obtenerPorId(pool, idConcepto, idEmpresa);
}

async function crear(pool, idEmpresa, body) {
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    const tipo = (body.tipo || '').toUpperCase();
    if (tipo !== 'INGRESO' && tipo !== 'EGRESO') throw new Error('El tipo debe ser INGRESO o EGRESO.');
    return conceptoRepository.crear(pool, {
        idEmpresa,
        descripcion,
        tipo,
        idClasificacionConcepto: body.idClasificacionConcepto || null,
        idTipoMovimientoCaja: body.idTipoMovimientoCaja ?? null
    });
}

async function actualizar(pool, idConcepto, idEmpresa, body) {
    const registro = await conceptoRepository.obtenerPorId(pool, idConcepto, idEmpresa);
    if (!registro) throw new Error('Concepto no encontrado.');
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    const tipo = (body.tipo || '').toUpperCase();
    if (tipo !== 'INGRESO' && tipo !== 'EGRESO') throw new Error('El tipo debe ser INGRESO o EGRESO.');
    await conceptoRepository.actualizar(pool, {
        idConcepto,
        idEmpresa,
        descripcion,
        tipo,
        idClasificacionConcepto: body.idClasificacionConcepto || null,
        idTipoMovimientoCaja: body.idTipoMovimientoCaja ?? null
    });
}

async function eliminar(pool, idConcepto, idEmpresa) {
    const registro = await conceptoRepository.obtenerPorId(pool, idConcepto, idEmpresa);
    if (!registro) throw new Error('Concepto no encontrado.');
    await conceptoRepository.eliminar(pool, idConcepto, idEmpresa);
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
