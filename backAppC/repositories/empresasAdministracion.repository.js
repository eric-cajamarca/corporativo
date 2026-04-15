const sql = require('mssql');

async function listarTodasEmpresas(pool) {
  const r = await pool.request().query('SELECT * FROM Empresas');
  return r.recordset;
}

async function obtenerEmpresaPorId(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM Empresas WHERE idEmpresa = @idEmpresa');
  return r.recordset;
}

async function obtenerEmpresaCabecera(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(
      'SELECT e.logo, e.razon_Social AS nombre, e.ruc, e.rubro, e.correo, e.celular AS telefono, ' +
        'ISNULL(s.direccion, de.direccion) AS direccion, e.idRubro, r.codigo AS codigoRubro, s.idSucursal AS idSucursalPrincipal ' +
        'FROM Empresas e ' +
        'LEFT JOIN Sucursal s ON s.idEmpresa = e.idEmpresa AND s.esPrincipal = 1 ' +
        'LEFT JOIN DireccionEmpresa de ON e.idEmpresa = de.idEmpresa AND de.principal = 1 ' +
        'LEFT JOIN Rubros r ON e.idRubro = r.idRubro ' +
        'WHERE e.idEmpresa = @idEmpresa'
    );
  return r.recordset;
}

async function buscarEmpresaPorRuc(pool, ruc) {
  const r = await pool.request().input('ruc', sql.VarChar, ruc).query('SELECT * FROM Empresas WHERE ruc = @ruc');
  return r.recordset;
}

async function insertarEmpresa(pool, row) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('idDocumento', sql.VarChar(1), row.idDocumento)
    .input('ruc', sql.VarChar, row.ruc)
    .input('razon_Social', sql.VarChar, row.razon_Social)
    .input('nombreComercial', sql.VarChar, row.nombreComercial)
    .input('rubro', sql.VarChar, row.rubro)
    .input('idRubro', sql.Int, row.idRubro)
    .input('celular', sql.VarChar, row.celular)
    .input('correo', sql.VarChar, row.correo)
    .input('password', sql.Text, row.password)
    .input('logo', sql.VarBinary(sql.MAX), row.logo)
    .input('alias', sql.VarChar, row.alias)
    .input('condicion', sql.VarChar, row.condicion)
    .input('estSunat', sql.VarChar, row.estSunat)
    .input('estado', sql.Bit, row.estado)
    .input('fregistro', sql.DateTime, row.fregistro)
    .query(
      'INSERT INTO Empresas (idEmpresa, idDocumento, ruc, razon_Social, nombreComercial, rubro, idRubro, celular, correo, password, logo, alias, condicion, estSunat, estado, fregistro) VALUES (@idEmpresa, @idDocumento, @ruc, @razon_Social, @nombreComercial, @rubro, @idRubro, @celular, @correo, @password, @logo, @alias, @condicion, @estSunat, @estado, @fregistro)'
    );
}

async function obtenerIntegraciones(pool, idEmpresa) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM EmpresaIntegraciones WHERE idEmpresa = @idEmpresa');
}

async function obtenerCredencialesApi(pool, idEmpresa) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(
      'SELECT proveedor, clave, valor, idCredencial FROM EmpresaApiCredenciales WHERE idEmpresa = @idEmpresa AND activo = 1'
    );
}

async function mergeEmpresaIntegraciones(pool, row) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('twilio', sql.Bit, row.twilio)
    .input('izipay', sql.Bit, row.izipay)
    .input('culqi', sql.Bit, row.culqi)
    .input('apisPeru', sql.Bit, row.apisPeru)
    .input('factiliza', sql.Bit, row.factiliza)
    .query(`
      MERGE EmpresaIntegraciones AS t
      USING (SELECT @idEmpresa AS idEmpresa) AS s ON t.idEmpresa = s.idEmpresa
      WHEN MATCHED THEN
        UPDATE SET twilioHabilitado = @twilio, izipayHabilitado = @izipay, culqiHabilitado = @culqi,
          apisPeruHabilitado = @apisPeru, factilizaHabilitado = @factiliza, fActualizacion = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (idEmpresa, twilioHabilitado, izipayHabilitado, culqiHabilitado, apisPeruHabilitado, factilizaHabilitado, fActualizacion)
        VALUES (@idEmpresa, @twilio, @izipay, @culqi, @apisPeru, @factiliza, GETDATE());
    `);
}

async function eliminarCredencialesProveedor(pool, idEmpresa, proveedor) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('proveedor', sql.VarChar(50), proveedor)
    .query('DELETE FROM EmpresaApiCredenciales WHERE idEmpresa = @idEmpresa AND proveedor = @proveedor');
}

