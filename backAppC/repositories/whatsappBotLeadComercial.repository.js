const sql = require('mssql');

function vacio(v) {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
}

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
          ultimoMensaje = COALESCE(@ultimoMensaje, t.ultimoMensaje),
          estado = CASE
            WHEN t.estado IN ('contactado', 'ganado', 'perdido') THEN t.estado
            ELSE @estado
          END,
          fActualizacion = GETDATE()
        WHEN NOT MATCHED THEN INSERT (
          idEmpresa, telefonoLog, digitosCelular, nombre, rubro, rubroLibre, necesidad,
          intencionCompra, encaja, mejorHorario, estado, quiereLlamada, ultimoMensaje
        ) VALUES (
          @idEmpresa, @telefonoLog, @digitosCelular, @nombre, @rubro, @rubroLibre, @necesidad,
          @intencionCompra, @encaja, @mejorHorario, @estado, @quiereLlamada, @ultimoMensaje
        );
      `);
  } catch (err) {
    if (err && err.number === 208) return { skipped: true };
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
        SELECT TOP 200
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
          CONVERT(VARCHAR(19), fCreacion, 120) AS fCreacion,
          CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion
        FROM WhatsAppBotLeadComercial
        WHERE idEmpresa = @idEmpresa
          AND (@estado IS NULL OR estado = @estado)
        ORDER BY fActualizacion DESC
      `);
    return r.recordset || [];
  } catch (err) {
    if (err && err.number === 208) return [];
    throw err;
  }
}

async function actualizarEstado(pool, idEmpresa, idLead, estado) {
  try {
    const r = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idLead', sql.UniqueIdentifier, idLead)
      .input('estado', sql.VarChar(30), estado)
      .query(`
      UPDATE WhatsAppBotLeadComercial
      SET estado = @estado, fActualizacion = GETDATE()
      WHERE idLead = @idLead AND idEmpresa = @idEmpresa;
      SELECT TOP 1
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
        CONVERT(VARCHAR(19), fCreacion, 120) AS fCreacion,
        CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion
      FROM WhatsAppBotLeadComercial
      WHERE idLead = @idLead AND idEmpresa = @idEmpresa;
    `);
    const rows = r.recordset || [];
    return rows[0] || null;
  } catch (err) {
    if (err && err.number === 208) return null;
    throw err;
  }
}

module.exports = { upsert, listar, actualizarEstado, ESTADOS };
