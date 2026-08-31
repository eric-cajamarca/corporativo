const sql = require('mssql');

function mapConversion(row) {
  if (!row) return null;
  return {
    idProducto: row.idProducto,
    idEmpresa: row.idEmpresa,
    unidadInternaNombre: row.unidadInternaNombre,
    factorCompraAInterna: Number(row.factorCompraAInterna),
    activo: row.activo === true || row.activo === 1
  };
}

function mapUnidad(row) {
  return {
    idUnidadVenta: row.idUnidadVenta,
    idProducto: row.idProducto,
    idEmpresa: row.idEmpresa,
    nombre: row.nombre,
    factorAInterna: Number(row.factorAInterna),
    precio: row.precio != null ? Number(row.precio) : null,
    visibleEnPos: row.visibleEnPos === true || row.visibleEnPos === 1,
    orden: Number(row.orden) || 0
  };
}

async function obtenerConversion(executor, idEmpresa, idProducto) {
  const result = await executor
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT idProducto, idEmpresa, unidadInternaNombre, factorCompraAInterna, activo
      FROM ProductoUnidadConversion
      WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa
    `);
  return mapConversion(result.recordset[0]);
}

async function listarUnidades(executor, idEmpresa, idProducto) {
  const result = await executor
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT idUnidadVenta, idProducto, idEmpresa, nombre, factorAInterna, precio, visibleEnPos, orden
      FROM ProductoUnidadVenta
      WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa
      ORDER BY orden, nombre
    `);
  return result.recordset.map(mapUnidad);
}

async function obtenerUnidad(executor, idEmpresa, idProducto, idUnidadVenta) {
  const result = await executor
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idUnidadVenta', sql.UniqueIdentifier, idUnidadVenta)
    .query(`
      SELECT u.idUnidadVenta, u.idProducto, u.idEmpresa, u.nombre, u.factorAInterna,
             u.precio, u.visibleEnPos, u.orden
      FROM ProductoUnidadVenta u
      INNER JOIN ProductoUnidadConversion c
        ON c.idProducto = u.idProducto AND c.idEmpresa = u.idEmpresa AND c.activo = 1
      WHERE u.idUnidadVenta = @idUnidadVenta
        AND u.idProducto = @idProducto
        AND u.idEmpresa = @idEmpresa
    `);
  const row = result.recordset[0];
  return row ? mapUnidad(row) : null;
}

async function listarUnidadesPorProductos(executor, idsProducto) {
  const ids = [...new Set((idsProducto || []).map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) return [];
  const req = executor.request();
  const params = ids.map((id, i) => {
    const key = `p${i}`;
    req.input(key, sql.UniqueIdentifier, id);
    return `@${key}`;
  });
  const result = await req.query(`
    SELECT
      c.idProducto,
      c.unidadInternaNombre,
      c.factorCompraAInterna,
      c.activo,
      u.idUnidadVenta,
      u.nombre,
      u.factorAInterna,
      u.precio,
      u.visibleEnPos,
      u.orden
    FROM ProductoUnidadConversion c
    INNER JOIN ProductoUnidadVenta u
      ON u.idProducto = c.idProducto AND u.idEmpresa = c.idEmpresa
    WHERE c.activo = 1
      AND c.idProducto IN (${params.join(', ')})
    ORDER BY c.idProducto, u.orden, u.nombre
  `);
  return result.recordset;
}

async function guardarConversion(transaction, datos) {
  const { idEmpresa, idProducto, unidadInternaNombre, factorCompraAInterna, activo } = datos;
  await transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('unidadInternaNombre', sql.VarChar(50), unidadInternaNombre)
    .input('factorCompraAInterna', sql.Decimal(18, 6), factorCompraAInterna)
    .input('activo', sql.Bit, activo ? 1 : 0)
    .query(`
      MERGE ProductoUnidadConversion AS t
      USING (SELECT @idProducto AS idProducto, @idEmpresa AS idEmpresa) AS s
      ON t.idProducto = s.idProducto AND t.idEmpresa = s.idEmpresa
      WHEN MATCHED THEN
        UPDATE SET
          unidadInternaNombre = @unidadInternaNombre,
          factorCompraAInterna = @factorCompraAInterna,
          activo = @activo
      WHEN NOT MATCHED THEN
        INSERT (idProducto, idEmpresa, unidadInternaNombre, factorCompraAInterna, activo)
        VALUES (@idProducto, @idEmpresa, @unidadInternaNombre, @factorCompraAInterna, @activo);
    `);
}

async function eliminarUnidadesProducto(transaction, idEmpresa, idProducto) {
  await transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      DELETE FROM ProductoUnidadVenta
      WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa
    `);
}

async function insertarUnidad(transaction, datos) {
  const result = await transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, datos.idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, datos.idProducto)
    .input('nombre', sql.VarChar(50), datos.nombre)
    .input('factorAInterna', sql.Decimal(18, 6), datos.factorAInterna)
    .input('precio', sql.Decimal(18, 6), datos.precio)
    .input('visibleEnPos', sql.Bit, datos.visibleEnPos ? 1 : 0)
    .input('orden', sql.Int, datos.orden)
    .query(`
      INSERT INTO ProductoUnidadVenta
        (idProducto, idEmpresa, nombre, factorAInterna, precio, visibleEnPos, orden)
      OUTPUT INSERTED.idUnidadVenta
      VALUES (@idProducto, @idEmpresa, @nombre, @factorAInterna, @precio, @visibleEnPos, @orden)
    `);
  return result.recordset[0]?.idUnidadVenta;
}

async function desactivarConversion(transaction, idEmpresa, idProducto) {
  await transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      UPDATE ProductoUnidadConversion
      SET activo = 0
      WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa
    `);
  await eliminarUnidadesProducto(transaction, idEmpresa, idProducto);
}

async function obtenerPrecioPrincipal(executor, idEmpresa, idProducto) {
  const result = await executor
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT TOP 1 pp.precio
      FROM PreciosProducto pp
      INNER JOIN ListasPrecio lp ON pp.idLista = lp.idLista AND lp.idEmpresa = @idEmpresa
      WHERE pp.idProducto = @idProducto
        AND ISNULL(lp.activo, 1) = 1
      ORDER BY
        CASE WHEN ISNULL(lp.principal, 0) = 1 THEN 0 ELSE 1 END,
        pp.precio DESC
    `);
  return Number(result.recordset?.[0]?.precio) || 0;
}

module.exports = {
  obtenerConversion,
  listarUnidades,
  obtenerUnidad,
  listarUnidadesPorProductos,
  guardarConversion,
  eliminarUnidadesProducto,
  insertarUnidad,
  desactivarConversion,
  obtenerPrecioPrincipal
};