async function insertarCredencialApi(pool, row) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('proveedor', sql.VarChar(50), row.proveedor)
    .input('clave', sql.VarChar(100), row.clave)
    .input('valor', sql.NVarChar(500), row.valor)
    .query(
      'INSERT INTO EmpresaApiCredenciales (idEmpresa, proveedor, clave, valor, activo) VALUES (@idEmpresa, @proveedor, @clave, @valor, 1)'
    );
}

async function obtenerEmpresaCelularEstado(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT idEmpresa, celular, estado FROM Empresas WHERE idEmpresa = @idEmpresa');
  return r.recordset[0] || null;
}

async function actualizarEmpresaSinLogo(pool, row) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('Rubro', sql.VarChar, row.rubro)
    .input('idRubro', sql.Int, row.idRubro)
    .input('Celular', sql.VarChar, row.celular)
    .input('nombreComercial', sql.VarChar, row.nombreComercial)
    .input('Correo', sql.VarChar, row.correo)
    .input('Alias', sql.VarChar, row.alias)
    .query(
      'UPDATE Empresas SET Rubro = @Rubro, idRubro = @idRubro, Celular = @Celular, nombreComercial = @nombreComercial, Correo = @Correo, Alias = @Alias WHERE idEmpresa = @idEmpresa'
    );
}

async function actualizarEmpresaConLogoFilename(pool, row) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('Rubro', sql.VarChar, row.rubro)
    .input('idRubro', sql.Int, row.idRubro)
    .input('Celular', sql.VarChar, row.celular)
    .input('nombreComercial', sql.VarChar, row.nombreComercial)
    .input('Correo', sql.VarChar, row.correo)
    .input('Alias', sql.VarChar, row.alias)
    .input('Logo', sql.VarChar, row.logoFilename)
    .query(
      'UPDATE Empresas SET Rubro = @Rubro, idRubro = @idRubro, Celular = @Celular, nombreComercial = @nombreComercial, Correo = @Correo, Alias = @Alias, Logo = @Logo WHERE idEmpresa = @idEmpresa'
    );
}

async function actualizarEmpresaEstado(pool, idEmpresa, estado) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('estado', sql.Bit, estado ? 1 : 0)
    .query('UPDATE Empresas SET estado = @estado WHERE idEmpresa = @idEmpresa');
}

async function direccionEmpresaResetPrincipal(pool, idEmpresa) {
  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('UPDATE DireccionEmpresa SET principal = 0 WHERE idEmpresa = @idEmpresa');
}

async function sucursalResetPrincipal(pool, idEmpresa) {
  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('UPDATE Sucursal SET esPrincipal = 0 WHERE idEmpresa = @idEmpresa');
}

async function insertarDireccionEmpresa(pool, row) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('ubigeo', sql.VarChar, row.ubigeo)
    .input('codPais', sql.VarChar, row.codPais)
    .input('region', sql.VarChar, row.region)
    .input('provincia', sql.VarChar, row.provincia)
    .input('distrito', sql.VarChar, row.distrito)
    .input('urbanizacion', sql.VarChar, row.urbanizacion)
    .input('direccion', sql.VarChar, row.direccion)
    .input('codLocal', sql.VarChar, row.codLocal)
    .input('principal', sql.Bit, row.principal ? 1 : 0)
    .query(
      'INSERT INTO DireccionEmpresa (idEmpresa,ubigeo,codPais,region,provincia,distrito,urbanizacion,direccion,codLocal, principal) VALUES (@idEmpresa,@ubigeo,@codPais,@region,@provincia,@distrito,@urbanizacion,@direccion,@codLocal,@principal)'
    );
}

async function sucursalActualizarPrincipalDireccion(pool, idEmpresa, direccion) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('direccion', sql.VarChar(200), direccion)
    .query(
      "UPDATE Sucursal SET direccion = @direccion, esPrincipal = 1 WHERE idEmpresa = @idEmpresa AND nombre = 'Sucursal Principal'"
    );
}

async function insertarSucursalConPrincipal(pool, row) {
  return pool
    .request()
    .input('idSucursal', sql.UniqueIdentifier, row.idSucursal)
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('nombre', sql.VarChar, row.nombre)
    .input('direccion', sql.VarChar, row.direccion)
    .input('esPrincipal', sql.Bit, row.esPrincipal ? 1 : 0)
    .input('fregistro', sql.DateTime, row.fregistro)
    .input('estado', sql.Bit, row.estado ? 1 : 0)
    .query(
      'INSERT INTO Sucursal (idSucursal, idEmpresa, nombre, direccion, esPrincipal, fRegistro, estado) VALUES (@idSucursal, @idEmpresa, @nombre, @direccion, @esPrincipal, @fregistro, @estado)'
    );
}

