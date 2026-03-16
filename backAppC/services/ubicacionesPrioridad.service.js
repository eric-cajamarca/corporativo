const ubicacionesPrioridadRepository = require('../repositories/ubicacionesPrioridad.repository');

async function getAll(idEmpresa) {
    return await ubicacionesPrioridadRepository.getAll(idEmpresa);
}

async function getBySucursal(idSucursal, idEmpresa) {
    return await ubicacionesPrioridadRepository.getBySucursal(idSucursal, idEmpresa);
}

async function create(ubicacionData, idEmpresa) {
    const idSucursal = ubicacionData?.idSucursal;
    if (!idEmpresa || !idSucursal) {
        throw new Error('Falta empresa o sucursal');
    }
    const pertenece = await ubicacionesPrioridadRepository.perteneceSucursalAEmpresa(idSucursal, idEmpresa);
    if (!pertenece) {
        throw new Error('La sucursal no pertenece a su empresa');
    }
    return await ubicacionesPrioridadRepository.create(ubicacionData);
}

async function update(idUbicacion, ubicacionData, idEmpresa) {
    if (!idEmpresa) throw new Error('No autorizado: falta empresa');
    const row = await ubicacionesPrioridadRepository.getByIdConEmpresa(idUbicacion);
    if (!row || String(row.idEmpresa) !== String(idEmpresa)) {
        throw new Error('Ubicación no encontrada o no pertenece a su empresa');
    }
    return await ubicacionesPrioridadRepository.update(idUbicacion, ubicacionData);
}

async function deleted(idUbicacion, idEmpresa) {
    if (!idEmpresa) throw new Error('No autorizado: falta empresa');
    const row = await ubicacionesPrioridadRepository.getByIdConEmpresa(idUbicacion);
    if (!row || String(row.idEmpresa) !== String(idEmpresa)) {
        throw new Error('Ubicación no encontrada o no pertenece a su empresa');
    }
    return await ubicacionesPrioridadRepository.deleted(idUbicacion);
}

module.exports = {
    getAll,
    getBySucursal,
    create,
    update,
    deleted
};