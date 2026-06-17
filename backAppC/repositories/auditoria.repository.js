/**
 * Repository: AuditoriaOperaciones (log selectivo de operaciones de negocio).
 * Solo lectura en listado. Filtra por idEmpresa en todas las consultas.
 */
const sql = require('mssql');

/**
 * Lista registros de auditoría con filtros opcionales
 * @param {object} pool - Pool de conexión
 * @param {string} idEmpresa - UUID empresa (del token)
 * @param {object} filtros - { idUsuario, accion, modulo, fechaDesde, fechaHasta, pagina, porPagina }
 */
exports.listarRepo = async (pool, idEmpresa, filtros = {}) => {
  const { idUsuario, accion, modulo, fechaDesde, fechaHasta, pagina = 1, porPagina = 50 } = filtros;
  const offset = (Number(pagina) - 1) * Number(porPagina);

  let whereClause = 'WHERE ao.idEmpresa = @idEmpresa';
  if (idUsuario) whereClause += ' AND ao.idUsuario = @idUsuario';
  if (accion) whereClause += ' AND ao.accion LIKE @accion';
  if (modulo) whereClause += ' AND ao.modulo LIKE @modulo';
  if (fechaDesde) whereClause += ' AND ao.fecha >= @fechaDesde';
  if (fechaHasta) whereClause += ' AND ao.fecha <= @fechaHasta';

  const request = pool.request();
  request.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  if (idUsuario) request.input('idUsuario', sql.UniqueIdentifier, idUsuario);
  if (accion) request.input('accion', sql.VarChar(100), '%' + accion + '%');
  if (modulo) request.input('modulo', sql.VarChar(40), '%' + modulo + '%');
  if (fechaDesde) request.input('fechaDesde', sql.DateTime, fechaDesde);
  if (fechaHasta) request.input('fechaHasta', sql.DateTime, fechaHasta);
  request.input('offset', sql.Int, offset);
  request.input('porPagina', sql.Int, Math.min(Number(porPagina) || 50, 200));

  const query = `
    SELECT
      ao.idAuditoria,
      ao.idUsuario,
      ao.idEmpresa,
      ao.accion,
      ao.modulo AS tablaAfectada,
      ao.idRegistro AS idRegistroAfectado,
      ao.referencia,
      ao.detalle,
      CONVERT(VARCHAR(19), ao.fecha, 120) AS fechaAccion,
      ao.ipCliente AS ipAddress,
      ao.userAgent,
      uw.nombres + ' ' + ISNULL(uw.apellidos, '') AS usuarioNombre,
      COUNT(*) OVER() AS total
    FROM AuditoriaOperaciones ao
    LEFT JOIN UsuarioWeb uw ON ao.idUsuario = uw.idUsuario
    ${whereClause}
    ORDER BY ao.fecha DESC
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
