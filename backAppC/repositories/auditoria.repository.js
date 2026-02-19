/**
 * Repository: AuditoriaUsuario
 * Solo lectura. Filtra por idEmpresa en todas las consultas.
 */
const sql = require('mssql');

/**
 * Lista registros de auditoría con filtros opcionales
 * @param {object} pool - Pool de conexión
 * @param {string} idEmpresa - UUID empresa (del token)
 * @param {object} filtros - { idUsuario, accion, fechaDesde, fechaHasta, pagina, porPagina }
 */
exports.listarRepo = async (pool, idEmpresa, filtros = {}) => {
  const { idUsuario, accion, fechaDesde, fechaHasta, pagina = 1, porPagina = 50 } = filtros;
  const offset = (Number(pagina) - 1) * Number(porPagina);

  let whereClause = 'WHERE au.idEmpresa = @idEmpresa';
  if (idUsuario) whereClause += ' AND au.idUsuario = @idUsuario';
  if (accion) whereClause += ' AND au.accion LIKE @accion';
  if (fechaDesde) whereClause += ' AND au.fechaAccion >= @fechaDesde';
  if (fechaHasta) whereClause += ' AND au.fechaAccion <= @fechaHasta';

  const request = pool.request();
  request.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  if (idUsuario) request.input('idUsuario', sql.UniqueIdentifier, idUsuario);
  if (accion) request.input('accion', sql.VarChar(100), '%' + accion + '%');
  if (fechaDesde) request.input('fechaDesde', sql.DateTime, fechaDesde);
  if (fechaHasta) request.input('fechaHasta', sql.DateTime, fechaHasta);
  request.input('offset', sql.Int, offset);
  request.input('porPagina', sql.Int, Math.min(Number(porPagina) || 50, 200));

  const query = `
    SELECT
      au.idAuditoria,
      au.idUsuario,
      au.idEmpresa,
      au.accion,
      au.tablaAfectada,
      au.idRegistroAfectado,
      CONVERT(VARCHAR(19), au.fechaAccion, 120) AS fechaAccion,
      au.ipAddress,
      au.userAgent,
      uw.nombres + ' ' + ISNULL(uw.apellidos, '') AS usuarioNombre,
      COUNT(*) OVER() AS total
    FROM AuditoriaUsuario au
    LEFT JOIN UsuarioWeb uw ON au.idUsuario = uw.idUsuario
    ${whereClause}
    ORDER BY au.fechaAccion DESC
    OFFSET @offset ROWS FETCH NEXT @porPagina ROWS ONLY
  `;
  const result = await request.query(query);
  const total = result.recordset.length ? (result.recordset[0].total || 0) : 0;
  const lista = result.recordset.map((r) => {
    const { total: _t, ...rest } = r;
    return rest;
  });
  return { lista, total };
};
