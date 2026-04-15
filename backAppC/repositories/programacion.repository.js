const sql = require('mssql');

async function listarProgramacion(pool, whereSql, parameters) {
  const request = pool.request();
  (parameters || []).forEach((param) => {
    request.input(param.name, param.type, param.value);
  });
  const query = `
    SELECT pp.*, ep.descripcion AS estadoDescripcion, ep.color AS estadoColor
    FROM ProgramacionPedidos pp
    LEFT JOIN EstadosPedidos ep ON pp.idEstado = ep.idEstadoPedido
    ${whereSql || ''}
  `;
  const result = await request.query(query);
  return result.recordset;
}

async function listarProgramacionAdmin(pool) {
  const r = await pool.request().query(`
    SELECT pp.*, ep.descripcion AS estadoDescripcion, ep.color AS estadoColor
    FROM ProgramacionPedidos pp
    INNER JOIN EstadosPedidos ep ON pp.idEstado = ep.idEstadoPedido
  `);
  return r.recordset;
}

async function listarProgramacionConductor(pool, idConductor) {
  const r = await pool
    .request()
    .input('idConductor', sql.Int, idConductor)
    .query('SELECT * FROM ProgramacionPedidos WHERE idConductor = @idConductor');
  return r.recordset;
}

module.exports = {
  listarProgramacion,
  listarProgramacionAdmin,
  listarProgramacionConductor
};
