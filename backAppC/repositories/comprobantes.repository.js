const sql = require('mssql');

exports.obtenerComprobantePorIdEmpresa = async (pool, idEmpresa, idComprobante) => {
  try {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idComprobante', sql.Int, idComprobante)
      .query(`
        SELECT TOP 1 idComprobante, idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra
        FROM Comprobantes
        WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante
      `);
    return result;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};

exports.actualizarNumeroComprobante = async (pool, idEmpresa, idComprobante, numero) => {
  try {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idComprobante', sql.Int, idComprobante)
      .input('numero', sql.Int, numero)
      .query(`
        UPDATE Comprobantes
        SET numero = @numero
        WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante
      `);
    return result;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};

/**
 * Asegura el comprobante Venta Agrupada (VA) para la empresa gestora.
 */
exports.insertarComprobanteVentaAgrupadaSiNoExiste = async (pool, idEmpresa) => {
  try {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM Comprobantes
          WHERE idEmpresa = @idEmpresa AND codigo = 'VA'
        )
        BEGIN
          INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
          VALUES (@idEmpresa, 'VA', 'Venta Agrupada', 'VA01', 0, 1, 1, 0);
        END
      `);
    return result;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};
