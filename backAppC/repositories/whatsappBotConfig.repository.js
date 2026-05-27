const sql = require('mssql');

const DEFAULTS = {
  mensajeBienvenida: 'Hola! Bienvenido. Escriba MENU para ver opciones.',
  mensajeNoRegistrado: 'No encontramos su numero registrado. Contacte a la empresa para registrarse.',
  // Defaults Fase 3 (deben coincidir con los DEFAULT del SQL).
  humanizar: true,
  tonoFormal: false,
  usarEmojis: true,
  delayMaxMs: 3000,
  mensajeDespedida: null,
  numeroEscalamiento: null,
  escalamientoActivo: true,
  escalamientoTimeoutMin: 60,
  umbralNoEntiendoEscalar: 3
};

// Cache simple para evitar consultar sys.columns en cada lectura del config.
let _columnasFase3Disponibles = null;
async function tieneColumnasFase3(pool) {
  if (_columnasFase3Disponibles !== null) return _columnasFase3Disponibles;
  try {
    const r = await pool.request().query(`
      SELECT COUNT(*) AS n
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.WhatsAppBotConfig')
        AND name IN (
          'humanizar','tonoFormal','usarEmojis','delayMaxMs','mensajeDespedida',
          'numeroEscalamiento','escalamientoActivo','escalamientoTimeoutMin','umbralNoEntiendoEscalar'
        )
    `);
    const n = Number(r.recordset?.[0]?.n || 0);
    _columnasFase3Disponibles = n === 9;
  } catch (e) {
    _columnasFase3Disponibles = false;
  }
  return _columnasFase3Disponibles;
}

function invalidarCacheColumnas() { _columnasFase3Disponibles = null; }

function aplicarDefaults(row) {
  if (!row) return row;
  const out = { ...row };
  if (out.humanizar === undefined || out.humanizar === null) out.humanizar = DEFAULTS.humanizar;
  else out.humanizar = Boolean(out.humanizar);
  if (out.tonoFormal === undefined || out.tonoFormal === null) out.tonoFormal = DEFAULTS.tonoFormal;
  else out.tonoFormal = Boolean(out.tonoFormal);
  if (out.usarEmojis === undefined || out.usarEmojis === null) out.usarEmojis = DEFAULTS.usarEmojis;
  else out.usarEmojis = Boolean(out.usarEmojis);
  if (out.delayMaxMs == null) out.delayMaxMs = DEFAULTS.delayMaxMs;
  else out.delayMaxMs = Math.max(0, Math.min(15000, Number(out.delayMaxMs) || DEFAULTS.delayMaxMs));
  if (out.mensajeDespedida === undefined) out.mensajeDespedida = DEFAULTS.mensajeDespedida;
  if (out.numeroEscalamiento === undefined) out.numeroEscalamiento = DEFAULTS.numeroEscalamiento;
  if (out.escalamientoActivo === undefined || out.escalamientoActivo === null) out.escalamientoActivo = DEFAULTS.escalamientoActivo;
  else out.escalamientoActivo = Boolean(out.escalamientoActivo);
  if (out.escalamientoTimeoutMin == null) out.escalamientoTimeoutMin = DEFAULTS.escalamientoTimeoutMin;
  else out.escalamientoTimeoutMin = Math.max(1, Math.min(1440, Number(out.escalamientoTimeoutMin) || DEFAULTS.escalamientoTimeoutMin));
  if (out.umbralNoEntiendoEscalar == null) out.umbralNoEntiendoEscalar = DEFAULTS.umbralNoEntiendoEscalar;
  else out.umbralNoEntiendoEscalar = Math.max(0, Math.min(20, Number(out.umbralNoEntiendoEscalar) || DEFAULTS.umbralNoEntiendoEscalar));
  return out;
}

async function getByEmpresa(pool, idEmpresa) {
  const fase3 = await tieneColumnasFase3(pool);
  const cols = fase3
    ? `idEmpresa, activoBot, idListaPrecio, mensajeBienvenida, mensajeNoRegistrado,
       humanizar, tonoFormal, usarEmojis, delayMaxMs, mensajeDespedida,
       numeroEscalamiento, escalamientoActivo, escalamientoTimeoutMin, umbralNoEntiendoEscalar,
       CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion`
    : `idEmpresa, activoBot, idListaPrecio, mensajeBienvenida, mensajeNoRegistrado,
       CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion`;

  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`SELECT ${cols} FROM WhatsAppBotConfig WHERE idEmpresa = @idEmpresa`);
    const row = r.recordset[0] || null;
    return aplicarDefaults(row);
  } catch (e) {
    if (e && e.number === 208) return null;
    // Si fallo por columna inexistente (columna recien agregada / cache vencido),
    // invalidamos cache y reintentamos como Fase 2.
    if (e && (e.number === 207 || /Invalid column/i.test(e.message || ''))) {
      _columnasFase3Disponibles = false;
      return getByEmpresa(pool, idEmpresa);
    }
    throw e;
  }
}

function sanitizarNumero(numero) {
  if (numero == null || numero === '') return null;
  const digits = String(numero).replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  return digits;
}

