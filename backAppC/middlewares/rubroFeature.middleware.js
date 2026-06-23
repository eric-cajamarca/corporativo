const sql = require('mssql');
const dbConfig = require('../dbconfig');
const { esRubroGrifo, esRubroHotel } = require('../utils/rubroEmpresa.util');

/**
 * Middleware: exige que la empresa del JWT tenga el rubro indicado.
 * @param {'GRF'|'HOTEL'} codigoRequerido
 */
function requireRubro(codigoRequerido) {
  return async function requireRubroMiddleware(req, res, next) {
    const idEmpresa = req.user?.empresa;
    if (!idEmpresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    try {
      const pool = await sql.connect(dbConfig);
      const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          SELECT LTRIM(RTRIM(ISNULL(r.codigo, ''))) AS codigoRubro,
                 LTRIM(RTRIM(ISNULL(e.rubro, ''))) AS rubro
          FROM Empresas e
          LEFT JOIN Rubros r ON e.idRubro = r.idRubro
          WHERE e.idEmpresa = @idEmpresa
        `);
      const row = result.recordset?.[0] || {};
      const codigo = String(row.codigoRubro || '').trim().toUpperCase();
      const rubro = row.rubro || '';

      const ok =
        codigoRequerido === 'GRF'
          ? esRubroGrifo(codigo, rubro)
          : codigoRequerido === 'HOTEL'
            ? esRubroHotel(codigo, rubro)
            : codigo === String(codigoRequerido).trim().toUpperCase();

      if (!ok) {
        return res.status(403).json({
          message: `Esta operación solo está disponible para empresas con rubro ${codigoRequerido}.`
        });
      }
      req.rubroEmpresa = { codigoRubro: codigo, rubro };
      return next();
    } catch (error) {
      console.error('requireRubro:', error);
      return res.status(500).json({ message: 'Error al validar rubro de la empresa' });
    }
  };
}

module.exports = { requireRubro };
