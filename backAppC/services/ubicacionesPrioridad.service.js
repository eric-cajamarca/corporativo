const ubicacionesPrioridadRepository = require('../repositories/ubicacionesPrioridad.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const sucursalRepository = require('../repositories/sucursal.repository');
const { withPool } = require('../utils/dbPool.util');
const { assertEmpresaAutorizada, idsEmpresaGestoraConsolidados } = require('../utils/empresaGestora.util');

async function getAll(idEmpresa) {
    return await ubicacionesPrioridadRepository.getAll(idEmpresa);
}

async function getBySucursal(idSucursal, idEmpresa) {
    return await ubicacionesPrioridadRepository.getBySucursal(idSucursal, idEmpresa);
}

async function getBySucursalAutorizado(idSucursal, idEmpresaJwt) {
  return withPool(async (pool) => {
    const idEmpresaSucursal = await sucursalRepository.obtenerEmpresaPorSucursal(pool, idSucursal);
    if (!idEmpresaSucursal) {
      throw new Error('Sucursal no encontrada');
    }
    await assertEmpresaAutorizada(pool, idEmpresaJwt, idEmpresaSucursal);
    return ubicacionesPrioridadRepository.getBySucursal(idSucursal, idEmpresaSucursal);
  });
}

async function listarCodigosConsolidados(idEmpresaJwt, query = {}) {
  return withPool(async (pool) => {
    const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaJwt);
    const idsGestionadas = (gestionadas || []).map((e) => e.idEmpresa).filter(Boolean);
    const rawEmpresa =
      query && query.idEmpresa != null && String(query.idEmpresa).trim() !== ''
        ? String(query.idEmpresa).trim()
        : '';
    const modo = query && query.modo ? String(query.modo).trim().toLowerCase() : '';

    if (rawEmpresa) {
      await assertEmpresaAutorizada(pool, idEmpresaJwt, rawEmpresa);
      return ubicacionesPrioridadRepository.listarCodigosConsolidados(pool, [rawEmpresa]);
    }

    if (idsGestionadas.length > 0 && (modo === 'interseccion' || modo === '')) {
      return ubicacionesPrioridadRepository.listarCodigosInterseccion(pool, idsGestionadas);
    }

    const ids = await idsEmpresaGestoraConsolidados(pool, idEmpresaJwt);
    return ubicacionesPrioridadRepository.listarCodigosConsolidados(pool, ids);
  });
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
    getBySucursalAutorizado,
    listarCodigosConsolidados,
    create,
    update,
    deleted
};