const sql = require('mssql');

const CODIGOS_RUBRO_ACTIVOS = new Set(['GEN', 'GRF', 'HOTEL', 'PINT']);
const CODIGOS_COMERCIO = new Set(['GEN', 'FERR', 'RETAIL', null, '']);
const CODIGOS_PINTURA = new Set(['PINT', 'PINTURA', 'PINTURAS']);

/** Rubro Grifo en BD: código `GRF`. Si hay código de sistema, el texto SUNAT no lo sobrescribe. */
function esRubroGrifo(codigoRubro, rubroTexto) {
  const codigo = String(codigoRubro || '').trim().toUpperCase();
  if (codigo === 'GRF' || codigo === 'GRIFO') return true;
  if (codigo) return false;
  const rubro = String(rubroTexto || '').trim().toLowerCase();
  return rubro === 'grifo' || rubro.includes('grifo');
}

function esRubroHotel(codigoRubro, rubroTexto) {
  const codigo = String(codigoRubro || '').trim().toUpperCase();
  if (codigo === 'HOTEL' || codigo === 'HTL') return true;
  if (codigo) return false;
  const rubro = String(rubroTexto || '').trim().toLowerCase();
  return rubro === 'hotel' || rubro.includes('hotel');
}

function esRubroPintura(codigoRubro, rubroTexto) {
  const codigo = String(codigoRubro || '').trim().toUpperCase();
  if (CODIGOS_PINTURA.has(codigo)) return true;
  if (codigo) return false;
  const rubro = String(rubroTexto || '').trim().toLowerCase();
  return /\bpintur/.test(rubro);
}

function esRubroComercio(codigoRubro) {
  const codigo = String(codigoRubro || '').trim().toUpperCase();
  return !codigo || codigo === 'GEN' || codigo === 'FERR' || codigo === 'RETAIL';
}

function normalizarCodigoRubroVentas(codigoRubro) {
  const codigo = String(codigoRubro || '').trim().toUpperCase();
      if (!codigo || codigo === 'GEN' || codigo === 'FERR' || codigo === 'RETAIL' || codigo === 'PINT') return 'GEN';
  if (codigo === 'GRF' || codigo === 'GRIFO') return 'GRF';
  if (codigo === 'HOTEL') return 'HOTEL';
  return 'GEN';
}

async function obtenerRubroEmpresa(pool, idEmpresa) {
  if (!idEmpresa) return { codigoRubro: null, rubro: null };
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT LTRIM(RTRIM(ISNULL(r.codigo, ''))) AS codigoRubro,
             LTRIM(RTRIM(ISNULL(e.rubro, ''))) AS rubro
      FROM Empresas e
      LEFT JOIN Rubros r ON e.idRubro = r.idRubro
      WHERE e.idEmpresa = @idEmpresa
    `);
  const row = result.recordset?.[0];
  return {
    codigoRubro: row?.codigoRubro || null,
    rubro: row?.rubro || null
  };
}

module.exports = {
  CODIGOS_RUBRO_ACTIVOS,
  CODIGOS_COMERCIO,
  esRubroGrifo,
  esRubroHotel,
  esRubroPintura,
  esRubroComercio,
  normalizarCodigoRubroVentas,
  obtenerRubroEmpresa
};
