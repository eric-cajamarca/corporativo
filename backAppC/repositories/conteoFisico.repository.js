const sql = require('mssql');

exports.insertarSesion = async (transaction, datos) => {
  const {
    idSesion,
    idEmpresa,
    idSucursal,
    tipoConteo,
    observaciones,
    idUsuarioCreacion,
    idUbicacionInventario,
    codigoUbicacionInventario
  } = datos;
  const idUb =
    idUbicacionInventario != null && idUbicacionInventario !== ''
      ? parseInt(String(idUbicacionInventario), 10)
      : null;
  const idUbSql = Number.isFinite(idUb) && idUb > 0 ? idUb : null;
  const codigoUb =
    codigoUbicacionInventario != null && String(codigoUbicacionInventario).trim() !== ''
      ? String(codigoUbicacionInventario).trim().substring(0, 20)
      : null;
  await transaction
    .request()
    .input('idSesion', sql.UniqueIdentifier, idSesion)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('tipoConteo', sql.VarChar(20), tipoConteo)
    .input('observaciones', sql.NVarChar(500), observaciones || null)
    .input('idUsuarioCreacion', sql.UniqueIdentifier, idUsuarioCreacion || null)
    .input('idUbicacionInventario', sql.Int, idUbSql)
    .input('codigoUbicacionInventario', sql.VarChar(20), codigoUb)
    .query(`
      INSERT INTO InventarioFisicoSesion (idSesion, idEmpresa, idSucursal, tipoConteo, estado, observaciones, idUsuarioCreacion, idUbicacionInventario, codigoUbicacionInventario)
      VALUES (@idSesion, @idEmpresa, @idSucursal, @tipoConteo, 'BORRADOR', @observaciones, @idUsuarioCreacion, @idUbicacionInventario, @codigoUbicacionInventario)
    `);
};

exports.obtenerSesionPorId = async (conn, idEmpresa, idSesion) => {
  const r = await conn.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSesion', sql.UniqueIdentifier, idSesion)
    .query(`
      SELECT s.idSesion, s.idEmpresa, s.idSucursal, sc.nombre AS nombreSucursal,
             s.tipoConteo, s.estado, s.observaciones,
             CONVERT(VARCHAR(19), s.fCreacion, 120) AS fCreacion,
             s.idUbicacionInventario,
             RTRIM(LTRIM(COALESCE(NULLIF(s.codigoUbicacionInventario, ''), up.codigoUbicacion, ''))) AS codigoUbicacionInventario
      FROM InventarioFisicoSesion s
      INNER JOIN Sucursal sc ON sc.idSucursal = s.idSucursal AND sc.idEmpresa = s.idEmpresa
      LEFT JOIN UbicacionesPrioridad up ON up.idUbicacion = s.idUbicacionInventario AND up.idSucursal = s.idSucursal
      WHERE s.idEmpresa = @idEmpresa AND s.idSesion = @idSesion
    `);
  return r.recordset && r.recordset[0] ? r.recordset[0] : null;
};

exports.listarLineasPorSesion = async (conn, idEmpresa, idSesion) => {
  const r = await conn.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSesion', sql.UniqueIdentifier, idSesion)
    .query(`
      SELECT l.idLinea, l.idSesion, l.idProducto, l.stockSistema, l.stockReal, l.verificado, l.notas,
             CONVERT(VARCHAR(19), l.fModificacion, 120) AS fModificacion,
             p.codigo AS productoCodigo, p.descripcion AS productoDescripcion,
             ISNULL(m.nombre, '') AS marca
      FROM InventarioFisicoLinea l
      INNER JOIN InventarioFisicoSesion s ON s.idSesion = l.idSesion AND s.idEmpresa = @idEmpresa
      INNER JOIN Productos p ON p.idProducto = l.idProducto
      LEFT JOIN Marcas m ON m.idMarca = p.idMarca AND m.idEmpresa = p.idEmpresa
      WHERE l.idSesion = @idSesion
      ORDER BY p.descripcion
    `);
  return r.recordset || [];
};

exports.validarSucursalPerteneceEmpresa = async (conn, idEmpresa, idSucursal) => {
  const r = await conn.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .query(`SELECT 1 AS ok FROM Sucursal WHERE idEmpresa = @idEmpresa AND idSucursal = @idSucursal`);
  return !!(r.recordset && r.recordset[0]);
};

/** Resuelve idUbicacion por código en la sucursal de la empresa del producto. */
exports.obtenerIdUbicacionPorCodigo = async (conn, idEmpresa, idSucursal, codigoUbicacion) => {
  const cod = String(codigoUbicacion || '').trim();
  if (!cod) {
    return null;
  }
  const r = await conn
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('codigo', sql.VarChar(20), cod)
    .query(`
      SELECT TOP 1 up.idUbicacion
      FROM UbicacionesPrioridad up
      INNER JOIN Sucursal s ON s.idSucursal = up.idSucursal AND s.idEmpresa = @idEmpresa
      WHERE up.idSucursal = @idSucursal
        AND RTRIM(LTRIM(up.codigoUbicacion)) = RTRIM(LTRIM(@codigo))
    `);
  const row = r.recordset && r.recordset[0];
  const id = row && row.idUbicacion != null ? parseInt(String(row.idUbicacion), 10) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
};

exports.validarUbicacionPerteneceSucursal = async (conn, idSucursal, idUbicacion) => {
  const idUb = parseInt(String(idUbicacion), 10);
  if (!Number.isFinite(idUb) || idUb < 1) return false;
  const r = await conn
    .request()
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idUbicacion', sql.Int, idUb)
    .query(
      'SELECT 1 AS ok FROM UbicacionesPrioridad WHERE idSucursal = @idSucursal AND idUbicacion = @idUbicacion'
    );
  return !!(r.recordset && r.recordset[0]);
};

/**
 * Upsert línea: actualiza stockSistema referencia desde caller.
 */
exports.upsertLinea = async (transaction, datos) => {
  const {
    idSesion,
    idProducto,
    stockSistema,
    stockReal,
    verificado,
    notas
  } = datos;
  const ver = verificado ? 1 : 0;
  const sr = stockReal != null && stockReal !== '' ? Number(stockReal) : null;

  const r = await transaction.request()
    .input('idSesion', sql.UniqueIdentifier, idSesion)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('stockSistema', sql.Decimal(18, 3), stockSistema)
    .input('stockReal', sql.Decimal(18, 3), sr)
    .input('verificado', sql.Bit, ver)
    .input('notas', sql.NVarChar(500), notas || null)
    .query(`
      MERGE InventarioFisicoLinea AS t
      USING (SELECT @idSesion AS idSesion, @idProducto AS idProducto) AS s
      ON t.idSesion = s.idSesion AND t.idProducto = s.idProducto
      WHEN MATCHED THEN UPDATE SET
        stockSistema = @stockSistema,
        stockReal = @stockReal,
        verificado = @verificado,
        notas = @notas,
        fModificacion = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (idSesion, idProducto, stockSistema, stockReal, verificado, notas)
      VALUES (@idSesion, @idProducto, @stockSistema, @stockReal, @verificado, @notas);
    `);
  return r.rowsAffected;
};

exports.marcarSesionCerrada = async (transaction, idEmpresa, idSesion) => {
  await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSesion', sql.UniqueIdentifier, idSesion)
    .query(`
      UPDATE InventarioFisicoSesion SET estado = 'CERRADO'
      WHERE idEmpresa = @idEmpresa AND idSesion = @idSesion AND estado = 'BORRADOR'
    `);
};
