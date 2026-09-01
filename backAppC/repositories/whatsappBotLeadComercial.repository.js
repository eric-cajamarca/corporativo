const sql = require('mssql');

function vacio(v) {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
}

function skipEsquema(err) {
  return err && (err.number === 208 || err.number === 207);
}

const SELECT_LEAD = `
  CONVERT(VARCHAR(36), idLead) AS idLead,
  telefonoLog,
  digitosCelular,
  nombre,
  rubro,
  rubroLibre,
  necesidad,
  intencionCompra,
  encaja,
  mejorHorario,
  estado,
  CAST(quiereLlamada AS INT) AS quiereLlamada,
  ultimoMensaje,
  CAST(ISNULL(ofrecioDemo, 0) AS INT) AS ofrecioDemo,
  CONVERT(VARCHAR(19), fOfrecioDemo, 120) AS fOfrecioDemo,
  CONVERT(VARCHAR(36), idEmpresaRegistrada) AS idEmpresaRegistrada,
  CONVERT(VARCHAR(19), fRegistroEmpresa, 120) AS fRegistroEmpresa,
  notaRevision,
  CONVERT(VARCHAR(19), fRevision, 120) AS fRevision,
  CONVERT(VARCHAR(19), fCreacion, 120) AS fCreacion,
  CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion
`;

async function upsert(pool, row) {
  try {
    await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
      .input('telefonoLog', sql.VarChar(40), String(row.telefonoLog || '').slice(0, 40))
      .input('digitosCelular', sql.VarChar(20), vacio(row.digitosCelular))
      .input('nombre', sql.NVarChar(120), vacio(row.nombre))
      .input('rubro', sql.NVarChar(80), vacio(row.rubro))
      .input('rubroLibre', sql.NVarChar(160), vacio(row.rubroLibre))
      .input('necesidad', sql.NVarChar(400), vacio(row.necesidad))
      .input('intencionCompra', sql.VarChar(12), vacio(row.intencionCompra))
      .input('encaja', sql.VarChar(16), vacio(row.encaja))
      .input('mejorHorario', sql.NVarChar(80), vacio(row.mejorHorario))
      .input('estado', sql.VarChar(30), String(row.estado || 'nuevo').slice(0, 30))
      .input('quiereLlamada', sql.Bit, row.quiereLlamada ? 1 : 0)
      .input('ofrecioDemo', sql.Bit, row.ofrecioDemo ? 1 : 0)
      .input('ultimoMensaje', sql.NVarChar(500), vacio(row.ultimoMensaje))
      .query(`
        MERGE WhatsAppBotLeadComercial AS t
        USING (SELECT @idEmpresa AS idEmpresa, @telefonoLog AS telefonoLog) AS s
          ON t.idEmpresa = s.idEmpresa AND t.telefonoLog = s.telefonoLog
        WHEN MATCHED THEN UPDATE SET
          digitosCelular = COALESCE(@digitosCelular, t.digitosCelular),
          nombre = CASE
            WHEN @nombre IS NOT NULL THEN @nombre
            WHEN LOWER(ISNULL(t.nombre, '')) IN ('cliente', 'usuario', 'interesado') THEN NULL
            ELSE t.nombre
          END,
          rubro = COALESCE(@rubro, t.rubro),
          rubroLibre = COALESCE(@rubroLibre, t.rubroLibre),
          necesidad = COALESCE(@necesidad, t.necesidad),
          intencionCompra = COALESCE(@intencionCompra, t.intencionCompra),
          encaja = COALESCE(@encaja, t.encaja),
          mejorHorario = COALESCE(@mejorHorario, t.mejorHorario),
          quiereLlamada = CASE WHEN @quiereLlamada = 1 THEN 1 ELSE t.quiereLlamada END,
          ofrecioDemo = CASE WHEN @ofrecioDemo = 1 THEN 1 ELSE t.ofrecioDemo END,
          fOfrecioDemo = CASE
            WHEN @ofrecioDemo = 1 AND t.fOfrecioDemo IS NULL THEN GETDATE()
            ELSE t.fOfrecioDemo
          END,
          ultimoMensaje = COALESCE(@ultimoMensaje, t.ultimoMensaje),
          estado = CASE
            WHEN t.estado IN ('contactado', 'ganado', 'perdido') THEN t.estado
            ELSE @estado
          END,
          fActualizacion = GETDATE()
        WHEN NOT MATCHED THEN INSERT (
          idEmpresa, telefonoLog, digitosCelular, nombre, rubro, rubroLibre, necesidad,
          intencionCompra, encaja, mejorHorario, estado, quiereLlamada, ofrecioDemo,
          fOfrecioDemo, ultimoMensaje
        ) VALUES (
          @idEmpresa, @telefonoLog, @digitosCelular, @nombre, @rubro, @rubroLibre, @necesidad,
          @intencionCompra, @encaja, @mejorHorario, @estado, @quiereLlamada, @ofrecioDemo,
          CASE WHEN @ofrecioDemo = 1 THEN GETDATE() ELSE NULL END,
          @ultimoMensaje
        );
      `);
  } catch (err) {
    if (skipEsquema(err)) return { skipped: true };
    throw err;
  }
}

const ESTADOS = new Set(['nuevo', 'interesado', 'llamada_pendiente', 'contactado', 'ganado', 'perdido']);

