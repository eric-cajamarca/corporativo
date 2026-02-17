const clasificacionConceptoRepository = require('../repositories/clasificacionConcepto.repository');

async function listar(pool, idEmpresa, query) {
    const buscar = query.buscar || null;
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, parseInt(query.porPagina, 10) || 20));
    return clasificacionConceptoRepository.listar(pool, { idEmpresa, buscar, pagina, porPagina });
}

async function obtenerPorId(pool, idClasificacionConcepto, idEmpresa) {
    return clasificacionConceptoRepository.obtenerPorId(pool, idClasificacionConcepto, idEmpresa);
}

async function crear(pool, idEmpresa, body) {
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    return clasificacionConceptoRepository.crear(pool, { idEmpresa, descripcion });
}

async function actualizar(pool, idClasificacionConcepto, idEmpresa, body) {
    const registro = await clasificacionConceptoRepository.obtenerPorId(pool, idClasificacionConcepto, idEmpresa);
    if (!registro) throw new Error('Clasificación no encontrada.');
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    await clasificacionConceptoRepository.actualizar(pool, { idClasificacionConcepto, idEmpresa, descripcion });
}

async function eliminar(pool, idClasificacionConcepto, idEmpresa) {
    const registro = await clasificacionConceptoRepository.obtenerPorId(pool, idClasificacionConcepto, idEmpresa);
    if (!registro) throw new Error('Clasificación no encontrada.');
    await clasificacionConceptoRepository.eliminar(pool, idClasificacionConcepto, idEmpresa);
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
