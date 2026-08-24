const sql = require('mssql');

let schemaReady = false;

async function ensureSchema(pool) {
  if (schemaReady) return;
  try {
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Gastos')
      BEGIN
        IF COL_LENGTH('Gastos', 'esRecurrente') IS NULL
          ALTER TABLE Gastos ADD esRecurrente BIT NOT NULL CONSTRAINT DF_Gastos_esRecurrente DEFAULT 0;
        IF COL_LENGTH('Gastos', 'activo') IS NULL
          ALTER TABLE Gastos ADD activo BIT NOT NULL CONSTRAINT DF_Gastos_activo DEFAULT 1;
        IF COL_LENGTH('Gastos', 'fechaFin') IS NULL
          ALTER TABLE Gastos ADD fechaFin DATE NULL;
      END
    `);
    schemaReady = true;
  } catch (err) {
    if (err.number === 208 || /Invalid object name|Gastos/.test(String(err.message))) {
      schemaReady = false;
      return;
    }
    // Columnas ya existen u otra carrera: continuar
    schemaReady = true;
  }
}

function esTablaAusente(err) {
  return err && (err.number === 208 || /Invalid object name|Gastos/.test(String(err.message)));
}

function mesesEnRango(fechaInicio, fechaFin) {
  const meses = [];
  if (!fechaInicio || !fechaFin) return meses;
  let [y, m] = String(fechaInicio).slice(0, 10).split('-').map(Number);
  const [yF, mF] = String(fechaFin).slice(0, 10).split('-').map(Number);
  if (!y || !m || !yF || !mF) return meses;
  while (y < yF || (y === yF && m <= mF)) {
    meses.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return meses;
}

function rangoDeMes(periodo) {
  const [y, m] = periodo.split('-').map(Number);
  const inicio = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0).getDate();
  const fin = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { fechaInicio: inicio, fechaFin: fin };
}

function aYmd(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, '0');
    const d = String(valor.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(valor).slice(0, 10);
}

function ymdEnMs(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return Date.UTC(y, m - 1, d);
}

function diasInclusive(desde, hasta) {
  const a = ymdEnMs(desde);
  const b = ymdEnMs(hasta);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

/**
 * Parte del mes que cubre el rango consultado: 1 si el mes está completo,
 * 1/31 si se pide un solo día. Evita cargar el gasto mensual entero a un día.
 */
function proporcionMesEnRango(mesInicio, mesFin, rangoInicio, rangoFin) {
  const diasMes = diasInclusive(mesInicio, mesFin);
  if (!diasMes) return 0;
  const desde = rangoInicio && rangoInicio > mesInicio ? rangoInicio : mesInicio;
  const hasta = rangoFin && rangoFin < mesFin ? rangoFin : mesFin;
  const dias = diasInclusive(desde, hasta);
  if (!dias) return 0;
  return dias >= diasMes ? 1 : dias / diasMes;
}

function redondear2(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

function mapGastoRow(row) {
  return {
    idGasto: row.idGasto,
    fecha: row.fecha,
    fechaFin: row.fechaFin || null,
    tipo: row.tipo,
    monto: Number(row.monto || 0),
    descripcion: row.descripcion || null,
    esRecurrente: !!row.esRecurrente,
    activo: row.activo === undefined || row.activo === null ? true : !!row.activo,
    fRegistro: row.fRegistro || null
  };
}

exports.listarPorEmpresaYPeriodo = async (pool, idEmpresa, fechaInicio, fechaFin) => {
  await ensureSchema(pool);
  try {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query(`
        SELECT
          idGasto,
          CONVERT(VARCHAR(10), fecha, 120) AS fecha,
          CONVERT(VARCHAR(10), fechaFin, 120) AS fechaFin,
          tipo,
          monto,
          descripcion,
          ISNULL(esRecurrente, 0) AS esRecurrente,
          ISNULL(activo, 1) AS activo,
          CONVERT(VARCHAR(19), fRegistro, 120) AS fRegistro
        FROM Gastos
        WHERE idEmpresa = @idEmpresa
          AND ISNULL(esRecurrente, 0) = 0
          AND fecha >= @fechaInicio AND fecha <= @fechaFin
        ORDER BY fecha DESC
      `);
    return (result.recordset || []).map(mapGastoRow);
  } catch (err) {
    if (esTablaAusente(err)) return [];
    throw err;
  }
};

exports.listarRecurrentes = async (pool, idEmpresa) => {
  await ensureSchema(pool);
  try {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT
          idGasto,
          CONVERT(VARCHAR(10), fecha, 120) AS fecha,
          CONVERT(VARCHAR(10), fechaFin, 120) AS fechaFin,
          tipo,
          monto,
          descripcion,
          ISNULL(esRecurrente, 0) AS esRecurrente,
          ISNULL(activo, 1) AS activo,
          CONVERT(VARCHAR(19), fRegistro, 120) AS fRegistro
        FROM Gastos
        WHERE idEmpresa = @idEmpresa
          AND ISNULL(esRecurrente, 0) = 1
        ORDER BY ISNULL(activo, 1) DESC, fecha DESC, descripcion
      `);
    return (result.recordset || []).map(mapGastoRow);
  } catch (err) {
    if (esTablaAusente(err)) return [];
    throw err;
  }
};

