const motivoNotaCreditoRepository = require('../repositories/motivoNotaCredito.repository');

// Códigos SUNAT Catálogo 09 - Motivos de nota de crédito electrónica
const CODIGOS_SUNAT_09 = [
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'
];

function validarCodigoSunat(codigo) {
    const c = (codigo || '').trim();
    if (!c || c.length > 2) return false;
    const n = c.length === 1 ? '0' + c : c;
    return CODIGOS_SUNAT_09.includes(n);
}

async function listar(pool, idEmpresa, query) {
    const buscar = query.buscar || null;
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, parseInt(query.porPagina, 10) || 20));
    return motivoNotaCreditoRepository.listar(pool, { idEmpresa, buscar, pagina, porPagina });
}

async function obtenerPorId(pool, idMotivoNotaCredito, idEmpresa) {
    return motivoNotaCreditoRepository.obtenerPorId(pool, idMotivoNotaCredito, idEmpresa);
}

async function crear(pool, idEmpresa, body) {
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    let codigoSunat = (body.codigoSunat || '').trim();
    if (codigoSunat.length === 1) codigoSunat = '0' + codigoSunat;
    if (!validarCodigoSunat(codigoSunat)) throw new Error('El código SUNAT debe ser un valor del Catálogo 09 (01-13).');
    return motivoNotaCreditoRepository.crear(pool, { idEmpresa, codigoSunat, descripcion });
}

async function actualizar(pool, idMotivoNotaCredito, idEmpresa, body) {
    const registro = await motivoNotaCreditoRepository.obtenerPorId(pool, idMotivoNotaCredito, idEmpresa);
    if (!registro) throw new Error('Motivo de nota de crédito no encontrado.');
    const descripcion = (body.descripcion || '').trim();
    if (!descripcion) throw new Error('La descripción es obligatoria.');
    let codigoSunat = (body.codigoSunat || '').trim();
    if (codigoSunat.length === 1) codigoSunat = '0' + codigoSunat;
    if (!validarCodigoSunat(codigoSunat)) throw new Error('El código SUNAT debe ser un valor del Catálogo 09 (01-13).');
    await motivoNotaCreditoRepository.actualizar(pool, { idMotivoNotaCredito, idEmpresa, codigoSunat, descripcion });
}

async function eliminar(pool, idMotivoNotaCredito, idEmpresa) {
    const registro = await motivoNotaCreditoRepository.obtenerPorId(pool, idMotivoNotaCredito, idEmpresa);
    if (!registro) throw new Error('Motivo de nota de crédito no encontrado.');
    await motivoNotaCreditoRepository.eliminar(pool, idMotivoNotaCredito, idEmpresa);
}

function obtenerCodigosSunat() {
    return CODIGOS_SUNAT_09;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar, obtenerCodigosSunat };
