const motivoTrasladoRepository = require('../repositories/motivoTraslado.repository');

async function listarCodigosSunat(pool) {
    return motivoTrasladoRepository.listarCodigosSunat(pool);
}

async function listar(pool, idEmpresa, query) {
    const buscar = query.buscar || null;
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, parseInt(query.porPagina, 10) || 20));
    return motivoTrasladoRepository.listar(pool, { idEmpresa, buscar, pagina, porPagina });
}

async function obtenerPorId(pool, idMotivoTraslado, idEmpresa) {
    return motivoTrasladoRepository.obtenerPorId(pool, idMotivoTraslado, idEmpresa);
}

async function crear(pool, idEmpresa, body) {
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    return motivoTrasladoRepository.crear(pool, { idEmpresa, codigoSunat: body.codigoSunat, descripcion });
}

async function actualizar(pool, idMotivoTraslado, idEmpresa, body) {
    const registro = await motivoTrasladoRepository.obtenerPorId(pool, idMotivoTraslado, idEmpresa);
    if (!registro) throw new Error('Motivo de traslado no encontrado.');
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    await motivoTrasladoRepository.actualizar(pool, { idMotivoTraslado, idEmpresa, codigoSunat: body.codigoSunat, descripcion });
}

async function eliminar(pool, idMotivoTraslado, idEmpresa) {
    const registro = await motivoTrasladoRepository.obtenerPorId(pool, idMotivoTraslado, idEmpresa);
    if (!registro) throw new Error('Motivo de traslado no encontrado.');
    await motivoTrasladoRepository.eliminar(pool, idMotivoTraslado, idEmpresa);
}

module.exports = { listarCodigosSunat, listar, obtenerPorId, crear, actualizar, eliminar };
