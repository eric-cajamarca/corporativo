const sql = require('mssql');

async function obtenerPorEmpresa(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1
        idSuscripcion,
        idEmpresa,
        planCode,
        billingCycle,
        estado,
        CONVERT(VARCHAR(19), fechaInicio, 120) AS fechaInicio,
        CONVERT(VARCHAR(19), fechaFin, 120) AS fechaFin,
        idCheckoutOrigen,
        migracionDemoPendiente,
        ISNULL(contadorComprobantesSunatAceptados, 0) AS contadorComprobantesSunatAceptados
      FROM EmpresaSuscripcion
      WHERE idEmpresa = @idEmpresa
    `);
  return r.recordset[0] || null;
}

async function insertar(pool, row) {
  await pool
    .request()
    .input('idSuscripcion', sql.UniqueIdentifier, row.idSuscripcion)
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('planCode', sql.VarChar(30), row.planCode)
    .input('billingCycle', sql.VarChar(10), row.billingCycle)
    .input('estado', sql.VarChar(30), row.estado)
    .input('fechaInicio', sql.DateTime, row.fechaInicio)
    .input('fechaFin', sql.DateTime2, row.fechaFin)
    .input('idCheckoutOrigen', sql.UniqueIdentifier, row.idCheckoutOrigen)
    .input('migracionDemoPendiente', sql.Bit, row.migracionDemoPendiente ? 1 : 0)
    .query(`
      INSERT INTO EmpresaSuscripcion (
        idSuscripcion, idEmpresa, planCode, billingCycle, estado, fechaInicio, fechaFin, idCheckoutOrigen, migracionDemoPendiente
      ) VALUES (
        @idSuscripcion, @idEmpresa, @planCode, @billingCycle, @estado, @fechaInicio, @fechaFin, @idCheckoutOrigen, @migracionDemoPendiente
      )
    `);
}

async function actualizarEstadoYPlan(pool, idEmpresa, patch) {
  const sets = [];
  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  if (patch.planCode != null) {
    sets.push('planCode = @planCode');
    req.input('planCode', sql.VarChar(30), patch.planCode);
  }
  if (patch.billingCycle !== undefined) {
    sets.push('billingCycle = @billingCycle');
    req.input('billingCycle', sql.VarChar(10), patch.billingCycle);
  }
  if (patch.estado != null) {
    sets.push('estado = @estado');
    req.input('estado', sql.VarChar(30), patch.estado);
  }
  if (patch.fechaFin !== undefined) {
    sets.push('fechaFin = @fechaFin');
    req.input('fechaFin', sql.DateTime2, patch.fechaFin);
  }
  if (patch.idCheckoutOrigen !== undefined) {
    sets.push('idCheckoutOrigen = @idCheckoutOrigen');
    req.input('idCheckoutOrigen', sql.UniqueIdentifier, patch.idCheckoutOrigen);
  }
  if (patch.migracionDemoPendiente !== undefined) {
    sets.push('migracionDemoPendiente = @migracionDemoPendiente');
    req.input('migracionDemoPendiente', sql.Bit, patch.migracionDemoPendiente ? 1 : 0);
  }
  if (sets.length === 0) return;
  await req.query(`UPDATE EmpresaSuscripcion SET ${sets.join(', ')} WHERE idEmpresa = @idEmpresa`);
}

async function marcarVencidas(pool, fechaReferencia) {
  const r = await pool
    .request()
    .input('ahora', sql.DateTime2, fechaReferencia)
    .query(`
      UPDATE EmpresaSuscripcion
      SET estado = 'VENCIDA'
      WHERE estado IN ('DEMO', 'ACTIVA')
        AND fechaFin IS NOT NULL
        AND fechaFin < @ahora
    `);
  return r.rowsAffected[0] || 0;
}

/**
 * Suma 1 al contador de comprobantes SUNAT aceptados de la empresa (suscripción).
 * @param {import('mssql').ConnectionPool|import('mssql').Transaction} poolOrTx
 */
async function incrementarContadorComprobantesSunatAceptados(poolOrTx, idEmpresa) {
  if (!idEmpresa) return;
  await poolOrTx
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      UPDATE dbo.EmpresaSuscripcion
      SET contadorComprobantesSunatAceptados = ISNULL(contadorComprobantesSunatAceptados, 0) + 1
      WHERE idEmpresa = @idEmpresa
    `);
}

/** Sube el contador persistido si el valor calculado (p. ej. histórico desde tablas) es mayor. */
async function actualizarContadorSunatSiInferior(pool, idEmpresa, valor) {
  const v = Math.floor(Number(valor));
  if (!idEmpresa || !Number.isFinite(v) || v < 0) return;
  try {
    await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('valor', sql.Int, v)
      .query(`
        UPDATE dbo.EmpresaSuscripcion
        SET contadorComprobantesSunatAceptados = @valor
        WHERE idEmpresa = @idEmpresa
          AND ISNULL(contadorComprobantesSunatAceptados, 0) < @valor
      `);
  } catch (err) {
    console.error('contexto: actualizarContadorSunatSiInferior', err);
  }
}

module.exports = {
  obtenerPorEmpresa,
  insertar,
  actualizarEstadoYPlan,
  marcarVencidas,
  incrementarContadorComprobantesSunatAceptados,
  actualizarContadorSunatSiInferior
};
