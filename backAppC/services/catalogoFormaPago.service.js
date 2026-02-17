const catalogoFormaPagoRepository = require('../repositories/catalogoFormaPago.repository');

const TIPOS_VALIDOS = ['EFECTIVO', 'DIGITAL', 'BANCARIO', 'TARJETA'];

async function listar(pool, query) {
    const buscar = query.buscar || null;
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, parseInt(query.porPagina, 10) || 20));
    return catalogoFormaPagoRepository.listar(pool, { buscar, pagina, porPagina });
}

async function obtenerPorId(pool, idFormaPago) {
    const id = parseInt(idFormaPago, 10);
    if (Number.isNaN(id)) throw new Error('ID inválido.');
    return catalogoFormaPagoRepository.obtenerPorId(pool, id);
}

async function crear(pool, body) {
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    const tipo = (body.tipo || 'EFECTIVO').toUpperCase();
    if (!TIPOS_VALIDOS.includes(tipo)) throw new Error('El tipo debe ser: EFECTIVO, DIGITAL, BANCARIO o TARJETA.');
    return catalogoFormaPagoRepository.crear(pool, {
        descripcion,
        tipo,
        requiereReferencia: body.requiereReferencia === true || body.requiereReferencia === 1,
        activo: body.activo !== false
    });
}

async function actualizar(pool, idFormaPago, body) {
    const id = parseInt(idFormaPago, 10);
    if (Number.isNaN(id)) throw new Error('ID inválido.');
    const registro = await catalogoFormaPagoRepository.obtenerPorId(pool, id);
    if (!registro) throw new Error('Forma de pago no encontrada.');
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    const tipo = (body.tipo || 'EFECTIVO').toUpperCase();
    if (!TIPOS_VALIDOS.includes(tipo)) throw new Error('El tipo debe ser: EFECTIVO, DIGITAL, BANCARIO o TARJETA.');
    await catalogoFormaPagoRepository.actualizar(pool, {
        idFormaPago: id,
        descripcion,
        tipo,
        requiereReferencia: body.requiereReferencia === true || body.requiereReferencia === 1,
        activo: body.activo !== false
    });
}

async function eliminar(pool, idFormaPago) {
    const id = parseInt(idFormaPago, 10);
    if (Number.isNaN(id)) throw new Error('ID inválido.');
    const registro = await catalogoFormaPagoRepository.obtenerPorId(pool, id);
    if (!registro) throw new Error('Forma de pago no encontrada.');
    await catalogoFormaPagoRepository.eliminar(pool, id);
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
