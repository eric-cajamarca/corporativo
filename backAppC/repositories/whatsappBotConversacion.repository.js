const sql = require('mssql');

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function obtener(pool, idEmpresa, telefonoCliente) {
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('telefonoCliente', sql.VarChar(20), telefonoCliente)
      .query(`
        SELECT idConversacion, idEmpresa, telefonoCliente, estado, slotsJson, candidatosJson,
               CONVERT(VARCHAR(19), fExpira, 120) AS fExpira,
               CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion
        FROM WhatsAppBotConversacion
        WHERE idEmpresa = @idEmpresa AND telefonoCliente = @telefonoCliente AND fExpira > GETDATE()
      `);
    const row = r.recordset[0];
    if (!row) return null;
    return {
      ...row,
      slots: parseJson(row.slotsJson, {}),
      candidatos: parseJson(row.candidatosJson, [])
    };
  } catch (e) {
    if (e && e.number === 208) return null;
    throw e;
  }
}

async function guardar(pool, idEmpresa, telefonoCliente, data) {
  const estado = String(data.estado || 'menu').slice(0, 40);
  const slotsJson = JSON.stringify(data.slots || {});
  const candidatosJson = JSON.stringify(data.candidatos || []);
  const minutos = Number(data.minutosExpira) || 30;

  await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('telefonoCliente', sql.VarChar(20), telefonoCliente)
    .input('estado', sql.VarChar(40), estado)
    .input('slotsJson', sql.NVarChar(sql.MAX), slotsJson)
    .input('candidatosJson', sql.NVarChar(sql.MAX), candidatosJson)
    .input('minutosExpira', sql.Int, minutos)
    .query(`
      MERGE WhatsAppBotConversacion AS t
      USING (SELECT @idEmpresa AS idEmpresa, @telefonoCliente AS telefonoCliente) AS s
        ON t.idEmpresa = s.idEmpresa AND t.telefonoCliente = s.telefonoCliente
      WHEN MATCHED THEN UPDATE SET
        estado = @estado, slotsJson = @slotsJson, candidatosJson = @candidatosJson,
        fExpira = DATEADD(MINUTE, @minutosExpira, GETDATE()), fActualizacion = GETDATE()
      WHEN NOT MATCHED THEN INSERT (idEmpresa, telefonoCliente, estado, slotsJson, candidatosJson, fExpira)
        VALUES (@idEmpresa, @telefonoCliente, @estado, @slotsJson, @candidatosJson, DATEADD(MINUTE, @minutosExpira, GETDATE()));
    `);
}

async function reiniciar(pool, idEmpresa, telefonoCliente) {
  await guardar(pool, idEmpresa, telefonoCliente, { estado: 'menu', slots: {}, candidatos: [] });
}

async function listarEscaladas(pool, idEmpresa) {
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT idConversacion, idEmpresa, telefonoCliente, estado, slotsJson,
               CONVERT(VARCHAR(19), fExpira, 120) AS fExpira,
               CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion
        FROM WhatsAppBotConversacion
        WHERE idEmpresa = @idEmpresa AND estado = 'escalada' AND fExpira > GETDATE()
        ORDER BY fActualizacion DESC
      `);
    return (r.recordset || []).map((row) => ({
      ...row,
      slots: parseJson(row.slotsJson, {})
    }));
  } catch (e) {
    if (e && e.number === 208) return [];
    throw e;
  }
}

async function eliminar(pool, idEmpresa, telefonoCliente) {
  try {
    await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('telefonoCliente', sql.VarChar(20), telefonoCliente)
      .query(`
        DELETE FROM WhatsAppBotConversacion
        WHERE idEmpresa = @idEmpresa AND telefonoCliente = @telefonoCliente
      `);
  } catch (e) {
    if (e && e.number === 208) return;
    throw e;
  }
}

module.exports = { obtener, guardar, reiniciar, eliminar, listarEscaladas };
