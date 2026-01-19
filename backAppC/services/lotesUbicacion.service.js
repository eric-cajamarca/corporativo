const lotesUbicacionRepository = require('../repositories/lotesUbicacion.repository');

async function getByLote(idLote) {
    return await lotesUbicacionRepository.getByLote(idLote);
}

async function getByUbicacion(idUbicacion) {
    return await lotesUbicacionRepository.getByUbicacion(idUbicacion);
}

async function create(idLote, idUbicacion, cantidad) {
    return await lotesUbicacionRepository.create(idLote, idUbicacion, cantidad);
}

async function updateCantidad(idLote, idUbicacion, cantidad) {
    return await lotesUbicacionRepository.updateCantidad(idLote, idUbicacion, cantidad);
}

async function deleted(idLote, idUbicacion) {
    return await lotesUbicacionRepository.delete(idLote, idUbicacion);
}

// Función para aplicar reglas de prioridad en ventas
async function aplicarDescuentoPorPrioridad(idProducto, idSucursal, cantidadVender) {
    const ubicaciones = await lotesUbicacionRepository.getUbicacionesDisponiblesPrioridad(idProducto, idSucursal);
    let cantidadRestante = cantidadVender;
    const movimientos = [];

    for (const ubicacion of ubicaciones) {
        if (cantidadRestante <= 0) break;
        
        const cantidadTomar = Math.min(cantidadRestante, ubicacion.cantidad);
        movimientos.push({
            idLote: ubicacion.idLote,
            idUbicacion: ubicacion.idUbicacion,
            cantidad: cantidadTomar
        });
        
        cantidadRestante -= cantidadTomar;
    }

    if (cantidadRestante > 0) {
        throw new Error('Stock insuficiente en todas las ubicaciones');
    }

    return movimientos;
}

module.exports = {
    getByLote,
    getByUbicacion,
    create,
    updateCantidad,
    deleted,
    aplicarDescuentoPorPrioridad
};