async function listarRecurrentesActivos(pool, idEmpresa) {
  await ensureSchema(pool);
  try {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT
          idGasto,
          CONVERT(VARCHAR(10), fecha, 120) AS fecha,
          CONVERT(VARCHAR(10), fechaFin, 120) AS fechaFin,
          tipo,
          monto,
          descripcion,
          ISNULL(esRecurrente, 0) AS esRecurrente,
          ISNULL(activo, 1) AS activo
        FROM Gastos
        WHERE idEmpresa = @idEmpresa
          AND ISNULL(esRecurrente, 0) = 1
          AND ISNULL(activo, 1) = 1
      `);
    return (result.recordset || []).map(mapGastoRow);
  } catch (err) {
    if (esTablaAusente(err)) return [];
    throw err;
  }
}

function recurrenteAplicaEnMes(gasto, mesInicio, mesFin) {
  const inicio = String(gasto.fecha || '').slice(0, 10);
  const fin = gasto.fechaFin ? String(gasto.fechaFin).slice(0, 10) : null;
  if (!inicio) return false;
  if (inicio > mesFin) return false;
  if (fin && fin < mesInicio) return false;
  return true;
}

exports.obtenerTotalGastosPeriodo = async (pool, idEmpresa, fechaInicio, fechaFin) => {
  await ensureSchema(pool);
  let totalOneShot = 0;
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query(`
        SELECT ISNULL(SUM(monto), 0) AS total
        FROM Gastos
        WHERE idEmpresa = @idEmpresa
          AND ISNULL(esRecurrente, 0) = 0
          AND fecha >= @fechaInicio AND fecha <= @fechaFin
      `);
    totalOneShot = Number((r.recordset[0] || {}).total || 0);
  } catch (err) {
    if (!esTablaAusente(err)) throw err;
  }

  const recurrentes = await listarRecurrentesActivos(pool, idEmpresa);
  const desde = aYmd(fechaInicio);
  const hasta = aYmd(fechaFin);
  let totalRecurrente = 0;
  for (const mes of mesesEnRango(fechaInicio, fechaFin)) {
    const { fechaInicio: mi, fechaFin: mf } = rangoDeMes(mes);
    const proporcion = proporcionMesEnRango(mi, mf, desde, hasta);
    if (!proporcion) continue;
    for (const g of recurrentes) {
      if (recurrenteAplicaEnMes(g, mi, mf)) {
        totalRecurrente += Number(g.monto || 0) * proporcion;
      }
    }
  }
  return redondear2(totalOneShot + totalRecurrente);
};

exports.obtenerGastosAgrupadosPorMes = async (pool, idEmpresa, fechaInicio, fechaFin) => {
  const gastosPorPeriodo = {};
  await ensureSchema(pool);

  try {
    const rg = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query(`
        SELECT
          CONCAT(YEAR(fecha), '-', RIGHT('0' + CAST(MONTH(fecha) AS VARCHAR(2)), 2)) AS periodo,
          ISNULL(SUM(monto), 0) AS gastos
        FROM Gastos
        WHERE idEmpresa = @idEmpresa
          AND ISNULL(esRecurrente, 0) = 0
          AND fecha >= @fechaInicio AND fecha <= @fechaFin
        GROUP BY YEAR(fecha), MONTH(fecha)
      `);
    (rg.recordset || []).forEach((row) => {
      gastosPorPeriodo[row.periodo] = Number(row.gastos || 0);
    });
  } catch (err) {
    if (!esTablaAusente(err)) throw err;
  }

  const recurrentes = await listarRecurrentesActivos(pool, idEmpresa);
  const desde = aYmd(fechaInicio);
  const hasta = aYmd(fechaFin);
  for (const mes of mesesEnRango(fechaInicio, fechaFin)) {
    const { fechaInicio: mi, fechaFin: mf } = rangoDeMes(mes);
    const proporcion = proporcionMesEnRango(mi, mf, desde, hasta);
    let extra = 0;
    for (const g of recurrentes) {
      if (recurrenteAplicaEnMes(g, mi, mf)) extra += Number(g.monto || 0) * proporcion;
    }
    if (extra > 0) {
      gastosPorPeriodo[mes] = redondear2(Number(gastosPorPeriodo[mes] || 0) + extra);
    } else if (gastosPorPeriodo[mes] == null) {
      // mantener meses solo con one-shot; no forzar ceros
    }
  }
  return gastosPorPeriodo;
};

exports.crear = async (pool, idEmpresa, datos, idUsuario) => {
  await ensureSchema(pool);
  const esRecurrente = !!datos.esRecurrente;
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fecha', sql.Date, datos.fecha)
    .input('fechaFin', sql.Date, datos.fechaFin || null)
    .input('tipo', sql.VarChar(30), datos.tipo || 'ADMINISTRACION')
    .input('monto', sql.Decimal(18, 2), datos.monto)
    .input('descripcion', sql.VarChar(500), datos.descripcion || null)
    .input('esRecurrente', sql.Bit, esRecurrente ? 1 : 0)
    .input('activo', sql.Bit, datos.activo === false ? 0 : 1)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario || null)
    .query(`
      INSERT INTO Gastos (idEmpresa, fecha, fechaFin, tipo, monto, descripcion, esRecurrente, activo, idUsuario)
      OUTPUT
        INSERTED.idGasto,
        CONVERT(VARCHAR(10), INSERTED.fecha, 120) AS fecha,
        CONVERT(VARCHAR(10), INSERTED.fechaFin, 120) AS fechaFin,
        INSERTED.tipo,
        INSERTED.monto,
        INSERTED.descripcion,
        ISNULL(INSERTED.esRecurrente, 0) AS esRecurrente,
        ISNULL(INSERTED.activo, 1) AS activo
      VALUES (@idEmpresa, @fecha, @fechaFin, @tipo, @monto, @descripcion, @esRecurrente, @activo, @idUsuario)
    `);
  return mapGastoRow(result.recordset[0]);
};

exports.actualizar = async (pool, idGasto, idEmpresa, datos) => {
  await ensureSchema(pool);
  const result = await pool.request()
    .input('idGasto', sql.UniqueIdentifier, idGasto)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fecha', sql.Date, datos.fecha)
    .input('fechaFin', sql.Date, datos.fechaFin || null)
    .input('tipo', sql.VarChar(30), datos.tipo || 'ADMINISTRACION')
    .input('monto', sql.Decimal(18, 2), datos.monto)
    .input('descripcion', sql.VarChar(500), datos.descripcion || null)
    .input('activo', sql.Bit, datos.activo === false ? 0 : 1)
    .query(`
      UPDATE Gastos
      SET
        fecha = @fecha,
        fechaFin = @fechaFin,
        tipo = @tipo,
        monto = @monto,
        descripcion = @descripcion,
        activo = @activo
      OUTPUT
        INSERTED.idGasto,
        CONVERT(VARCHAR(10), INSERTED.fecha, 120) AS fecha,
        CONVERT(VARCHAR(10), INSERTED.fechaFin, 120) AS fechaFin,
        INSERTED.tipo,
        INSERTED.monto,
        INSERTED.descripcion,
        ISNULL(INSERTED.esRecurrente, 0) AS esRecurrente,
        ISNULL(INSERTED.activo, 1) AS activo
      WHERE idGasto = @idGasto AND idEmpresa = @idEmpresa
    `);
  if (!result.recordset || !result.recordset[0]) {
    throw new Error('Gasto no encontrado.');
  }
  return mapGastoRow(result.recordset[0]);
};

exports.eliminar = async (pool, idGasto, idEmpresa) => {
  try {
    await ensureSchema(pool);
    await pool.request()
      .input('idGasto', sql.UniqueIdentifier, idGasto)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query('DELETE FROM Gastos WHERE idGasto = @idGasto AND idEmpresa = @idEmpresa');
  } catch (err) {
    if (esTablaAusente(err)) return;
    throw err;
  }
};
