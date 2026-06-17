const sql = require('mssql');

/**
 * Inserta un registro de auditoría operativa.
 */
exports.insertar = async (pool, params) => {
  const {
    idEmpresa,
    idUsuario = null,
    modulo,
    accion,
    idRegistro = null,
    referencia = null,
    detalle = null,
    ipCliente = null,
    userAgent = null
  } = params;

  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('modulo', sql.VarChar(40), String(modulo).slice(0, 40))
    .input('accion', sql.VarChar(60), String(accion).slice(0, 60))
    .input('idRegistro', sql.NVarChar(100), idRegistro != null ? String(idRegistro).slice(0, 100) : null)
    .input('referencia', sql.NVarChar(200), referencia != null ? String(referencia).slice(0, 200) : null)
    .input('detalle', sql.NVarChar(500), detalle != null ? String(detalle).slice(0, 500) : null)
    .input('ipCliente', sql.VarChar(45), ipCliente ? String(ipCliente).slice(0, 45) : null)
    .input('userAgent', sql.NVarChar(500), userAgent ? String(userAgent).slice(0, 500) : null)
    .query(`
      INSERT INTO AuditoriaOperaciones (
        idEmpresa, idUsuario, modulo, accion, idRegistro, referencia, detalle, ipCliente, userAgent
      )
      VALUES (
        @idEmpresa, @idUsuario, @modulo, @accion, @idRegistro, @referencia, @detalle, @ipCliente, @userAgent
      )
    `);
};

/**
 * Elimina registros más antiguos que retentionMonths meses.
 * @returns {number} filas eliminadas
 */
exports.purgarAntiguos = async (pool, retentionMonths) => {
  const meses = Math.max(1, Number(retentionMonths) || 6);
  const result = await pool
    .request()
    .input('meses', sql.Int, meses)
    .query(`
      DELETE FROM AuditoriaOperaciones
      WHERE fecha < DATEADD(MONTH, -@meses, GETDATE())
    `);
  return result.rowsAffected?.[0] ?? 0;
};
