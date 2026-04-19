const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');

const PROVEEDORES = {
  twilio: 'twilioHabilitado',
  izipay: 'izipayHabilitado',
  culqi: 'culqiHabilitado',
  apisperu: 'apisPeruHabilitado',
  factiliza: 'factilizaHabilitado'
};

/**
 * Middleware que exige que la empresa del usuario tenga habilitada la integración del proveedor.
 * Debe usarse después de auth (req.user.empresa debe existir).
 * @param {string} proveedor - 'twilio' | 'izipay' | 'culqi' | 'apisperu' | 'factiliza'
 */
function verificarIntegracion(proveedor) {
  const columna = PROVEEDORES[proveedor];
  if (!columna) {
    return (req, res, next) => {
      return res.status(500).json({ message: 'Proveedor de integración no válido' });
    };
  }
  return async (req, res, next) => {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(401).json({ message: 'No autorizado: empresa no identificada' });
    }
    try {
      await withPool(async (pool) => {
        const result = await pool.request()
          .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
          .query(`SELECT ${columna} AS habilitado FROM EmpresaIntegraciones WHERE idEmpresa = @idEmpresa`);
        const row = result.recordset[0];
        if (!row || !row.habilitado) {
          return res.status(403).json({
            message: `La integración ${proveedor} no está habilitada para tu empresa. Configúrala en integraciones.`
          });
        }
        next();
      });
    } catch (err) {
      console.error('verificarIntegracion error:', err?.message || err);
      return res.status(500).json({ message: 'Error al verificar integración' });
    }
  };
}

module.exports = { verificarIntegracion };
