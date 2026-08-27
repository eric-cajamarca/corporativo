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
        ISNULL(contadorComprobantesSunatAceptados, 0) AS contadorComprobantesSunatAceptados,
        planCodePendiente,
        billingCyclePendiente
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
  if (patch.planCodePendiente !== undefined) {
    sets.push('planCodePendiente = @planCodePendiente');
    req.input('planCodePendiente', sql.VarChar(30), patch.planCodePendiente);
  }
  if (patch.billingCyclePendiente !== undefined) {
    sets.push('billingCyclePendiente = @billingCyclePendiente');
    req.input('billingCyclePendiente', sql.VarChar(10), patch.billingCyclePendiente);
  }
  if (sets.length === 0) return;
  await req.query(`UPDATE EmpresaSuscripcion SET ${sets.join(', ')} WHERE idEmpresa = @idEmpresa`);
}

/**
 * Aplica planCodePendiente / billingCyclePendiente a filas vencidas y limpia pendientes.
 * @returns {number} filas con pendiente aplicado
 */
async function aplicarPlanesPendientesAlVencer(pool, fechaReferencia) {
  const r = await pool
    .request()
    .input('ahora', sql.DateTime2, fechaReferencia)
    .query(`
      UPDATE EmpresaSuscripcion
      SET
        planCode = planCodePendiente,
        billingCycle = ISNULL(billingCyclePendiente, billingCycle),
        planCodePendiente = NULL,
        billingCyclePendiente = NULL
      WHERE estado IN ('DEMO', 'ACTIVA')
        AND fechaFin IS NOT NULL
        AND fechaFin < @ahora
        AND planCodePendiente IS NOT NULL
        AND LTRIM(RTRIM(planCodePendiente)) <> ''
    `);
  return r.rowsAffected[0] || 0;
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

/**
 * Suscripciones que requieren aviso: por vencer dentro de @diasPreaviso o ya vencidas.
 * El filtro va en SQL para no traer toda la cartera de empresas al proceso.
 * @returns {Promise<Array<{tipoAviso: 'POR_VENCER'|'VENCIDA'}>>}
 */
async function listarParaAvisoVencimiento(pool, diasPreaviso) {
  const dias = Number.isFinite(Number(diasPreaviso)) ? Math.max(0, Math.floor(Number(diasPreaviso))) : 1;
  const r = await pool
    .request()
    .input('diasPreaviso', sql.Int, dias)
    .query(`
      SELECT
        s.idEmpresa,
        s.planCode,
        s.billingCycle,
        s.estado AS estadoSuscripcion,
        CONVERT(VARCHAR(19), s.fechaFin, 120) AS fechaFin,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), CAST(s.fechaFin AS DATE)) AS diasRestantes,
        CASE
          WHEN s.estado IN ('DEMO', 'ACTIVA') THEN 'POR_VENCER'
          ELSE 'VENCIDA'
        END AS tipoAviso,
        e.razon_Social AS razonSocial,
        e.correo AS correoEmpresa,
        e.celular AS celularEmpresa,
        ISNULL((
          SELECT TOP 1 u.email
          FROM dbo.UsuarioWeb u
          WHERE u.idEmpresa = s.idEmpresa
            AND ISNULL(u.estado, 1) = 1
            AND ISNULL(LTRIM(RTRIM(u.email)), '') <> ''
          ORDER BY u.fRegistro ASC
        ), '') AS correoUsuario
      FROM EmpresaSuscripcion s
      INNER JOIN Empresas e ON e.idEmpresa = s.idEmpresa
      WHERE s.fechaFin IS NOT NULL
        AND (
          (
            s.estado IN ('DEMO', 'ACTIVA')
            AND DATEDIFF(DAY, CAST(GETDATE() AS DATE), CAST(s.fechaFin AS DATE)) BETWEEN 0 AND @diasPreaviso
          )
          OR (
            s.estado IN ('VENCIDA', 'PENDIENTE_PAGO')
            AND s.fechaFin < GETDATE()
          )
        )
      ORDER BY s.fechaFin ASC
    `);
  return r.recordset || [];
}

/**
 * Mismos campos que listarParaAvisoVencimiento para una empresa puntual
 * (avisos disparados por evento, p. ej. confirmación de pago).
 */
async function obtenerDatosAvisoPorEmpresa(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1
        s.idEmpresa,
        s.planCode,
        s.billingCycle,
        s.estado AS estadoSuscripcion,
        CONVERT(VARCHAR(19), s.fechaFin, 120) AS fechaFin,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), CAST(s.fechaFin AS DATE)) AS diasRestantes,
        e.razon_Social AS razonSocial,
        e.correo AS correoEmpresa,
        e.celular AS celularEmpresa,
        ISNULL((
          SELECT TOP 1 u.email
          FROM dbo.UsuarioWeb u
          WHERE u.idEmpresa = s.idEmpresa
            AND ISNULL(u.estado, 1) = 1
            AND ISNULL(LTRIM(RTRIM(u.email)), '') <> ''
          ORDER BY u.fRegistro ASC
        ), '') AS correoUsuario
      FROM EmpresaSuscripcion s
      INNER JOIN Empresas e ON e.idEmpresa = s.idEmpresa
      WHERE s.idEmpresa = @idEmpresa
    `);
  return r.recordset[0] || null;
}

module.exports = {
  obtenerPorEmpresa,
  listarParaAvisoVencimiento,
  obtenerDatosAvisoPorEmpresa,
  insertar,
  actualizarEstadoYPlan,
  aplicarPlanesPendientesAlVencer,
  marcarVencidas,
  incrementarContadorComprobantesSunatAceptados,
  actualizarContadorSunatSiInferior
};
