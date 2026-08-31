const sql = require('mssql');

function mapFormula(row) {
  return {
    idFormula: row.idFormula,
    idEmpresa: row.idEmpresa,
    nombre: row.nombre,
    marcaVehiculo: row.marcaVehiculo || null,
    modeloVehiculo: row.modeloVehiculo || null,
    placa: row.placa || null,
    idProductoBase: row.idProductoBase || null,
    productoBase: row.productoBase || null,
    notas: row.notas || null,
    fCreacion: row.fCreacion || null,
    estado: row.estado === true || row.estado === 1
  };
}

function mapDetalle(row) {
  return {
    idProductoTinte: row.idProductoTinte,
    codigo: row.codigo || null,
    descripcion: row.descripcion || null,
    gramosPorGalon: Number(row.gramosPorGalon)
  };
}

async function listar(pool, idEmpresa, { q, placa, idProductoBase, limite }) {
  const term = q ? `%${String(q).trim()}%` : null;
  const lim = Math.min(80, Math.max(1, parseInt(limite, 10) || 30));
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('q', sql.VarChar(80), term)
    .input('placa', sql.VarChar(15), placa ? String(placa).trim() : null)
    .input('idProductoBase', sql.UniqueIdentifier, idProductoBase || null)
    .input('limite', sql.Int, lim)
    .query(`
      SELECT TOP (@limite)
        f.idFormula,
        f.idEmpresa,
        f.nombre,
        f.marcaVehiculo,
        f.modeloVehiculo,
        f.placa,
        f.idProductoBase,
        p.descripcion AS productoBase,
        f.notas,
        CONVERT(VARCHAR(19), f.fCreacion, 120) AS fCreacion,
        f.estado
      FROM FormulaMatizado f
      LEFT JOIN Productos p ON p.idProducto = f.idProductoBase
      WHERE f.idEmpresa = @idEmpresa
        AND f.estado = 1
        AND (@q IS NULL OR f.nombre LIKE @q OR f.marcaVehiculo LIKE @q OR f.placa LIKE @q)
        AND (@placa IS NULL OR f.placa = @placa)
        AND (@idProductoBase IS NULL OR f.idProductoBase = @idProductoBase)
      ORDER BY f.fCreacion DESC
    `);
  return result.recordset.map(mapFormula);
}

