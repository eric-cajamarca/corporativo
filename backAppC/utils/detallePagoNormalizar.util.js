/**
 * El front (pendientes de pago, etc.) envía a veces idFormaPago (FormasPago) en idMediosPago;
 * DetallePagoVenta y la lógica de créditos usan MediosPago. Mapea sin perder "crédito corriente".
 */

function normDesc(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/í/g, "i")
    .replace(/é/g, "e")
    .replace(/á/g, "a")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u");
}

function esDescripcionCreditoCorriente(desc) {
  const d = normDesc(desc);
  if (!d) return false;
  if (d.includes("tarjeta")) return false;
  return d.includes("credito") || d.includes("crédito");
}

/**
 * @param {import('mssql').Transaction|import('mssql').ConnectionPool} conn
 * @param {Array<{ idMediosPago?: number, monto: number }>} detallePago
 * @returns {Promise<Array<{ idMediosPago: number, monto: number }>>}
 */
async function normalizarDetallePagoIdMediosPago(conn, detallePago) {
  const req = conn.request();
  const rMp = await req.query(
    "SELECT idMediosPago, descripcion, codigo FROM MediosPago"
  );
  const mpList = rMp.recordset || [];
  const mpById = new Map(
    mpList.map((r) => [Number(r.idMediosPago), r]).filter(([id]) => Number.isFinite(id))
  );
  let rFp;
  try {
    rFp = await conn.request().query(
      "SELECT idFormaPago, descripcion FROM FormasPago WHERE ISNULL(activo, 1) = 1"
    );
  } catch (_) {
    try {
      rFp = await conn.request().query("SELECT idFormaPago, descripcion FROM FormasPago");
    } catch (__) {
      rFp = { recordset: [] };
    }
  }
  const fpById = new Map(
    (rFp.recordset || [])
      .map((r) => [Number(r.idFormaPago), r])
      .filter(([id]) => Number.isFinite(id))
  );

  const defaultId =
    mpList.length > 0
      ? Math.min(
          ...mpList.map((r) => Number(r.idMediosPago)).filter((n) => Number.isFinite(n))
        )
      : null;
  if (defaultId == null) return [];

  const findMpForForma = (fp) => {
    const nd = normDesc(fp.descripcion);
    for (const mp of mpList) {
      if (normDesc(mp.descripcion) === nd) return Number(mp.idMediosPago);
    }
    if (esDescripcionCreditoCorriente(fp.descripcion)) {
      for (const mp of mpList) {
        const c = String(mp.codigo || "").trim();
        if (c === "010" || c === "10") return Number(mp.idMediosPago);
        if (esDescripcionCreditoCorriente(mp.descripcion)) return Number(mp.idMediosPago);
      }
    }
    return null;
  };

  const out = [];
  for (const p of detallePago || []) {
    const monto = round2(Number(p.monto) || 0);
    if (monto <= 0) continue;
    const raw = p.idMediosPago != null ? Number(p.idMediosPago) : NaN;
    let idMediosPago = Number.isFinite(raw) ? raw : null;

    if (idMediosPago != null && mpById.has(idMediosPago)) {
      out.push({ idMediosPago, monto });
      continue;
    }
    const fp = idMediosPago != null ? fpById.get(idMediosPago) : null;
    if (fp) {
      const mapped = findMpForForma(fp);
      if (mapped != null) {
        out.push({ idMediosPago: mapped, monto });
        continue;
      }
    }
    out.push({ idMediosPago: defaultId, monto });
  }
  return out;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

module.exports = {
  normalizarDetallePagoIdMediosPago,
  normDesc,
  esDescripcionCreditoCorriente,
};
