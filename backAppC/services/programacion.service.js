const sql = require('mssql');
const programacionRepository = require('../repositories/programacion.repository');

function construirFiltrosProgramacion(user, query) {
  const whereClauses = [];
  const parameters = [];
  const rol = user.rol;
  const id = user.id;

  if (rol === 'Conductor') {
    whereClauses.push('pp.idConductor = @idConductor');
    parameters.push({ name: 'idConductor', type: sql.Int, value: id });
  }
  const { idEstado, fechaDesde, fechaHasta, ruc, cliente } = query;
  if (idEstado != null && String(idEstado).trim() !== '') {
    whereClauses.push('pp.idEstado = @idEstado');
    parameters.push({ name: 'idEstado', type: sql.Int, value: parseInt(idEstado, 10) });
  }
  const fechaDesdeVal =
    fechaDesde != null && String(fechaDesde).trim() !== '' ? String(fechaDesde).trim().substring(0, 10) : null;
  const fechaHastaVal =
    fechaHasta != null && String(fechaHasta).trim() !== '' ? String(fechaHasta).trim().substring(0, 10) : null;
  if (fechaDesdeVal) {
    whereClauses.push('(pp.FEnvio >= @fechaDesde OR CONVERT(VARCHAR(10), pp.FechaEntrega, 120) >= @fechaDesde)');
    parameters.push({ name: 'fechaDesde', type: sql.VarChar(10), value: fechaDesdeVal });
  }
  if (fechaHastaVal) {
    whereClauses.push('(pp.FEnvio <= @fechaHasta OR CONVERT(VARCHAR(10), pp.FechaEntrega, 120) <= @fechaHasta)');
    parameters.push({ name: 'fechaHasta', type: sql.VarChar(10), value: fechaHastaVal });
  }
  const rucVal = ruc != null && String(ruc).trim() !== '' ? String(ruc).trim() : null;
  if (rucVal) {
    whereClauses.push('(pp.RSocial LIKE @termRuc OR pp.Ruc LIKE @termRuc)');
    parameters.push({ name: 'termRuc', type: sql.VarChar(100), value: `%${rucVal}%` });
  }
  const clienteVal = cliente != null && String(cliente).trim() !== '' ? String(cliente).trim() : null;
  if (clienteVal) {
    whereClauses.push('pp.RSocial LIKE @termCliente');
    parameters.push({ name: 'termCliente', type: sql.VarChar(100), value: `%${clienteVal}%` });
  }
  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
  return { whereSql, parameters };
}

async function obtenerProgramacion(pool, user, query) {
  if (!user) throw new Error('NO_AUTH');
  const { whereSql, parameters } = construirFiltrosProgramacion(user, query);
  return programacionRepository.listarProgramacion(pool, whereSql, parameters);
}

async function obtenerProgramacionPorRol(pool, user) {
  if (!user) throw new Error('NO_AUTH');
  const rol = user.rol;
  const id = user.id;
  if (rol === 'Administrador') {
    return programacionRepository.listarProgramacionAdmin(pool);
  }
  if (rol === 'Conductor') {
    return programacionRepository.listarProgramacionConductor(pool, id);
  }
  throw new Error('NO_PERM');
}

module.exports = {
  obtenerProgramacion,
  obtenerProgramacionPorRol
};
