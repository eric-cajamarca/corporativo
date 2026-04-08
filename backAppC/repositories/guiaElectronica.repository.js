const sql = require("mssql");

/**
 * Lista guías electrónicas emitidas por empresa con paginación.
 * @param {import('mssql').ConnectionPool} pool
 * @param {string} idEmpresa UUID
 * @param {{ pagina?: number, porPagina?: number }} opts
 * @returns {Promise<{ items: object[], total: number }>}
 */
exports.listarGuiasEmitidasPaginadoRepo = async (pool, idEmpresa, opts = {}) => {
  const pagina = Math.max(1, parseInt(String(opts.pagina || 1), 10) || 1);
  const porPagina = Math.min(100, Math.max(1, parseInt(String(opts.porPagina || 10), 10) || 10));
  const offset = (pagina - 1) * porPagina;

  const reqCount = pool.request().input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  const countR = await reqCount.query(`
    SELECT COUNT(*) AS total
    FROM GuiasElectronicasEmitidas
    WHERE idEmpresa = @idEmpresa
  `);
  const total = countR.recordset?.[0]?.total ?? 0;

  const req = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("offset", sql.Int, offset)
    .input("limite", sql.Int, porPagina);

  const result = await req.query(`
    SELECT
      g.idGuiaElectronica,
      g.tipoDocumento,
      g.tipoRol,
      g.serie,
      g.numero,
      CONVERT(VARCHAR(19), g.fechaEmision, 120) AS fechaEmision,
      g.idEstadoSunat,
      g.descripcionEstado,
      g.ticketSunat,
      g.comprobanteOrigenSerie,
      g.comprobanteOrigenNumero,
      g.motivoTraslado,
      CONVERT(VARCHAR(19), g.fechaCreacion, 120) AS fechaCreacion
    FROM GuiasElectronicasEmitidas g
    WHERE g.idEmpresa = @idEmpresa
    ORDER BY g.fechaEmision DESC, g.fechaCreacion DESC
    OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY
  `);

  return { items: result.recordset || [], total: Number(total) || 0 };
};
