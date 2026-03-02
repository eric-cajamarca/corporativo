const sql = require('mssql');
const dbConfig = require('../dbconfig');
const grifoRepository = require('../repositories/grifo.repository');

async function listarTanques(idEmpresa) {
    const pool = await sql.connect(dbConfig);
    try {
        return await grifoRepository.listarTanques(pool, idEmpresa);
    } finally {
        if (pool.close) pool.close();
    }
}

async function actualizarTanque(idTanque, idEmpresa, datos) {
    const pool = await sql.connect(dbConfig);
    try {
        return await grifoRepository.actualizarTanque(pool, idTanque, idEmpresa, datos);
    } finally {
        if (pool.close) pool.close();
    }
}

async function crearTanque(idEmpresa, body) {
    const pool = await sql.connect(dbConfig);
    try {
        const { idProducto, idSucursal, capacidad, cantidadActual } = body || {};
        if (!idProducto) throw new Error('idProducto es requerido');
        return await grifoRepository.crearTanqueSiNoExiste(pool, idEmpresa, idProducto, idSucursal || null, capacidad || 0, cantidadActual || 0);
    } finally {
        if (pool.close) pool.close();
    }
}

function resumenGrifo(idEmpresa, fechaDesde, fechaHasta) {
    let fDesde = fechaDesde;
    let fHasta = fechaHasta;
    if (!fDesde || !fHasta) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        if (!fDesde) fDesde = `${y}-${m}-01T00:00:00`;
        if (!fHasta) fHasta = new Date(y, now.getMonth() + 1, 0).toISOString().slice(0, 10) + 'T23:59:59';
    }
    return sql.connect(dbConfig).then(pool => {
        return grifoRepository.resumenGrifo(pool, idEmpresa, fDesde, fHasta).finally(() => { if (pool.close) pool.close(); });
    });
}

async function listarProductosCombustibles(idEmpresa) {
    const pool = await sql.connect(dbConfig);
    try {
        return await grifoRepository.listarProductosCombustibles(pool, idEmpresa);
    } finally {
        if (pool.close) pool.close();
    }
}

module.exports = {
    listarTanques,
    actualizarTanque,
    crearTanque,
    resumenGrifo,
    listarProductosCombustibles
};
