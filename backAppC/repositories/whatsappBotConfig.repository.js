const sql = require('mssql');

const DEFAULTS = {
  mensajeBienvenida: 'Hola! Bienvenido. Escriba MENU para ver opciones.',
  mensajeNoRegistrado: 'No encontramos su numero registrado. Contacte a la empresa para registrarse.'
};

async function getByEmpresa(pool, idEmpresa) {
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT idEmpresa, activoBot, idListaPrecio, mensajeBienvenida, mensajeNoRegistrado,
               CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion
        FROM WhatsAppBotConfig WHERE idEmpresa = @idEmpresa
      `);
    return r.recordset[0] || null;
  } catch (e) {
    if (e && e.number === 208) return null;
    throw e;
  }
}

async function upsert(pool, idEmpresa, data) {
  const activoBot = data.activoBot === false || data.activoBot === 0 ? 0 : 1;
  const mensajeBienvenida = data.mensajeBienvenida != null
    ? String(data.mensajeBienvenida).slice(0, 500)
    : DEFAULTS.mensajeBienvenida;
  const mensajeNoRegistrado = data.mensajeNoRegistrado != null
    ? String(data.mensajeNoRegistrado).slice(0, 500)
    : DEFAULTS.mensajeNoRegistrado;

  await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('activoBot', sql.Bit, activoBot)
    .input('idListaPrecio', sql.UniqueIdentifier, data.idListaPrecio || null)
    .input('mensajeBienvenida', sql.NVarChar(500), mensajeBienvenida)
    .input('mensajeNoRegistrado', sql.NVarChar(500), mensajeNoRegistrado)
    .query(`
      MERGE WhatsAppBotConfig AS t
      USING (SELECT @idEmpresa AS idEmpresa) AS s ON t.idEmpresa = s.idEmpresa
      WHEN MATCHED THEN UPDATE SET
        activoBot = @activoBot, idListaPrecio = @idListaPrecio,
        mensajeBienvenida = @mensajeBienvenida, mensajeNoRegistrado = @mensajeNoRegistrado,
        fActualizacion = GETDATE()
      WHEN NOT MATCHED THEN INSERT (idEmpresa, activoBot, idListaPrecio, mensajeBienvenida, mensajeNoRegistrado)
        VALUES (@idEmpresa, @activoBot, @idListaPrecio, @mensajeBienvenida, @mensajeNoRegistrado);
    `);
}

async function getOrCreate(pool, idEmpresa) {
  let row = await getByEmpresa(pool, idEmpresa);
  if (!row) {
    await upsert(pool, idEmpresa, { activoBot: true, ...DEFAULTS });
    row = await getByEmpresa(pool, idEmpresa);
  }
  return row;
}

module.exports = { getByEmpresa, upsert, getOrCreate, DEFAULTS };
