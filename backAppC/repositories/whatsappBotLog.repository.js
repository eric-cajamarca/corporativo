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

module.exports = { insertar, listar };
