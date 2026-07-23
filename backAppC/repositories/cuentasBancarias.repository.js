const sql = require('mssql');

async function listarPorEmpresa(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        idCuentaBancaria,
        idEmpresa,
        nombreBanco,
        numeroCuenta,
        cci,
        tipoCuenta,
        moneda,
        saldoActual,
        CONVERT(VARCHAR(10), fechaApertura, 23) AS fechaApertura,
        CONVERT(VARCHAR(10), fechaCierre, 23) AS fechaCierre,
        estado,
        idCuentaContable
      FROM dbo.CuentasBancarias
      WHERE idEmpresa = @idEmpresa
      ORDER BY
        CASE WHEN estado = 1 THEN 0 ELSE 1 END,
        CASE WHEN UPPER(LTRIM(RTRIM(moneda))) = 'PEN' THEN 0 ELSE 1 END,
        nombreBanco,
        numeroCuenta
    `);
  return r.recordset || [];
}

async function obtenerPorId(pool, idEmpresa, idCuentaBancaria) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCuentaBancaria', sql.UniqueIdentifier, idCuentaBancaria)
    .query(`
      SELECT TOP 1
        idCuentaBancaria,
        idEmpresa,
        nombreBanco,
        numeroCuenta,
        cci,
        tipoCuenta,
        moneda,
        saldoActual,
        CONVERT(VARCHAR(10), fechaApertura, 23) AS fechaApertura,
        CONVERT(VARCHAR(10), fechaCierre, 23) AS fechaCierre,
        estado,
        idCuentaContable
      FROM dbo.CuentasBancarias
      WHERE idEmpresa = @idEmpresa
        AND idCuentaBancaria = @idCuentaBancaria
    `);
  return r.recordset[0] || null;
}

async function insertar(pool, row) {
  await pool
    .request()
    .input('idCuentaBancaria', sql.UniqueIdentifier, row.idCuentaBancaria)
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('nombreBanco', sql.VarChar(100), row.nombreBanco)
    .input('numeroCuenta', sql.VarChar(30), row.numeroCuenta)
    .input('cci', sql.VarChar(20), row.cci || null)
    .input('tipoCuenta', sql.VarChar(20), row.tipoCuenta)
    .input('moneda', sql.VarChar(3), row.moneda)
    .input('saldoActual', sql.Decimal(18, 6), row.saldoActual ?? 0)
    .input('fechaApertura', sql.Date, row.fechaApertura)
    .input('estado', sql.Bit, row.estado ? 1 : 0)
    .input('idCuentaContable', sql.VarChar(20), row.idCuentaContable || null)
    .query(`
      INSERT INTO dbo.CuentasBancarias (
        idCuentaBancaria, idEmpresa, nombreBanco, numeroCuenta, cci, tipoCuenta, moneda,
        saldoActual, fechaApertura, fechaCierre, estado, idCuentaContable
      ) VALUES (
        @idCuentaBancaria, @idEmpresa, @nombreBanco, @numeroCuenta, @cci, @tipoCuenta, @moneda,
        @saldoActual, @fechaApertura, NULL, @estado, @idCuentaContable
      )
    `);
}

async function actualizar(pool, row) {
  const r = await pool
    .request()
    .input('idCuentaBancaria', sql.UniqueIdentifier, row.idCuentaBancaria)
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('nombreBanco', sql.VarChar(100), row.nombreBanco)
    .input('numeroCuenta', sql.VarChar(30), row.numeroCuenta)
    .input('cci', sql.VarChar(20), row.cci || null)
    .input('tipoCuenta', sql.VarChar(20), row.tipoCuenta)
    .input('moneda', sql.VarChar(3), row.moneda)
    .input('estado', sql.Bit, row.estado ? 1 : 0)
    .input('fechaCierre', sql.Date, row.fechaCierre || null)
    .input('idCuentaContable', sql.VarChar(20), row.idCuentaContable || null)
    .query(`
      UPDATE dbo.CuentasBancarias
      SET nombreBanco = @nombreBanco,
          numeroCuenta = @numeroCuenta,
          cci = @cci,
          tipoCuenta = @tipoCuenta,
          moneda = @moneda,
          estado = @estado,
          fechaCierre = CASE WHEN @estado = 0 THEN ISNULL(@fechaCierre, CAST(GETDATE() AS DATE)) ELSE NULL END,
          idCuentaContable = @idCuentaContable
      WHERE idEmpresa = @idEmpresa
        AND idCuentaBancaria = @idCuentaBancaria
    `);
  return r.rowsAffected?.[0] || 0;
}

async function desactivar(pool, idEmpresa, idCuentaBancaria) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCuentaBancaria', sql.UniqueIdentifier, idCuentaBancaria)
    .query(`
      UPDATE dbo.CuentasBancarias
      SET estado = 0,
          fechaCierre = ISNULL(fechaCierre, CAST(GETDATE() AS DATE))
      WHERE idEmpresa = @idEmpresa
        AND idCuentaBancaria = @idCuentaBancaria
    `);
  return r.rowsAffected?.[0] || 0;
}

/**
 * Líneas de texto para PDF de comprobantes: solo cuentas activas (y sin cierre vigente).
 * @returns {Promise<string>} texto multilínea (una cuenta por línea)
 */
async function listarActivasTextoPdf(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        nombreBanco,
        numeroCuenta,
        cci,
        tipoCuenta,
        moneda
      FROM dbo.CuentasBancarias
      WHERE idEmpresa = @idEmpresa
        AND estado = 1
        AND (fechaCierre IS NULL OR fechaCierre >= CAST(GETDATE() AS DATE))
      ORDER BY
        CASE WHEN UPPER(LTRIM(RTRIM(moneda))) = 'PEN' THEN 0 ELSE 1 END,
        nombreBanco,
        numeroCuenta
    `);
  const filas = r.recordset || [];
  return filas
    .map((f) => {
      const banco = (f.nombreBanco != null ? String(f.nombreBanco).trim() : '') || 'BANCO';
      const tipo = (f.tipoCuenta != null ? String(f.tipoCuenta).trim() : '') || 'CTA';
      const num = f.numeroCuenta != null ? String(f.numeroCuenta).trim() : '';
      const cci = f.cci != null ? String(f.cci).trim() : '';
      const mon = (f.moneda != null ? String(f.moneda).trim() : '') || 'PEN';
      if (!num) return '';
      const cciPart = cci ? ` CCI: ${cci}` : '';
      return `${banco} - ${tipo}: ${num}${cciPart} (${mon})`;
    })
    .filter(Boolean)
    .join('\n');
}

module.exports = {
  listarPorEmpresa,
  obtenerPorId,
  insertar,
  actualizar,
  desactivar,
  listarActivasTextoPdf
};
