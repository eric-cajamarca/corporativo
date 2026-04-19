const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');

async function getByLote(idLote) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .query(`SELECT lu.*, up.codigoUbicacion, up.prioridad 
                FROM LotesUbicacion lu
                JOIN UbicacionesPrioridad up ON lu.idUbicacion = up.idUbicacion
                WHERE lu.idLote = @idLote`);
    return result.recordset;
  });
}

async function getByUbicacion(idUbicacion) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idUbicacion', sql.Int, idUbicacion)
      .query(`SELECT lu.*, l.idProducto, l.costoUnitario 
                FROM LotesUbicacion lu
                JOIN Lotes l ON lu.idLote = l.idLote
                WHERE lu.idUbicacion = @idUbicacion`);
    return result.recordset;
  });
}

async function create(idLote, idUbicacion, cantidad) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idUbicacion', sql.Int, idUbicacion)
      .input('cantidad', sql.Int, cantidad)
      .query('INSERT INTO LotesUbicacion (idLote, idUbicacion, cantidad) VALUES (@idLote, @idUbicacion, @cantidad)');
    return result;
  });
}

async function updateCantidad(idLote, idUbicacion, cantidad) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idUbicacion', sql.Int, idUbicacion)
      .input('cantidad', sql.Int, cantidad)
      .query('UPDATE LotesUbicacion SET cantidad = @cantidad WHERE idLote = @idLote AND idUbicacion = @idUbicacion');
    return result;
  });
}

async function deleted(idLote, idUbicacion) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idUbicacion', sql.Int, idUbicacion)
      .query('DELETE FROM LotesUbicacion WHERE idLote = @idLote AND idUbicacion = @idUbicacion');
    return result;
  });
}

async function getUbicacionesDisponiblesPrioridad(idProducto, idSucursal) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('idSucursal', sql.UniqueIdentifier, idSucursal)
      .query(`SELECT 
                    l.idLote, 
                    lu.idUbicacion, 
                    up.codigoUbicacion, 
                    up.prioridad,
                    lu.cantidad,
                    l.costoUnitario
                FROM Lotes l
                JOIN LotesUbicacion lu ON l.idLote = lu.idLote
                JOIN UbicacionesPrioridad up ON lu.idUbicacion = up.idUbicacion
                WHERE l.idProducto = @idProducto 
                  AND l.idSucursal = @idSucursal
                  AND l.cantidadDisponible > 0
                  AND lu.cantidad > 0
                ORDER BY up.prioridad ASC`);
    return result.recordset;
  });
}

module.exports = {
  getByLote,
  getByUbicacion,
  create,
  updateCantidad,
  deleted,
  getUbicacionesDisponiblesPrioridad
};
