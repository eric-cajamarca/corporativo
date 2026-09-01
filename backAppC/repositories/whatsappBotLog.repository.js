const sql = require('mssql');

async function insertar(pool, idEmpresa, data) {
  try {
    await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('direccion', sql.VarChar(10), data.direccion)
      .input('telefonoCliente', sql.VarChar(20), data.telefonoCliente)
      .input('messageId', sql.VarChar(100), data.messageId || null)
      .input('texto', sql.NVarChar(2000), data.texto)
      .query(`
        INSERT INTO WhatsAppBotLog (idEmpresa, direccion, telefonoCliente, messageId, texto)
        VALUES (@idEmpresa, @direccion, @telefonoCliente, @messageId, @texto)
      `);
  } catch (e) {
    if (e && e.number === 208) return;
    throw e;
  }
}

async function listar(pool, idEmpresa, limite = 50) {
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('limite', sql.Int, Math.min(200, Math.max(1, limite)))
      .query(`
        SELECT TOP (@limite) idLog, direccion, telefonoCliente, messageId, texto,
               CONVERT(VARCHAR(19), fRegistro, 120) AS fRegistro
        FROM WhatsAppBotLog
        WHERE idEmpresa = @idEmpresa
        ORDER BY fRegistro DESC
      `);
    return r.recordset || [];
  } catch (e) {
    if (e && e.number === 208) return [];
    throw e;
  }
}

async function listarPorTelefono(pool, idEmpresa, telefonoCliente, limite = 6) {
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('telefonoCliente', sql.VarChar(40), String(telefonoCliente || '').slice(0, 40))
      .input('limite', sql.Int, Math.min(50, Math.max(1, limite)))
      .query(`
        SELECT TOP (@limite) direccion, texto,
               CONVERT(VARCHAR(19), fRegistro, 120) AS fRegistro
        FROM WhatsAppBotLog
        WHERE idEmpresa = @idEmpresa AND telefonoCliente = @telefonoCliente
        ORDER BY fRegistro DESC
      `);
    return (r.recordset || []).reverse();
  } catch (e) {
    if (e && e.number === 208) return [];
    throw e;
  }
}

async function eliminarPorTelefono(pool, idEmpresa, telefonoCliente) {
  try {
    await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('telefonoCliente', sql.VarChar(20), telefonoCliente)
      .query(`
        DELETE FROM WhatsAppBotLog
        WHERE idEmpresa = @idEmpresa AND telefonoCliente = @telefonoCliente
      `);
  } catch (e) {
    if (e && e.number === 208) return;
    throw e;
  }
}

async function eliminarAntiguos(pool, dias = 60) {
  const n = Math.min(365, Math.max(7, Number(dias) || 60));
  try {
    const r = await pool
      .request()
      .input('dias', sql.Int, n)
      .query(`
        DECLARE @n INT;
        DELETE FROM WhatsAppBotLog
        WHERE fRegistro < DATEADD(day, -@dias, GETDATE());
        SET @n = @@ROWCOUNT;
        SELECT @n AS eliminados;
      `);
    const rows = r.recordset || [];
    return Number(rows[0]?.eliminados || 0);
  } catch (e) {
    if (e && e.number === 208) return 0;
    throw e;
  }
}

module.exports = { insertar, listar, listarPorTelefono, eliminarPorTelefono, eliminarAntiguos };
