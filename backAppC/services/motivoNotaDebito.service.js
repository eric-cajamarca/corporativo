const motivoNotaDebitoRepository = require('../repositories/motivoNotaDebito.repository');

// Códigos SUNAT Catálogo 10 - Motivos de nota de débito electrónica (catálogo global)
const CODIGOS_SUNAT_10 = ['01', '02', '03'];

function validarCodigoSunat(codigo) {
    const c = (codigo || '').trim();
    if (!c || c.length > 2) return false;
    const n = c.length === 1 ? '0' + c : c;
    return CODIGOS_SUNAT_10.includes(n);
}

async function listar(pool, query) {
    const buscar = query.buscar || null;
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, parseInt(query.porPagina, 10) || 20));
    return motivoNotaDebitoRepository.listar(pool, { buscar, pagina, porPagina });
}

async function obtenerPorId(pool, idMotivoNotaDebito) {
    return motivoNotaDebitoRepository.obtenerPorId(pool, idMotivoNotaDebito);
}

async function crear(pool, body) {
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    let codigoSunat = (body.codigoSunat || '').trim();
    if (codigoSunat.length === 1) codigoSunat = '0' + codigoSunat;
    if (!validarCodigoSunat(codigoSunat)) throw new Error('El código SUNAT debe ser un valor del Catálogo 10 (01-03).');
    const existente = await motivoNotaDebitoRepository.obtenerPorCodigo(pool, codigoSunat);
    if (existente) throw new Error(`Ya existe el motivo global con código ${codigoSunat}.`);
    return motivoNotaDebitoRepository.crear(pool, { codigoSunat, descripcion });
}

async function actualizar(pool, idMotivoNotaDebito, body) {
    const registro = await motivoNotaDebitoRepository.obtenerPorId(pool, idMotivoNotaDebito);
    if (!registro) throw new Error('Motivo de nota de débito no encontrado.');
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    let codigoSunat = (body.codigoSunat || '').trim();
    if (codigoSunat.length === 1) codigoSunat = '0' + codigoSunat;
    if (!validarCodigoSunat(codigoSunat)) throw new Error('El código SUNAT debe ser un valor del Catálogo 10 (01-03).');
    await motivoNotaDebitoRepository.actualizar(pool, { idMotivoNotaDebito, codigoSunat, descripcion });
}

async function eliminar(pool, idMotivoNotaDebito) {
    const registro = await motivoNotaDebitoRepository.obtenerPorId(pool, idMotivoNotaDebito);
    if (!registro) throw new Error('Motivo de nota de débito no encontrado.');
    await motivoNotaDebitoRepository.eliminar(pool, idMotivoNotaDebito);
}

function obtenerCodigosSunat() {
    return CODIGOS_SUNAT_10;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar, obtenerCodigosSunat, validarCodigoSunat };
