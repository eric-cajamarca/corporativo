const ubicacionesPrioridadRepository = require('../repositories/ubicacionesPrioridad.repository');

async function getAll(idEmpresa) {
    return await ubicacionesPrioridadRepository.getAll(idEmpresa);
}

async function getBySucursal(idSucursal, idEmpresa) {
    return await ubicacionesPrioridadRepository.getBySucursal(idSucursal, idEmpresa);
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