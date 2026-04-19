const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');

async function getAll(idEmpresa) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
            SELECT 
                l.idLote, 
                l.idEmpresa, 
                l.idProducto, 
                l.idSucursal, 
                l.numeroLote,
                l.costoUnitario, 
                l.cantidadIngresada, 
                l.cantidadDisponible,
                CONVERT(VARCHAR(19), l.fechaIngreso, 120) AS fechaIngreso,
                p.descripcion AS nombreProducto,
                s.nombre AS nombreSucursal
            FROM Lotes l
            LEFT JOIN Productos p ON l.idProducto = p.idProducto
            LEFT JOIN Sucursal s ON l.idSucursal = s.idSucursal
            WHERE l.idEmpresa = @idEmpresa 
            ORDER BY l.fechaIngreso DESC
        `);
    return result.recordset;
  });
}

async function getById(idLote) {
  return withPool(async (pool) => {
    try {
      const result = await pool.request()
        .input('idLote', sql.UniqueIdentifier, idLote)
        .query(`
                SELECT 
                    idLote, 
                    idEmpresa, 
                    idProducto, 
                    idSucursal, 
                    CONVERT(DECIMAL(18,6), costoUnitario) AS costoUnitario,
                    CONVERT(DECIMAL(18,2), cantidadIngresada) AS cantidadIngresada,
                    CONVERT(DECIMAL(18,2), cantidadDisponible) AS cantidadDisponible
                FROM Lotes 
                WHERE idLote = @idLote
            `);
      const row = result.recordset && result.recordset[0];
      if (!row) return null;
      return {
        idLote: row.idLote,
        idEmpresa: row.idEmpresa,
        idProducto: row.idProducto,
        idSucursal: row.idSucursal,
        costoUnitario: row.costoUnitario != null ? Number(row.costoUnitario) : 0,
        cantidadIngresada: row.cantidadIngresada != null ? Number(row.cantidadIngresada) : 0,
        cantidadDisponible: row.cantidadDisponible != null ? Number(row.cantidadDisponible) : 0
      };
    } catch (err) {
      console.error('lotes.repository getById error:', err.message);
      throw err;
    }
  });
}

async function getBySucursal(idEmpresa, idSucursal) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idSucursal', sql.UniqueIdentifier, idSucursal)
      .query('SELECT * FROM Lotes WHERE idEmpresa = @idEmpresa AND idSucursal = @idSucursal');
    return result.recordset;
  });
}

async function create(loteData) {
  const { idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible } = loteData;

  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('idSucursal', sql.UniqueIdentifier, idSucursal)
      .input('costoUnitario', sql.Decimal(18, 6), costoUnitario)
      .input('cantidadIngresada', sql.Int, cantidadIngresada)
      .input('cantidadDisponible', sql.Int, cantidadDisponible)
      .query(`INSERT INTO Lotes (idLote, idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible)
                VALUES (NEWID(), @idEmpresa, @idProducto, @idSucursal, @costoUnitario, @cantidadIngresada, @cantidadDisponible)`);
    return result;
  });
}

async function update(idLote, loteData) {
  const { costoUnitario, cantidadDisponible } = loteData;

  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('costoUnitario', sql.Decimal(18, 6), costoUnitario)
      .input('cantidadDisponible', sql.Int, cantidadDisponible)
      .query('UPDATE Lotes SET costoUnitario = @costoUnitario, cantidadDisponible = @cantidadDisponible WHERE idLote = @idLote');
    return result;
  });
}

async function deleted(idLote) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .query('DELETE FROM Lotes WHERE idLote = @idLote');
    return result;
  });
}

async function actualizarCantidadDisponible(idLote, nuevaCantidad) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('nuevaCantidad', sql.Int, nuevaCantidad)
      .query('UPDATE Lotes SET cantidadDisponible = @nuevaCantidad WHERE idLote = @idLote');
    return result;
  });
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
