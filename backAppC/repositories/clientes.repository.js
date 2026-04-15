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

async function buscarPorRuc(pool, idEmpresa, ruc) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('ruc', sql.VarChar, ruc)
    .query('SELECT * FROM Clientes WHERE idEmpresa = @idEmpresa AND ruc = @ruc');
  return r.recordset;
}

async function insertar(pool, row) {
  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('idDocumento', sql.VarChar, row.idDocumento)
    .input('ruc', sql.VarChar, row.ruc)
    .input('rSocial', sql.VarChar, row.rSocial)
    .input('correo', sql.VarChar, row.correo)
    .input('celular', sql.VarChar, row.celular)
    .input('condicion', sql.VarChar, row.condicion)
    .input('sujetoCredito', sql.Bit, row.sujetoCredito ? 1 : 0)
    .input('lineaCredito', sql.Decimal(18, 2), row.lineaCredito)
    .query(
      'INSERT INTO Clientes (idEmpresa,idDocumento,ruc,rSocial,correo,celular,condicion,estado,sujetoCredito,lineaCredito) VALUES (@idEmpresa,@idDocumento,@ruc,@rSocial,@correo,@celular,@condicion,1,@sujetoCredito,@lineaCredito)'
    );
}

async function obtenerPorRuc(pool, idEmpresa, ruc) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('ruc', sql.VarChar, ruc)
    .query(
      'SELECT idCliente, idEmpresa, idDocumento, ruc, rSocial, correo, celular, condicion, estado, sujetoCredito, lineaCredito FROM Clientes WHERE idEmpresa = @idEmpresa AND ruc = @ruc'
    );
  return r.recordset[0] || null;
}

async function listarPorEmpresa(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM Clientes WHERE idEmpresa = @idEmpresa ORDER BY rSocial');
  return r.recordset;
}

async function listarPorRucEmpresas(pool, idEmpresas, ruc) {
  const request = pool.request().input('ruc', sql.VarChar, ruc);
  const inSql = buildInParams(request, idEmpresas, 'e');
  const r = await request.query(`SELECT * FROM Clientes WHERE ruc = @ruc AND idEmpresa IN (${inSql})`);
  return r.recordset;
}

async function listarPorIdClienteEmpresas(pool, idEmpresas, idCliente) {
  const request = pool.request().input('idCliente', sql.Int, idCliente);
  const inSql = buildInParams(request, idEmpresas, 'e');
  const r = await request.query(`SELECT * FROM Clientes WHERE idCliente = @idCliente AND idEmpresa IN (${inSql})`);
  return r.recordset;
}

async function actualizarEnEmpresas(pool, idEmpresas, payload) {
  const request = pool
    .request()
    .input('idCliente', sql.Int, payload.idCliente)
    .input('idDocumento', sql.VarChar, payload.idDocumento)
    .input('ruc', sql.VarChar, payload.ruc)
    .input('rSocial', sql.VarChar, payload.rSocial)
    .input('correo', sql.VarChar, payload.correo)
    .input('celular', sql.VarChar, payload.celular)
    .input('condicion', sql.VarChar, payload.condicion)
    .input('sujetoCredito', sql.Bit, payload.sujetoCredito ? 1 : 0)
    .input('lineaCredito', sql.Decimal(18, 2), payload.lineaCredito);
  const inSql = buildInParams(request, idEmpresas, 'e');
  return request.query(
    `UPDATE Clientes SET idDocumento = @idDocumento, ruc = @ruc, rSocial = @rSocial, correo = @correo, celular = @celular, condicion = @condicion, sujetoCredito = @sujetoCredito, lineaCredito = @lineaCredito WHERE idCliente = @idCliente AND idEmpresa IN (${inSql})`
  );
}

async function obtenerPorIdCliente(pool, idCliente) {
  const r = await pool
    .request()
    .input('idCliente', sql.Int, idCliente)
    .query(
      'SELECT idCliente, idEmpresa, idDocumento, ruc, rSocial, correo, celular, condicion, estado, sujetoCredito, lineaCredito FROM Clientes WHERE idCliente = @idCliente'
    );
  return r.recordset;
}

async function eliminarEnEmpresas(pool, idEmpresas, idCliente) {
  const request = pool.request().input('idCliente', sql.Int, idCliente);
  const inSql = buildInParams(request, idEmpresas, 'e');
  return request.query(`DELETE FROM Clientes WHERE idCliente = @idCliente AND idEmpresa IN (${inSql})`);
}

async function actualizarCondicion(pool, idCliente, condicion, idEmpresa) {
  const r = await pool
    .request()
    .input('idCliente', sql.Int, idCliente)
    .input('nuevacondicion', sql.VarChar, condicion)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('UPDATE Clientes SET condicion = @nuevacondicion WHERE idCliente = @idCliente AND idEmpresa = @idEmpresa');
  return r.rowsAffected;
}

async function actualizarEstado(pool, idCliente, estado, idEmpresa) {
  const r = await pool
    .request()
    .input('idCliente', sql.Int, idCliente)
    .input('estado', sql.Bit, estado ? 1 : 0)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('UPDATE Clientes SET estado = @estado WHERE idCliente = @idCliente AND idEmpresa = @idEmpresa');
  return r.rowsAffected;
}

module.exports = {
  buscarPorRuc,
  insertar,
  obtenerPorRuc,
  listarPorEmpresa,
  listarPorRucEmpresas,
  listarPorIdClienteEmpresas,
  actualizarEnEmpresas,
  obtenerPorIdCliente,
  eliminarEnEmpresas,
  actualizarCondicion,
  actualizarEstado
};
