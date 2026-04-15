const sql = require('mssql');

function buildInParams(request, ids, paramPrefix) {
  const parts = [];
  (ids || []).forEach((id, i) => {
    const name = `${paramPrefix}${i}`;
    request.input(name, sql.UniqueIdentifier, id);
    parts.push(`@${name}`);
  });
  return parts.join(', ');
}

async function existeRucEnEmpresa(pool, idEmpresa, ruc) {
  const r = await pool
    .request()
    .input('ruc', sql.VarChar, ruc)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT 1 AS n FROM Proveedores WHERE ruc = @ruc AND idEmpresa = @idEmpresa');
  return r.recordset.length > 0;
}

async function insertar(pool, row) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('idDocumento', sql.VarChar, row.idDocumento)
    .input('ruc', sql.VarChar, row.ruc)
    .input('rSocial', sql.VarChar, row.rSocial)
    .input('correo', sql.VarChar, row.correo)
    .input('celular', sql.VarChar, row.celular)
    .input('condicion', sql.VarChar, row.condicion)
    .query(
      'INSERT INTO Proveedores (idEmpresa,idDocumento,ruc,rSocial,correo,celular,condicion,estado) VALUES (@idEmpresa,@idDocumento,@ruc,@rSocial,@correo,@celular,@condicion,1)'
    );
}

async function listarPorEmpresas(pool, idEmpresas) {
  const request = pool.request();
  const inSql = buildInParams(request, idEmpresas, 'e');
  const r = await request.query(`SELECT * FROM Proveedores WHERE idEmpresa IN (${inSql}) ORDER BY rSocial`);
  return r.recordset;
}

async function listarPorRucEmpresas(pool, idEmpresas, ruc) {
  const request = pool.request().input('ruc', sql.VarChar, ruc);
  const inSql = buildInParams(request, idEmpresas, 'e');
  const r = await request.query(`SELECT * FROM Proveedores WHERE ruc = @ruc AND idEmpresa IN (${inSql})`);
  return r.recordset;
}

async function listarPorIdProveedorEmpresas(pool, idEmpresas, idProveedor) {
  const request = pool.request().input('idProveedor', sql.Int, idProveedor);
  const inSql = buildInParams(request, idEmpresas, 'e');
  const r = await request.query(
    `SELECT * FROM Proveedores WHERE idProveedor = @idProveedor AND idEmpresa IN (${inSql})`
  );
  return r.recordset;
}

async function actualizarEnEmpresas(pool, idEmpresas, payload) {
  const request = pool
    .request()
    .input('idProveedor', sql.Int, payload.idProveedor)
    .input('idDocumento', sql.VarChar, payload.idDocumento)
    .input('ruc', sql.VarChar, payload.ruc)
    .input('rSocial', sql.VarChar, payload.rSocial)
    .input('correo', sql.VarChar, payload.correo)
    .input('celular', sql.VarChar, payload.celular)
    .input('condicion', sql.VarChar, payload.condicion);
  const inSql = buildInParams(request, idEmpresas, 'e');
  return request.query(
    `UPDATE Proveedores SET idDocumento = @idDocumento, ruc = @ruc, rSocial = @rSocial, correo = @correo, celular = @celular, condicion = @condicion WHERE idProveedor = @idProveedor AND idEmpresa IN (${inSql})`
  );
}

async function tieneCompras(pool, idProveedor) {
  const r = await pool
    .request()
    .input('idProveedor', sql.Int, idProveedor)
    .query('SELECT 1 AS n FROM Compras WHERE idProveedor = @idProveedor');
  return r.recordset.length > 0;
}

async function eliminarEnEmpresas(pool, idEmpresas, idProveedor) {
  const request = pool.request().input('idProveedor', sql.Int, idProveedor);
  const inSql = buildInParams(request, idEmpresas, 'e');
  return request.query(`DELETE FROM Proveedores WHERE idProveedor = @idProveedor AND idEmpresa IN (${inSql})`);
}

async function actualizarCondicion(pool, idProveedor, condicion, idEmpresa) {
  const r = await pool
    .request()
    .input('idProveedor', sql.Int, idProveedor)
    .input('nuevacondicion', sql.VarChar, condicion)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(
      'UPDATE Proveedores SET condicion = @nuevacondicion WHERE idProveedor = @idProveedor AND idEmpresa = @idEmpresa'
    );
  return r.rowsAffected;
}

