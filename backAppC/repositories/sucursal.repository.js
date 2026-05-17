const sql = require('mssql');

async function listarResumenPorEmpresa(pool, idEmpresa, soloActivas = true, idsSucursalesUsuario = null) {
  const filtroActiva = soloActivas ? ' AND ISNULL(estado, 1) = 1 ' : '';
  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  let filtroUsuario = '';
  if (Array.isArray(idsSucursalesUsuario) && idsSucursalesUsuario.length > 0) {
    const ph = idsSucursalesUsuario.map((id, i) => {
      const p = `idSucUs${i}`;
      req.input(p, sql.UniqueIdentifier, id);
      return `@${p}`;
    });
    filtroUsuario = ` AND idSucursal IN (${ph.join(', ')}) `;
  }
  const result = await req.query(
    `SELECT idSucursal, nombre, direccion,
            CONVERT(VARCHAR(10), fregistro, 23) AS fregistro,
            ISNULL(esPrincipal, 0) AS esPrincipal,
            idSucursalSeriesPadre
     FROM Sucursal WHERE idEmpresa = @idEmpresa ${filtroActiva}${filtroUsuario}
     ORDER BY CASE WHEN ISNULL(esPrincipal,0) = 1 THEN 0 ELSE 1 END, nombre`
  );
  return result.recordset;
}

async function obtenerEmpresaPorSucursal(pool, idSucursal) {
  const result = await pool
    .request()
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .query('SELECT TOP 1 idEmpresa FROM Sucursal WHERE idSucursal = @idSucursal');
  const row = result.recordset && result.recordset[0];
  return row && row.idEmpresa != null ? row.idEmpresa : null;
}

async function obtenerSucursalPorId(pool, idEmpresa, idSucursal) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .query(
      `SELECT TOP 1 idSucursal, idEmpresa, nombre, direccion, ISNULL(esPrincipal, 0) AS esPrincipal,
              idSucursalSeriesPadre, CONVERT(VARCHAR(10), fregistro, 23) AS fregistro
       FROM Sucursal WHERE idSucursal = @idSucursal AND idEmpresa = @idEmpresa`
    );
  return result.recordset[0] || null;
}

async function listarTodosPorEmpresa(pool, idEmpresa, soloActivas = true, idsSucursalesUsuario = null) {
  const filtroActiva = soloActivas ? ' AND ISNULL(estado, 1) = 1 ' : '';
  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  let filtroUsuario = '';
  if (Array.isArray(idsSucursalesUsuario) && idsSucursalesUsuario.length > 0) {
    const ph = idsSucursalesUsuario.map((id, i) => {
      const p = `idSucUsTot${i}`;
      req.input(p, sql.UniqueIdentifier, id);
      return `@${p}`;
    });
    filtroUsuario = ` AND idSucursal IN (${ph.join(', ')}) `;
  }
  const result = await req.query(
    `SELECT * FROM Sucursal WHERE idEmpresa = @idEmpresa ${filtroActiva}${filtroUsuario}
     ORDER BY CASE WHEN ISNULL(esPrincipal,0) = 1 THEN 0 ELSE 1 END, nombre`
  );
  return result.recordset;
}

/** Sucursal por defecto para catálogo Comprobantes (principal o la más antigua). */
async function obtenerSucursalDefectoComprobantes(pool, idEmpresa) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 idSucursal
      FROM Sucursal
      WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
      ORDER BY CASE WHEN ISNULL(esPrincipal, 0) = 1 THEN 0 ELSE 1 END, fregistro ASC
    `);
  const row = result.recordset && result.recordset[0];
  return row && row.idSucursal ? row.idSucursal : null;
}

async function existeSucursalEnEmpresa(pool, idSucursal, idEmpresa) {
  const result = await pool
    .request()
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT 1 AS ok FROM Sucursal WHERE idSucursal = @idSucursal AND idEmpresa = @idEmpresa');
  return result.recordset && result.recordset.length > 0;
}

async function quitarPrincipalTodas(pool, idEmpresa) {
  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('UPDATE Sucursal SET esPrincipal = 0 WHERE idEmpresa = @idEmpresa');
}

async function marcarSucursalPrincipal(pool, idSucursal, idEmpresa) {
  await pool
    .request()
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(
      'UPDATE Sucursal SET esPrincipal = 1 WHERE idSucursal = @idSucursal AND idEmpresa = @idEmpresa'
    );
}

async function actualizarNombreDireccion(pool, idEmpresa, idSucursal, nombre, direccion, idSucursalSeriesPadre) {
  const req = pool
    .request()
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('nombre', sql.VarChar(100), nombre)
    .input('direccion', sql.VarChar(500), direccion ?? '');
  if (idSucursalSeriesPadre === undefined) {
    const result = await req.query(
      `UPDATE Sucursal SET nombre = @nombre, direccion = @direccion, fregistro = GETDATE()
       WHERE idSucursal = @idSucursal AND idEmpresa = @idEmpresa`
    );
    return result.rowsAffected;
  }
  req.input('idSucursalSeriesPadre', sql.UniqueIdentifier, idSucursalSeriesPadre || null);
  const result = await req.query(
    `UPDATE Sucursal SET nombre = @nombre, direccion = @direccion,
            idSucursalSeriesPadre = @idSucursalSeriesPadre, fregistro = GETDATE()
     WHERE idSucursal = @idSucursal AND idEmpresa = @idEmpresa`
  );
  return result.rowsAffected;
}

async function actualizarEstado(pool, idEmpresa, idSucursal, estado) {
  const result = await pool
    .request()
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('estado', sql.Bit, estado)
    .query(
      'UPDATE Sucursal SET estado = @estado WHERE idSucursal = @idSucursal AND idEmpresa = @idEmpresa'
    );
  return result.rowsAffected[0];
}

async function eliminarTodasPorEmpresa(pool, idEmpresa) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('DELETE FROM Sucursal WHERE idEmpresa = @idEmpresa');
  return result.rowsAffected;
}

async function obtenerIdSucursalDeLote(pool, idEmpresa, idLote) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idLote', sql.UniqueIdentifier, idLote)
    .query('SELECT TOP 1 idSucursal FROM Lotes WHERE idEmpresa = @idEmpresa AND idLote = @idLote');
  const row = result.recordset && result.recordset[0];
  return row && row.idSucursal ? row.idSucursal : null;
}

async function listarLotesPorSucursalProducto(pool, idEmpresa, idSucursal, idProducto) {
  const result = await pool
    .request()
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT l.idLote, l.idProducto, l.idSucursal, l.cantidadDisponible AS cantidad, l.costoUnitario,
             l.fechaIngreso, l.fechaVencimiento,
             p.codigo, p.descripcion, p.cUnitario
      FROM Lotes l
      INNER JOIN Productos p ON l.idProducto = p.idProducto
      WHERE l.idSucursal = @idSucursal AND l.idProducto = @idProducto AND l.idEmpresa = @idEmpresa
        AND l.cantidadDisponible > 0
    `);
  return result.recordset;
}