async function obtenerPorId(pool, idEmpresa, idFormula) {
  const cab = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idFormula', sql.UniqueIdentifier, idFormula)
    .query(`
      SELECT
        f.idFormula, f.idEmpresa, f.nombre, f.marcaVehiculo, f.modeloVehiculo,
        f.placa, f.idProductoBase, p.descripcion AS productoBase, f.notas,
        CONVERT(VARCHAR(19), f.fCreacion, 120) AS fCreacion, f.estado
      FROM FormulaMatizado f
      LEFT JOIN Productos p ON p.idProducto = f.idProductoBase
      WHERE f.idFormula = @idFormula AND f.idEmpresa = @idEmpresa
    `);
  const formula = cab.recordset[0] ? mapFormula(cab.recordset[0]) : null;
  if (!formula) return null;
  const det = await pool
    .request()
    .input('idFormula', sql.UniqueIdentifier, idFormula)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT d.idProductoTinte, p.Codigo AS codigo, p.descripcion, d.gramosPorGalon
      FROM FormulaMatizadoDetalle d
      INNER JOIN Productos p ON p.idProducto = d.idProductoTinte AND p.idEmpresa = @idEmpresa
      WHERE d.idFormula = @idFormula
      ORDER BY p.descripcion
    `);
  formula.tintes = det.recordset.map(mapDetalle);
  return formula;
}

async function insertar(transaction, datos) {
  const result = await transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, datos.idEmpresa)
    .input('nombre', sql.VarChar(80), datos.nombre)
    .input('marcaVehiculo', sql.VarChar(50), datos.marcaVehiculo)
    .input('modeloVehiculo', sql.VarChar(50), datos.modeloVehiculo)
    .input('placa', sql.VarChar(15), datos.placa)
    .input('idProductoBase', sql.UniqueIdentifier, datos.idProductoBase)
    .input('notas', sql.VarChar(200), datos.notas)
    .input('idUsuario', sql.UniqueIdentifier, datos.idUsuario)
    .query(`
      INSERT INTO FormulaMatizado
        (idEmpresa, nombre, marcaVehiculo, modeloVehiculo, placa, idProductoBase, notas, idUsuario)
      OUTPUT INSERTED.idFormula
      VALUES (@idEmpresa, @nombre, @marcaVehiculo, @modeloVehiculo, @placa, @idProductoBase, @notas, @idUsuario)
    `);
  return result.recordset[0].idFormula;
}

async function actualizarCabecera(transaction, datos) {
  await transaction
    .request()
    .input('idFormula', sql.UniqueIdentifier, datos.idFormula)
    .input('idEmpresa', sql.UniqueIdentifier, datos.idEmpresa)
    .input('nombre', sql.VarChar(80), datos.nombre)
    .input('marcaVehiculo', sql.VarChar(50), datos.marcaVehiculo)
    .input('modeloVehiculo', sql.VarChar(50), datos.modeloVehiculo)
    .input('placa', sql.VarChar(15), datos.placa)
    .input('idProductoBase', sql.UniqueIdentifier, datos.idProductoBase)
    .input('notas', sql.VarChar(200), datos.notas)
    .query(`
      UPDATE FormulaMatizado
      SET nombre = @nombre,
          marcaVehiculo = @marcaVehiculo,
          modeloVehiculo = @modeloVehiculo,
          placa = @placa,
          idProductoBase = @idProductoBase,
          notas = @notas
      WHERE idFormula = @idFormula AND idEmpresa = @idEmpresa
    `);
}

async function eliminarDetalles(transaction, idFormula) {
  await transaction
    .request()
    .input('idFormula', sql.UniqueIdentifier, idFormula)
    .query('DELETE FROM FormulaMatizadoDetalle WHERE idFormula = @idFormula');
}

async function insertarDetalle(transaction, idFormula, idProductoTinte, gramosPorGalon) {
  await transaction
    .request()
    .input('idFormula', sql.UniqueIdentifier, idFormula)
    .input('idProductoTinte', sql.UniqueIdentifier, idProductoTinte)
    .input('gramosPorGalon', sql.Decimal(18, 6), gramosPorGalon)
    .query(`
      INSERT INTO FormulaMatizadoDetalle (idFormula, idProductoTinte, gramosPorGalon)
      VALUES (@idFormula, @idProductoTinte, @gramosPorGalon)
    `);
}

async function desactivar(executor, idEmpresa, idFormula) {
  const result = await executor
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idFormula', sql.UniqueIdentifier, idFormula)
    .query(`
      UPDATE FormulaMatizado
      SET estado = 0
      WHERE idFormula = @idFormula AND idEmpresa = @idEmpresa AND estado = 1
    `);
  return result.rowsAffected?.[0] > 0;
}

async function insertarVentaMatizado(transaction, datos) {
  const result = await transaction
    .request()
    .input('idVenta', sql.Int, datos.idVenta)
    .input('idEmpresa', sql.UniqueIdentifier, datos.idEmpresa)
    .input('idProductoBase', sql.UniqueIdentifier, datos.idProductoBase)
    .input('nombreColor', sql.VarChar(80), datos.nombreColor)
    .input('marcaVehiculo', sql.VarChar(50), datos.marcaVehiculo)
    .input('placa', sql.VarChar(15), datos.placa)
    .input('factorEscala', sql.Decimal(18, 6), datos.factorEscala)
    .input('idFormula', sql.UniqueIdentifier, datos.idFormula)
    .input('cargoMatizado', sql.Decimal(18, 6), datos.cargoMatizado)
    .query(`
      INSERT INTO VentaMatizado
        (idVenta, idEmpresa, idProductoBase, nombreColor, marcaVehiculo, placa, factorEscala, idFormula, cargoMatizado)
      OUTPUT INSERTED.idVentaMatizado
      VALUES (@idVenta, @idEmpresa, @idProductoBase, @nombreColor, @marcaVehiculo, @placa, @factorEscala, @idFormula, @cargoMatizado)
    `);
  return result.recordset[0].idVentaMatizado;
}

async function insertarVentaMatizadoTinte(transaction, idVentaMatizado, idProductoTinte, gramos, cantidadStock) {
  await transaction
    .request()
    .input('idVentaMatizado', sql.UniqueIdentifier, idVentaMatizado)
    .input('idProductoTinte', sql.UniqueIdentifier, idProductoTinte)
    .input('gramos', sql.Decimal(18, 6), gramos)
    .input('cantidadStock', sql.Decimal(18, 6), cantidadStock)
    .query(`
      INSERT INTO VentaMatizadoTinte (idVentaMatizado, idProductoTinte, gramos, cantidadStock)
      VALUES (@idVentaMatizado, @idProductoTinte, @gramos, @cantidadStock)
    `);
}

module.exports = {
  listar,
  obtenerPorId,
  insertar,
  actualizarCabecera,
  eliminarDetalles,
  insertarDetalle,
  desactivar,
  insertarVentaMatizado,
  insertarVentaMatizadoTinte
};