async function actualizarEstado(pool, idProveedor, estado, idEmpresa) {
  const r = await pool
    .request()
    .input('idProveedor', sql.Int, idProveedor)
    .input('estado', sql.Bit, estado ? 1 : 0)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('UPDATE Proveedores SET estado = @estado WHERE idProveedor = @idProveedor AND idEmpresa = @idEmpresa');
  return r.rowsAffected;
}

async function insertarDireccion(pool, row) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('idProveedor', sql.Int, row.idProveedor)
    .input('ubigeo', sql.VarChar, row.ubigeo)
    .input('codPais', sql.VarChar, row.codPais)
    .input('region', sql.VarChar, row.region)
    .input('provincia', sql.VarChar, row.provincia)
    .input('distrito', sql.VarChar, row.distrito)
    .input('urbanizacion', sql.VarChar, row.urbanizacion)
    .input('direccion', sql.VarChar, row.direccion)
    .input('referencia', sql.VarChar, row.referencia)
    .input('codLocal', sql.VarChar, row.codLocal)
    .input('principal', sql.Bit, row.principal ? 1 : 0)
    .query(
      'INSERT INTO DireccionProveedor (idEmpresa,idProveedor,ubigeo,codPais,region,provincia,distrito,urbanizacion,direccion,referencia,codLocal, principal) VALUES (@idEmpresa,@idProveedor,@ubigeo,@codPais,@region,@provincia,@distrito,@urbanizacion,@direccion,@referencia,@codLocal,@principal)'
    );
}

async function listarDireccionesPorEmpresa(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM DireccionProveedor WHERE idEmpresa = @idEmpresa');
  return r.recordset;
}

async function listarDireccionesPorProveedorYEmpresas(pool, idEmpresas, idProveedor) {
  const request = pool.request().input('idProveedor', sql.Int, idProveedor);
  const inSql = buildInParams(request, idEmpresas, 'e');
  const r = await request.query(
    `SELECT dp.* FROM DireccionProveedor dp INNER JOIN Proveedores p ON p.idProveedor = dp.idProveedor AND p.idEmpresa = dp.idEmpresa WHERE dp.idProveedor = @idProveedor AND p.idEmpresa IN (${inSql})`
  );
  return r.recordset;
}

async function actualizarDireccion(pool, row) {
  return pool
    .request()
    .input('idDireccionProveedor', sql.Int, row.idDireccionProveedor)
    .input('idProveedor', sql.Int, row.idProveedor)
    .input('ubigeo', sql.VarChar, row.ubigeo)
    .input('codPais', sql.VarChar, row.codPais)
    .input('region', sql.VarChar, row.region)
    .input('provincia', sql.VarChar, row.provincia)
    .input('distrito', sql.VarChar, row.distrito)
    .input('urbanizacion', sql.VarChar, row.urbanizacion)
    .input('direccion', sql.VarChar, row.direccion)
    .input('referencia', sql.VarChar, row.referencia)
    .input('codLocal', sql.VarChar, row.codLocal)
    .input('principal', sql.Bit, row.principal ? 1 : 0)
    .query(
      'UPDATE DireccionProveedor SET idProveedor = @idProveedor, ubigeo = @ubigeo, codPais = @codPais, region = @region, provincia = @provincia, distrito = @distrito, urbanizacion = @urbanizacion, direccion = @direccion, referencia = @referencia, codLocal = @codLocal, principal = @principal WHERE idDireccionProveedor = @idDireccionProveedor'
    );
}

async function eliminarDireccion(pool, idDireccionProveedor) {
  return pool
    .request()
    .input('idDireccionProveedor', sql.Int, idDireccionProveedor)
    .query('DELETE FROM DireccionProveedor WHERE idDireccionProveedor = @idDireccionProveedor');
}

async function obtenerDireccionPorId(pool, idDireccionProveedor, idEmpresa) {
  const r = await pool
    .request()
    .input('idDireccionProveedor', sql.Int, idDireccionProveedor)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(
      'SELECT * FROM DireccionProveedor WHERE idDireccionProveedor = @idDireccionProveedor AND idEmpresa = @idEmpresa'
    );
  return r.recordset[0] || null;
}

module.exports = {
  existeRucEnEmpresa,
  insertar,
  listarPorEmpresas,
  listarPorRucEmpresas,
  listarPorIdProveedorEmpresas,
  actualizarEnEmpresas,
  tieneCompras,
  eliminarEnEmpresas,
  actualizarCondicion,
  actualizarEstado,
  insertarDireccion,
  listarDireccionesPorEmpresa,
  listarDireccionesPorProveedorYEmpresas,
  actualizarDireccion,
  eliminarDireccion,
  obtenerDireccionPorId
};
