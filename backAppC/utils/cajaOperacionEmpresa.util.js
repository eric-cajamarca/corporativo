/**
 * Resuelve la empresa sobre la que opera caja (recibos, cobranza, etc.)
 */
const sql = require("mssql");
const gestoresRepository = require("../repositories/gestores.repository");

const CLAVE_CONFIG_DEFAULT = "CAJA_ID_EMPRESA_OPERACION_DEFAULT";
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function normalizeUuid(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return UUID_REGEX.test(s) ? s : null;
}

async function obtenerEmpresasPermitidasOperacionCaja(pool, idEmpresaJwt) {
  const out = [];
  if (!idEmpresaJwt) return out;
  const jwt = String(idEmpresaJwt);
  const nm = await pool
    .request()
    .input("id", sql.UniqueIdentifier, jwt)
    .query("SELECT idEmpresa, razon_Social, ruc FROM Empresas WHERE idEmpresa = @id");
  const row = nm.recordset?.[0];
  out.push({ idEmpresa: jwt, razonSocial: row?.razon_Social || "", ruc: row?.ruc || "" });
  const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, jwt);
  if (!esGestora) return out;
  const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, jwt);
  for (const g of gestionadas || []) {
    if (g.idEmpresa) {
      out.push({
        idEmpresa: String(g.idEmpresa),
        razonSocial: g.razon_Social || g.razonSocial || "",
        ruc: g.ruc || ""
      });
    }
  }
  return out;
}

function setPermitidasLower(lista) {
  const s = new Set();
  for (const x of lista) {
    if (x && x.idEmpresa) s.add(String(x.idEmpresa).toLowerCase());
  }
  return s;
}

async function resolverIdEmpresaOperacionCaja(pool, user, idEmpresaSolicitada) {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const jwt = String(user.empresa);
  const lista = await obtenerEmpresasPermitidasOperacionCaja(pool, jwt);
  const permitidas = setPermitidasLower(lista);
  const sol = normalizeUuid(idEmpresaSolicitada);
  if (sol) {
    if (!permitidas.has(sol.toLowerCase())) throw new Error("EMPRESA_OPERACION_NO_PERMITIDA");
    return sol;
  }
  if (lista.length <= 1) return jwt;
  const rows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, jwt);
  const raw = (rows || []).find((r) => r.clave === CLAVE_CONFIG_DEFAULT)?.valor;
  const defUuid = normalizeUuid(raw);
  if (defUuid && permitidas.has(defUuid.toLowerCase())) return defUuid;
  return jwt;
}

module.exports = {
  CLAVE_CONFIG_DEFAULT,
  normalizeUuid,
  obtenerEmpresasPermitidasOperacionCaja,
  resolverIdEmpresaOperacionCaja
};