async function upsert(pool, idEmpresa, data) {
  const fase3 = await tieneColumnasFase3(pool);
  const activoBot = data.activoBot === false || data.activoBot === 0 ? 0 : 1;
  const mensajeBienvenida = data.mensajeBienvenida != null
    ? String(data.mensajeBienvenida).slice(0, 500)
    : DEFAULTS.mensajeBienvenida;
  const mensajeNoRegistrado = data.mensajeNoRegistrado != null
    ? String(data.mensajeNoRegistrado).slice(0, 500)
    : DEFAULTS.mensajeNoRegistrado;

  const req = pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('activoBot', sql.Bit, activoBot)
    .input('idListaPrecio', sql.UniqueIdentifier, data.idListaPrecio || null)
    .input('mensajeBienvenida', sql.NVarChar(500), mensajeBienvenida)
    .input('mensajeNoRegistrado', sql.NVarChar(500), mensajeNoRegistrado);

  if (!fase3) {
    await req.query(`
      MERGE WhatsAppBotConfig AS t
      USING (SELECT @idEmpresa AS idEmpresa) AS s ON t.idEmpresa = s.idEmpresa
      WHEN MATCHED THEN UPDATE SET
        activoBot = @activoBot, idListaPrecio = @idListaPrecio,
        mensajeBienvenida = @mensajeBienvenida, mensajeNoRegistrado = @mensajeNoRegistrado,
        fActualizacion = GETDATE()
      WHEN NOT MATCHED THEN INSERT (idEmpresa, activoBot, idListaPrecio, mensajeBienvenida, mensajeNoRegistrado)
        VALUES (@idEmpresa, @activoBot, @idListaPrecio, @mensajeBienvenida, @mensajeNoRegistrado);
    `);
    return;
  }

  // Fase 3 disponible: aceptamos tambien las columnas nuevas con coerciones seguras.
  const humanizar = data.humanizar === false || data.humanizar === 0 ? 0 : 1;
  const tonoFormal = data.tonoFormal === true || data.tonoFormal === 1 ? 1 : 0;
  const usarEmojis = data.usarEmojis === false || data.usarEmojis === 0 ? 0 : 1;
  const delayMaxMs = Math.max(0, Math.min(15000, Number(data.delayMaxMs) || DEFAULTS.delayMaxMs));
  const mensajeDespedida = data.mensajeDespedida != null && String(data.mensajeDespedida).trim() !== ''
    ? String(data.mensajeDespedida).slice(0, 500)
    : null;
  const numeroEscalamiento = sanitizarNumero(data.numeroEscalamiento);
  const escalamientoActivo = data.escalamientoActivo === false || data.escalamientoActivo === 0 ? 0 : 1;
  const escalamientoTimeoutMin = Math.max(1, Math.min(1440, Number(data.escalamientoTimeoutMin) || DEFAULTS.escalamientoTimeoutMin));
  const umbralNoEntiendoEscalar = Math.max(0, Math.min(20, Number(data.umbralNoEntiendoEscalar) || DEFAULTS.umbralNoEntiendoEscalar));

  await req
    .input('humanizar', sql.Bit, humanizar)
    .input('tonoFormal', sql.Bit, tonoFormal)
    .input('usarEmojis', sql.Bit, usarEmojis)
    .input('delayMaxMs', sql.Int, delayMaxMs)
    .input('mensajeDespedida', sql.NVarChar(500), mensajeDespedida)
    .input('numeroEscalamiento', sql.VarChar(20), numeroEscalamiento)
    .input('escalamientoActivo', sql.Bit, escalamientoActivo)
    .input('escalamientoTimeoutMin', sql.Int, escalamientoTimeoutMin)
    .input('umbralNoEntiendoEscalar', sql.Int, umbralNoEntiendoEscalar)
    .query(`
      MERGE WhatsAppBotConfig AS t
      USING (SELECT @idEmpresa AS idEmpresa) AS s ON t.idEmpresa = s.idEmpresa
      WHEN MATCHED THEN UPDATE SET
        activoBot = @activoBot, idListaPrecio = @idListaPrecio,
        mensajeBienvenida = @mensajeBienvenida, mensajeNoRegistrado = @mensajeNoRegistrado,
        humanizar = @humanizar, tonoFormal = @tonoFormal, usarEmojis = @usarEmojis,
        delayMaxMs = @delayMaxMs, mensajeDespedida = @mensajeDespedida,
        numeroEscalamiento = @numeroEscalamiento, escalamientoActivo = @escalamientoActivo,
        escalamientoTimeoutMin = @escalamientoTimeoutMin,
        umbralNoEntiendoEscalar = @umbralNoEntiendoEscalar,
        fActualizacion = GETDATE()
      WHEN NOT MATCHED THEN INSERT (
        idEmpresa, activoBot, idListaPrecio, mensajeBienvenida, mensajeNoRegistrado,
        humanizar, tonoFormal, usarEmojis, delayMaxMs, mensajeDespedida,
        numeroEscalamiento, escalamientoActivo, escalamientoTimeoutMin, umbralNoEntiendoEscalar
      ) VALUES (
        @idEmpresa, @activoBot, @idListaPrecio, @mensajeBienvenida, @mensajeNoRegistrado,
        @humanizar, @tonoFormal, @usarEmojis, @delayMaxMs, @mensajeDespedida,
        @numeroEscalamiento, @escalamientoActivo, @escalamientoTimeoutMin, @umbralNoEntiendoEscalar
      );
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

module.exports = { getByEmpresa, upsert, getOrCreate, invalidarCacheColumnas, DEFAULTS };
