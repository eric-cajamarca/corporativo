const sql = require('mssql');

/**
 * Limpia bloqueo vencido y reinicia contador para poder reintentar.
 */
exports.limpiarBloqueoSiExpirado = async (pool, idEmpresa, emailNormalizado) => {
  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('email', sql.VarChar(320), emailNormalizado)
    .query(`
      UPDATE SeguridadLoginIntento
      SET intentosFallidos = 0,
          bloqueadoHasta = NULL
      WHERE idEmpresa = @idEmpresa
        AND emailNormalizado = @email
        AND bloqueadoHasta IS NOT NULL
        AND bloqueadoHasta <= GETDATE()
    `);
};

exports.obtenerEstado = async (pool, idEmpresa, emailNormalizado) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('email', sql.VarChar(320), emailNormalizado)
    .query(`
      SELECT intentosFallidos, bloqueadoHasta
      FROM SeguridadLoginIntento
      WHERE idEmpresa = @idEmpresa AND emailNormalizado = @email
    `);
  if (!r.recordset.length) {
    return { intentosFallidos: 0, bloqueadoHasta: null };
  }
  return {
    intentosFallidos: r.recordset[0].intentosFallidos || 0,
    bloqueadoHasta: r.recordset[0].bloqueadoHasta
  };
};

/**
 * Incrementa fallos; si alcanza maxIntentos fija bloqueadoHasta.
 * @param {string|null} [ipCliente] - IP del cliente (VARCHAR 45).
 * @returns {Promise<{ intentosFallidos: number, recienBloqueado: boolean }>}
 */
exports.registrarFallo = async (
  pool,
  idEmpresa,
  emailNormalizado,
  maxIntentos,
  minutosBloqueo,
  ipCliente = null
) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const ipNorm = ipCliente && String(ipCliente).trim() ? String(ipCliente).trim().slice(0, 45) : null;

    const reqSel = new sql.Request(transaction);
    reqSel.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    reqSel.input('email', sql.VarChar(320), emailNormalizado);
    const sel = await reqSel.query(`
      SELECT intentosFallidos
      FROM SeguridadLoginIntento WITH (UPDLOCK, HOLDLOCK)
      WHERE idEmpresa = @idEmpresa AND emailNormalizado = @email
    `);

    let nuevosIntentos = 1;
    if (sel.recordset.length > 0) {
      nuevosIntentos = (sel.recordset[0].intentosFallidos || 0) + 1;
    }

    const recienBloqueado = nuevosIntentos >= maxIntentos;
    const reqUp = new sql.Request(transaction);
    reqUp.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    reqUp.input('email', sql.VarChar(320), emailNormalizado);
    reqUp.input('intentos', sql.Int, nuevosIntentos);
    reqUp.input('minBloqueo', sql.Int, minutosBloqueo);
    reqUp.input('ip', sql.VarChar(45), ipNorm);

    if (recienBloqueado) {
      await reqUp.query(`
        MERGE SeguridadLoginIntento AS t
        USING (SELECT @idEmpresa AS idEmpresa, @email AS emailNormalizado) AS s
        ON t.idEmpresa = s.idEmpresa AND t.emailNormalizado = s.emailNormalizado
        WHEN MATCHED THEN
          UPDATE SET
            intentosFallidos = @intentos,
            bloqueadoHasta = DATEADD(MINUTE, @minBloqueo, GETDATE()),
            ultimoIntento = GETDATE(),
            ipUltimoIntento = @ip
        WHEN NOT MATCHED THEN
          INSERT (idEmpresa, emailNormalizado, intentosFallidos, bloqueadoHasta, ultimoIntento, ipUltimoIntento)
          VALUES (@idEmpresa, @email, @intentos, DATEADD(MINUTE, @minBloqueo, GETDATE()), GETDATE(), @ip);
      `);
    } else {
      await reqUp.query(`
        MERGE SeguridadLoginIntento AS t
        USING (SELECT @idEmpresa AS idEmpresa, @email AS emailNormalizado) AS s
        ON t.idEmpresa = s.idEmpresa AND t.emailNormalizado = s.emailNormalizado
        WHEN MATCHED THEN
          UPDATE SET
            intentosFallidos = @intentos,
            ultimoIntento = GETDATE(),
            ipUltimoIntento = @ip
        WHEN NOT MATCHED THEN
          INSERT (idEmpresa, emailNormalizado, intentosFallidos, bloqueadoHasta, ultimoIntento, ipUltimoIntento)
          VALUES (@idEmpresa, @email, @intentos, NULL, GETDATE(), @ip);
      `);
    }

    await transaction.commit();
    return { intentosFallidos: nuevosIntentos, recienBloqueado };
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
};

exports.resetPorExito = async (pool, idEmpresa, emailNormalizado) => {
  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('email', sql.VarChar(320), emailNormalizado)
    .query(`
      DELETE FROM SeguridadLoginIntento
      WHERE idEmpresa = @idEmpresa AND emailNormalizado = @email
    `);
};