async function insertarSucursalSimple(pool, row) {
  return pool
    .request()
    .input('idSucursal', sql.UniqueIdentifier, row.idSucursal)
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('nombre', sql.VarChar, row.nombre)
    .input('direccion', sql.VarChar, row.direccion)
    .input('fregistro', sql.DateTime, row.fregistro)
    .input('estado', sql.Bit, row.estado ? 1 : 0)
    .query(
      'INSERT INTO Sucursal (idSucursal, idEmpresa, nombre, direccion, fRegistro, estado) VALUES (@idSucursal, @idEmpresa, @nombre, @direccion, @fregistro, @estado)'
    );
}

async function obtenerDireccionEmpresaPorId(pool, id) {
  const r = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT direccion, principal FROM DireccionEmpresa WHERE idDireccionEmpresa = @id');
  return r.recordset[0] || null;
}

async function actualizarDireccionEmpresa(pool, row) {
  return pool
    .request()
    .input('id', sql.Int, row.id)
    .input('ubigeo', sql.VarChar, row.ubigeo)
    .input('codPais', sql.VarChar, row.codPais)
    .input('region', sql.VarChar, row.region)
    .input('provincia', sql.VarChar, row.provincia)
    .input('distrito', sql.VarChar, row.distrito)
    .input('urbanizacion', sql.VarChar, row.urbanizacion)
    .input('direccion', sql.VarChar, row.direccion)
    .input('codLocal', sql.VarChar, row.codLocal)
    .input('principal', sql.Bit, row.principal ? 1 : 0)
    .query(
      'UPDATE DireccionEmpresa SET ubigeo = @ubigeo, codPais = @codPais, region = @region, provincia = @provincia, distrito = @distrito, urbanizacion = @urbanizacion, direccion = @direccion, codLocal = @codLocal, principal = @principal WHERE idDireccionEmpresa = @id'
    );
}

async function sucursalQuitarPrincipalNombre(pool, idEmpresa) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(
      "UPDATE Sucursal SET esPrincipal = 0 WHERE idEmpresa = @idEmpresa AND nombre = 'Sucursal Principal'"
    );
}

async function sucursalActualizarDireccionPorEmpresaYDireccionAnterior(pool, row) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('direccionAnterior', sql.VarChar(200), row.direccionAnterior)
    .input('direccionNueva', sql.VarChar(200), row.direccionNueva)
    .input('esPrincipal', sql.Bit, row.esPrincipal ? 1 : 0)
    .query(
      'UPDATE Sucursal SET direccion = @direccionNueva, esPrincipal = @esPrincipal WHERE idEmpresa = @idEmpresa AND direccion = @direccionAnterior'
    );
}

async function listarDireccionesEmpresa(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM DireccionEmpresa WHERE idEmpresa = @idEmpresa');
  return r.recordset;
}

async function eliminarDireccionEmpresa(pool, idDireccionEmpresa) {
  return pool
    .request()
    .input('idDireccionEmpresa', sql.Int, idDireccionEmpresa)
    .query('DELETE FROM DireccionEmpresa WHERE idDireccionEmpresa = @idDireccionEmpresa');
}

async function direccionEmpresaSetPrincipalFalseTodas(pool, idEmpresa) {
  return pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('UPDATE DireccionEmpresa SET principal = 0 WHERE idEmpresa = @idEmpresa');
}

async function direccionEmpresaSetPrincipalTrue(pool, idDireccionEmpresa) {
  return pool
    .request()
    .input('idDireccionEmpresa', sql.Int, idDireccionEmpresa)
    .query('UPDATE DireccionEmpresa SET principal = 1 WHERE idDireccionEmpresa = @idDireccionEmpresa');
}

module.exports = {
  listarTodasEmpresas,
  obtenerEmpresaPorId,
  obtenerEmpresaCabecera,
  buscarEmpresaPorRuc,
  insertarEmpresa,
  obtenerIntegraciones,
  obtenerCredencialesApi,
  mergeEmpresaIntegraciones,
  eliminarCredencialesProveedor,
  insertarCredencialApi,
  obtenerEmpresaCelularEstado,
  actualizarEmpresaSinLogo,
  actualizarEmpresaConLogoFilename,
  actualizarEmpresaEstado,
  direccionEmpresaResetPrincipal,
  sucursalResetPrincipal,
  insertarDireccionEmpresa,
  sucursalActualizarPrincipalDireccion,
  insertarSucursalConPrincipal,
  insertarSucursalSimple,
  obtenerDireccionEmpresaPorId,
  actualizarDireccionEmpresa,
  sucursalQuitarPrincipalNombre,
  sucursalActualizarDireccionPorEmpresaYDireccionAnterior,
  listarDireccionesEmpresa,
  eliminarDireccionEmpresa,
  direccionEmpresaSetPrincipalFalseTodas,
  direccionEmpresaSetPrincipalTrue
};