async function listarLotesStockPorEmpresa(pool, idEmpresa, idsSucursalesFiltro = null) {
  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  let filtroSuc = '';
  if (Array.isArray(idsSucursalesFiltro) && idsSucursalesFiltro.length > 0) {
    const ph = idsSucursalesFiltro.map((id, i) => {
      const p = `idSucStock${i}`;
      req.input(p, sql.UniqueIdentifier, id);
      return `@${p}`;
    });
    filtroSuc = ` AND l.idSucursal IN (${ph.join(', ')}) `;
  }
  const result = await req.query(`
      SELECT l.idLote, l.idEmpresa, l.idSucursal, l.idProducto, l.cantidadDisponible AS cantidad,
             l.costoUnitario, l.fechaIngreso, l.fechaVencimiento,
             p.codigo, p.descripcion, p.cUnitario, p.idCategoria, p.idMarca, p.idPresentacion,
             s.nombre AS sucursal, c.nombre AS categoria, m.nombre AS marca,
             pr.codigo AS codigoPresentacion, pr.descripcion AS descripcionPres
      FROM Lotes l
      INNER JOIN Productos p ON l.idProducto = p.idProducto
      INNER JOIN Sucursal s ON l.idSucursal = s.idSucursal AND ISNULL(s.estado, 1) = 1
      LEFT JOIN Categorias c ON p.idCategoria = c.idCategoria
      LEFT JOIN Marcas m ON p.idMarca = m.idMarca
      LEFT JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
      WHERE l.idEmpresa = @idEmpresa AND l.cantidadDisponible > 0 ${filtroSuc}
      ORDER BY s.nombre, p.descripcion, l.fechaIngreso DESC
    `);
  return result.recordset;
}

async function insertarLote(pool, payload) {
  const { idEmpresa, idSucursal, idProducto, costoUnitario, cantidadIngresada, cantidadDisponible } = payload;
  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('costoUnitario', sql.Decimal(18, 6), costoUnitario)
    .input('cantidadIngresada', sql.Decimal(18, 2), cantidadIngresada)
    .input('cantidadDisponible', sql.Decimal(18, 2), cantidadDisponible)
    .query(`
      INSERT INTO Lotes (idEmpresa, idSucursal, idProducto, costoUnitario, cantidadIngresada, cantidadDisponible)
      VALUES (@idEmpresa, @idSucursal, @idProducto, @costoUnitario, @cantidadIngresada, @cantidadDisponible)
    `);
}

async function actualizarCantidadLote(pool, idEmpresa, idLote, cantidadDisponible) {
  const result = await pool
    .request()
    .input('idLote', sql.UniqueIdentifier, idLote)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('cantidadDisponible', sql.Decimal(18, 2), cantidadDisponible)
    .query(`
      UPDATE Lotes SET cantidadDisponible = @cantidadDisponible
      WHERE idLote = @idLote AND idEmpresa = @idEmpresa
    `);
  return result.rowsAffected[0];
}

async function eliminarLote(pool, idEmpresa, idLote) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idLote', sql.UniqueIdentifier, idLote)
    .query('DELETE FROM Lotes WHERE idEmpresa = @idEmpresa AND idLote = @idLote');
  return result.rowsAffected[0];
}

module.exports = {
  listarResumenPorEmpresa,
  listarTodosPorEmpresa,
  obtenerSucursalDefectoComprobantes,
  obtenerIdSucursalDeLote,
  obtenerSucursalPorId,
  obtenerEmpresaPorSucursal,
  existeSucursalEnEmpresa,
  quitarPrincipalTodas,
  marcarSucursalPrincipal,
  actualizarNombreDireccion,
  actualizarEstado,
  eliminarTodasPorEmpresa,
  listarLotesPorSucursalProducto,
  listarLotesStockPorEmpresa,
  insertarLote,
  actualizarCantidadLote,
  eliminarLote
};
