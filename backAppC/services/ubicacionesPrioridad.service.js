const ubicacionesPrioridadRepository = require('../repositories/ubicacionesPrioridad.repository');

async function getAll() {
    return await ubicacionesPrioridadRepository.getAll();
}

async function getBySucursal(idSucursal) {
    return await ubicacionesPrioridadRepository.getBySucursal(idSucursal);
}

async function create(ubicacionData) {
    return await ubicacionesPrioridadRepository.create(ubicacionData);
}

async function update(idUbicacion, ubicacionData) {
    return await ubicacionesPrioridadRepository.update(idUbicacion, ubicacionData);
}

async function deleted(idUbicacion) {
    return await ubicacionesPrioridadRepository.deleted(idUbicacion);
}

module.exports = {
    getAll,
    getBySucursal,
    create,
    update,
    deleted
};