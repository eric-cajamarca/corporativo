const motivoNotaCreditoRepository = require('../repositories/motivoNotaCredito.repository');

// Códigos SUNAT Catálogo 09 - Motivos de nota de crédito electrónica (catálogo global)
const CODIGOS_SUNAT_09 = [
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'
];

function validarCodigoSunat(codigo) {
    const c = (codigo || '').trim();
    if (!c || c.length > 2) return false;
    const n = c.length === 1 ? '0' + c : c;
    return CODIGOS_SUNAT_09.includes(n);
}

async function listar(pool, query) {
    const buscar = query.buscar || null;
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, parseInt(query.porPagina, 10) || 20));
    return motivoNotaCreditoRepository.listar(pool, { buscar, pagina, porPagina });
}

async function obtenerPorId(pool, idMotivoNotaCredito) {
    return motivoNotaCreditoRepository.obtenerPorId(pool, idMotivoNotaCredito);
}

async function crear(pool, body) {
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    let codigoSunat = (body.codigoSunat || '').trim();
    if (codigoSunat.length === 1) codigoSunat = '0' + codigoSunat;
    if (!validarCodigoSunat(codigoSunat)) throw new Error('El código SUNAT debe ser un valor del Catálogo 09 (01-13).');
    const existente = await motivoNotaCreditoRepository.obtenerPorCodigo(pool, codigoSunat);
    if (existente) throw new Error(`Ya existe el motivo global con código ${codigoSunat}.`);
    return motivoNotaCreditoRepository.crear(pool, { codigoSunat, descripcion });
}

async function actualizar(pool, idMotivoNotaCredito, body) {
    const registro = await motivoNotaCreditoRepository.obtenerPorId(pool, idMotivoNotaCredito);
    if (!registro) throw new Error('Motivo de nota de crédito no encontrado.');
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    let codigoSunat = (body.codigoSunat || '').trim();
    if (codigoSunat.length === 1) codigoSunat = '0' + codigoSunat;
    if (!validarCodigoSunat(codigoSunat)) throw new Error('El código SUNAT debe ser un valor del Catálogo 09 (01-13).');
    await motivoNotaCreditoRepository.actualizar(pool, { idMotivoNotaCredito, codigoSunat, descripcion });
}

async function eliminar(pool, idMotivoNotaCredito) {
    const registro = await motivoNotaCreditoRepository.obtenerPorId(pool, idMotivoNotaCredito);
    if (!registro) throw new Error('Motivo de nota de crédito no encontrado.');
    await motivoNotaCreditoRepository.eliminar(pool, idMotivoNotaCredito);
}

function obtenerCodigosSunat() {
    return CODIGOS_SUNAT_09;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar, obtenerCodigosSunat };
