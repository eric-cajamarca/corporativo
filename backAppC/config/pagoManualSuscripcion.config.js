/**
 * Datos para pago manual de suscripción SaaS (Yape / Plin / depósito).
 * Cuenta bancaria: tabla CuentasBancarias de la empresa principal (Empresas.esPrincipal = 1).
 * Respaldo: variables PAGO_MANUAL_* en .env.
 */
const sql = require('mssql');
const suscripcionRepository = require('../repositories/suscripcion.repository');

function digitosWhatsApp(raw) {
  const d = String(raw || '')
    .replace(/\D/g, '')
    .trim();
  if (!d) return '51993289440';
  if (d.length === 9 && d.startsWith('9')) return `51${d}`;
  if (d.startsWith('51') && d.length >= 11) return d;
  return d;
}

function trimOrNull(v) {
  const s = v == null ? '' : String(v).trim();
  return s || null;
}

function configDesdeEnv() {
  const whatsappDisplay = (process.env.PAGO_MANUAL_WHATSAPP || '993289440').toString().trim() || '993289440';
  const yapePlin = (process.env.PAGO_MANUAL_YAPE_PLIN || whatsappDisplay).toString().trim() || whatsappDisplay;
  return {
    whatsappDisplay,
    whatsappE164: digitosWhatsApp(whatsappDisplay),
    yapePlin,
    bcp: {
      titular: trimOrNull(process.env.PAGO_MANUAL_BCP_TITULAR),
      banco: trimOrNull(process.env.PAGO_MANUAL_BCP_BANCO) || 'BCP',
      cuenta: trimOrNull(process.env.PAGO_MANUAL_BCP_CUENTA),
      cci: trimOrNull(process.env.PAGO_MANUAL_BCP_CCI),
      tipoCuenta: null,
      moneda: 'PEN'
    },
    cuentas: [],
    medios: ['yape', 'plin', 'bcp'],
    instruccionVoucher:
      'Envíe el voucher (captura o PDF) al WhatsApp indicado. Allí se validará el pago y el administrador de la plataforma habilitará el plan elegido.'
  };
}

/**
 * Cuenta activa preferida: PEN, luego nombre con BCP, luego más reciente por fechaApertura.
 * @param {import('mssql').ConnectionPool} pool
 * @param {string} idEmpresaPrincipal
 */
async function obtenerCuentasPrincipal(pool, idEmpresaPrincipal) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresaPrincipal)
    .query(`
      SELECT
        idCuentaBancaria,
        nombreBanco,
        numeroCuenta,
        tipoCuenta,
        moneda,
        CONVERT(VARCHAR(10), fechaApertura, 23) AS fechaApertura
      FROM dbo.CuentasBancarias
      WHERE idEmpresa = @idEmpresa
        AND estado = 1
        AND (fechaCierre IS NULL OR fechaCierre >= CAST(GETDATE() AS DATE))
      ORDER BY
        CASE WHEN UPPER(LTRIM(RTRIM(moneda))) = 'PEN' THEN 0 ELSE 1 END,
        CASE WHEN UPPER(nombreBanco) LIKE '%BCP%' THEN 0 ELSE 1 END,
        fechaApertura DESC
    `);
  return r.recordset || [];
}

/**
 * @param {import('mssql').ConnectionPool} [pool]
 */
async function getPagoManualSuscripcionConfig(pool) {
  const base = configDesdeEnv();
  if (!pool) return base;

  try {
    const idPrincipal = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
    if (!idPrincipal) return base;

    const emp = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idPrincipal)
      .query(`
        SELECT TOP 1
          razon_Social,
          nombreComercial,
          celular
        FROM dbo.Empresas
        WHERE idEmpresa = @idEmpresa
      `);
    const empresa = emp.recordset && emp.recordset[0];
    const titular =
      trimOrNull(empresa?.razon_Social) ||
      trimOrNull(empresa?.nombreComercial) ||
      base.bcp.titular;
    const yapePlin = trimOrNull(empresa?.celular) || base.yapePlin;

    const filas = await obtenerCuentasPrincipal(pool, idPrincipal);
    const cuentas = filas.map((f) => ({
      idCuentaBancaria: f.idCuentaBancaria,
      banco: trimOrNull(f.nombreBanco),
      cuenta: trimOrNull(f.numeroCuenta),
      tipoCuenta: trimOrNull(f.tipoCuenta),
      moneda: trimOrNull(f.moneda) || 'PEN',
      titular
    }));

    const preferida = cuentas[0] || null;

    return {
      ...base,
      yapePlin,
      bcp: preferida
        ? {
            titular,
            banco: preferida.banco || base.bcp.banco || 'BCP',
            cuenta: preferida.cuenta,
            cci: base.bcp.cci,
            tipoCuenta: preferida.tipoCuenta,
            moneda: preferida.moneda
          }
        : base.bcp,
      cuentas
    };
  } catch (error) {
    console.error('getPagoManualSuscripcionConfig: CuentasBancarias/principal:', error?.message || error);
    return base;
  }
}

module.exports = {
  getPagoManualSuscripcionConfig
};
