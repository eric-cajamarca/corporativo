const lotesRepository = require('../repositories/lotes.repository');

async function getAll(idEmpresa) {
        return await lotesRepository.getAll(idEmpresa);
}

async function getById(idLote) {
    return await lotesRepository.getById(idLote);
}

async function getBySucursal(idEmpresa, idSucursal) {
    return await lotesRepository.getBySucursal(idEmpresa, idSucursal);
}

async function create(loteData) {
    return await lotesRepository.create(loteData);
}

async function update(idLote, loteData) {
    return await lotesRepository.update(idLote, loteData);
}

async function deleted(idLote) {
    return await lotesRepository.deleted(idLote);
}

// Función crítica para ventas/compras
async function actualizarCantidadDisponible(idLote, cantidad, tipo) {
    const lote = await lotesRepository.getById(idLote);
    if (!lote) throw new Error('Lote no encontrado');
    
    const nuevaCantidad = tipo === 'INGRESO' 
        ? lote.cantidadDisponible + cantidad 
        : lote.cantidadDisponible - cantidad;
    
    if (nuevaCantidad < 0) throw new Error('Stock insuficiente');
    
    return await lotesRepository.actualizarCantidadDisponible(idLote, nuevaCantidad);
}

module.exports = {
    getAll,
    getById,
    getBySucursal,
    create,
    update,
    deleted,
    actualizarCantidadDisponible
};