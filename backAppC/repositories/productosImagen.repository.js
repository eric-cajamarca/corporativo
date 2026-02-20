const sql = require('mssql');

/**
 * Lista imágenes de un producto por idEmpresa e idProducto, ordenadas por orden.
 */
exports.listarPorProducto = async (pool, idEmpresa, idProducto) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT idImagen, idEmpresa, idProducto, rutaArchivo, orden,
        CONVERT(VARCHAR(19), fRegistro, 120) AS fRegistro
      FROM ProductosImagen
      WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto
      ORDER BY orden ASC
    `);
  return result.recordset || [];
};

/**
 * Inserta una imagen de producto. rutaArchivo es relativa (ej: idEmpresa/idProducto/img-xxx.jpg).
 */
exports.insertar = async (pool, idEmpresa, idProducto, rutaArchivo, orden) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('rutaArchivo', sql.VarChar(255), rutaArchivo)
    .input('orden', sql.TinyInt, orden)
    .query(`
      INSERT INTO ProductosImagen (idEmpresa, idProducto, rutaArchivo, orden)
      OUTPUT INSERTED.idImagen
      VALUES (@idEmpresa, @idProducto, @rutaArchivo, @orden)
    `);
  return result.recordset && result.recordset[0] ? result.recordset[0].idImagen : null;
};

/**
 * Elimina una imagen por idImagen; solo si pertenece a idEmpresa.
 */
exports.eliminar = async (pool, idImagen, idEmpresa) => {
  const result = await pool
    .request()
    .input('idImagen', sql.UniqueIdentifier, idImagen)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      DELETE FROM ProductosImagen
      WHERE idImagen = @idImagen AND idEmpresa = @idEmpresa
    `);
  return (result.rowsAffected && result.rowsAffected[0]) || 0;
};

/**
 * Obtiene un registro de imagen por idImagen (para leer rutaArchivo antes de borrar archivo).
 */
exports.obtenerPorId = async (pool, idImagen, idEmpresa) => {
  const result = await pool
    .request()
    .input('idImagen', sql.UniqueIdentifier, idImagen)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idImagen, idEmpresa, idProducto, rutaArchivo, orden
      FROM ProductosImagen
      WHERE idImagen = @idImagen AND idEmpresa = @idEmpresa
    `);
  return result.recordset && result.recordset[0] ? result.recordset[0] : null;
};

/**
 * Cuenta imágenes de un producto (para validar máximo).
 */
exports.contarPorProducto = async (pool, idProducto) => {
  const result = await pool
    .request()
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT COUNT(*) AS total FROM ProductosImagen WHERE idProducto = @idProducto
    `);
  return (result.recordset && result.recordset[0] && result.recordset[0].total) || 0;
};