async function listar(pool, idEmpresa, filtros = {}) {
  try {
    const estado = ESTADOS.has(String(filtros.estado || '')) ? String(filtros.estado) : null;
    const r = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('estado', sql.VarChar(30), estado)
      .query(`
        SELECT TOP 200 ${SELECT_LEAD}
        FROM WhatsAppBotLeadComercial
        WHERE idEmpresa = @idEmpresa
          AND (@estado IS NULL OR estado = @estado)
        ORDER BY fActualizacion DESC
      `);
    return r.recordset || [];
  } catch (err) {
    if (skipEsquema(err)) return [];
    throw err;
  }
}

async function obtenerPorId(pool, idEmpresa, idLead) {
  try {
    const r = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idLead', sql.UniqueIdentifier, idLead)
      .query(`
        SELECT TOP 1 ${SELECT_LEAD}
        FROM WhatsAppBotLeadComercial
        WHERE idLead = @idLead AND idEmpresa = @idEmpresa
      `);
    return (r.recordset || [])[0] || null;
  } catch (err) {
    if (skipEsquema(err)) return null;
    throw err;
  }
}

async function actualizarEstado(pool, idEmpresa, idLead, estado) {
  try {
    await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idLead', sql.UniqueIdentifier, idLead)
      .input('estado', sql.VarChar(30), estado)
      .query(`
        UPDATE WhatsAppBotLeadComercial
        SET estado = @estado, fActualizacion = GETDATE()
        WHERE idLead = @idLead AND idEmpresa = @idEmpresa
      `);
    return obtenerPorId(pool, idEmpresa, idLead);
  } catch (err) {
    if (skipEsquema(err)) return null;
    throw err;
  }
}

async function metricas(pool, idEmpresa, desde, hasta) {
  try {
    const r = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('desde', sql.VarChar(10), desde)
      .input('hasta', sql.VarChar(10), hasta)
      .query(`
        SELECT
          COUNT(*) AS leads,
          SUM(CASE WHEN ofrecioDemo = 1 THEN 1 ELSE 0 END) AS ofrecioDemo,
          SUM(CASE WHEN idEmpresaRegistrada IS NOT NULL THEN 1 ELSE 0 END) AS empresas
        FROM WhatsAppBotLeadComercial
        WHERE idEmpresa = @idEmpresa
          AND fCreacion >= CAST(@desde AS DATE)
          AND fCreacion < DATEADD(day, 1, CAST(@hasta AS DATE))
      `);
    const row = (r.recordset || [])[0] || {};
    return {
      leads: Number(row.leads || 0),
      ofrecioDemo: Number(row.ofrecioDemo || 0),
      empresas: Number(row.empresas || 0)
    };
  } catch (err) {
    if (skipEsquema(err)) return { leads: 0, ofrecioDemo: 0, empresas: 0 };
    throw err;
  }
}

async function listarRevision(pool, idEmpresa) {
  try {
    const r = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT TOP 20 ${SELECT_LEAD}
        FROM WhatsAppBotLeadComercial
        WHERE idEmpresa = @idEmpresa
          AND ofrecioDemo = 1
          AND idEmpresaRegistrada IS NULL
          AND fRevision IS NULL
          AND (
            estado IN ('interesado', 'perdido')
            OR ISNULL(fOfrecioDemo, fCreacion) < DATEADD(hour, -48, GETDATE())
          )
        ORDER BY ISNULL(fOfrecioDemo, fCreacion) ASC
      `);
    return r.recordset || [];
  } catch (err) {
    if (skipEsquema(err)) return [];
    throw err;
  }
}

async function guardarRevision(pool, idEmpresa, idLead, notaRevision, estado) {
  try {
    await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idLead', sql.UniqueIdentifier, idLead)
      .input('notaRevision', sql.NVarChar(500), vacio(notaRevision))
      .input('estado', sql.VarChar(30), estado || null)
      .query(`
        UPDATE WhatsAppBotLeadComercial
        SET
          notaRevision = COALESCE(@notaRevision, notaRevision),
          fRevision = GETDATE(),
          estado = CASE WHEN @estado IS NOT NULL THEN @estado ELSE estado END,
          fActualizacion = GETDATE()
        WHERE idLead = @idLead AND idEmpresa = @idEmpresa
      `);
    return obtenerPorId(pool, idEmpresa, idLead);
  } catch (err) {
    if (skipEsquema(err)) return null;
    throw err;
  }
}

async function marcarGanadoPorCelular(pool, idEmpresaPrincipal, nueve, idEmpresaRegistrada) {
  try {
    await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresaPrincipal)
      .input('nueve', sql.VarChar(9), nueve)
      .input('idEmpresaRegistrada', sql.UniqueIdentifier, idEmpresaRegistrada)
      .query(`
        UPDATE WhatsAppBotLeadComercial
        SET
          idEmpresaRegistrada = @idEmpresaRegistrada,
          fRegistroEmpresa = GETDATE(),
          estado = 'ganado',
          fActualizacion = GETDATE()
        WHERE idEmpresa = @idEmpresa
          AND ofrecioDemo = 1
          AND idEmpresaRegistrada IS NULL
          AND estado <> 'perdido'
          AND (
            RIGHT(REPLACE(REPLACE(ISNULL(digitosCelular, ''), ' ', ''), '+', ''), 9) = @nueve
            OR (
              telefonoLog NOT LIKE 'web:%'
              AND RIGHT(REPLACE(REPLACE(ISNULL(telefonoLog, ''), ' ', ''), '+', ''), 9) = @nueve
            )
          )
      `);
  } catch (err) {
    if (skipEsquema(err)) return;
    throw err;
  }
}

module.exports = {
  upsert,
  listar,
  obtenerPorId,
  actualizarEstado,
  metricas,
  listarRevision,
  guardarRevision,
  marcarGanadoPorCelular,
  ESTADOS
};
