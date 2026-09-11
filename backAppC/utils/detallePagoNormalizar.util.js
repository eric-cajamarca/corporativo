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

function esDescripcionSaldoFavor(desc) {
  const d = normDesc(desc);
  return d.includes("saldo a favor") || d === "saf";
}

function esMedioSaldoFavor(mp) {
  if (!mp) return false;
  const c = String(mp.codigo || "").trim().toUpperCase();
  return c === "SAF" || esDescripcionSaldoFavor(mp.descripcion);
}

function idMedioSaldoFavor(mpList) {
  for (const mp of mpList) {
    if (esMedioSaldoFavor(mp)) return Number(mp.idMediosPago);
  }
  return null;
}

/** Busca MediosPago por texto (exacto, luego uno contenido en el otro: YAPE vs YAPE/PLIN). */
function findMpByDescripcion(mpList, descripcion) {
  const nd = normDesc(descripcion);
  if (!nd) return null;
  for (const mp of mpList) {
    if (normDesc(mp.descripcion) === nd) return Number(mp.idMediosPago);
  }
  for (const mp of mpList) {
    const md = normDesc(mp.descripcion);
    if (!md) continue;
    if (md.includes(nd) || nd.includes(md)) return Number(mp.idMediosPago);
  }
  return null;
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
    rFp = await conn.request().query("SELECT idFormaPago, descripcion FROM FormasPago");
  } catch (_) {
    rFp = { recordset: [] };
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
    const mapped = findMpByDescripcion(mpList, fp.descripcion);
    if (mapped != null) return mapped;
    if (esDescripcionSaldoFavor(fp.descripcion)) {
      const safId = idMedioSaldoFavor(mpList);
      if (safId != null) return safId;
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

  const resolverId = (p) => {
    const rawMp = p.idMediosPago != null && p.idMediosPago !== "" ? Number(p.idMediosPago) : NaN;
    const rawFp = p.idFormaPago != null && p.idFormaPago !== "" ? Number(p.idFormaPago) : NaN;
    const descSaf = esDescripcionSaldoFavor(p.descripcion);
    const mp = Number.isFinite(rawMp) && mpById.has(rawMp) ? mpById.get(rawMp) : null;
    const fpExpl = Number.isFinite(rawFp) && fpById.has(rawFp) ? fpById.get(rawFp) : null;
    const fpEnSlotMp = Number.isFinite(rawMp) && fpById.has(rawMp) ? fpById.get(rawMp) : null;

    // Botón «Usar saldo a favor»: no confundir con FormasPago que comparten el mismo ID.
    if (descSaf) {
      const safId = idMedioSaldoFavor(mpList);
      if (safId != null) return safId;
      if (mp && esMedioSaldoFavor(mp)) return rawMp;
    }

    // Texto que el POS ya resolvió (YAPE, EFECTIVO…): no usar el idFormaPago como si fuera MediosPago.
    if (p.descripcion && !descSaf) {
      const byDesc = findMpByDescripcion(mpList, p.descripcion);
      if (byDesc != null) return byDesc;
    }

    // El POS envía idFormaPago (Crédito, Efectivo…). Mapear siempre a MediosPago.
    if (fpExpl && !esDescripcionSaldoFavor(fpExpl.descripcion)) {
      const mapped = findMpForForma(fpExpl);
      if (mapped != null) return mapped;
    }

    // Legacy: un solo campo idMediosPago que en realidad es idFormaPago.
    // Si ese número también es el medio SAF, NO tratar la venta a crédito como saldo a favor.
    if (fpEnSlotMp && mp && esMedioSaldoFavor(mp) && !esDescripcionSaldoFavor(fpEnSlotMp.descripcion) && !descSaf) {
      const mapped = findMpForForma(fpEnSlotMp);
      if (mapped != null) return mapped;
    }

    // Mismo número en ambos catálogos (ej. FormasPago YAPE = 2 y MediosPago CHEQUE = 2).
    if (mp && fpEnSlotMp && normDesc(mp.descripcion) !== normDesc(fpEnSlotMp.descripcion)) {
      const mapped = findMpForForma(fpEnSlotMp);
      if (mapped != null) return mapped;
    }

    if (mp) return rawMp;

    if (fpEnSlotMp) {
      const mapped = findMpForForma(fpEnSlotMp);
      if (mapped != null) return mapped;
    }
    if (fpExpl) {
      const mapped = findMpForForma(fpExpl);
      if (mapped != null) return mapped;
    }
    return defaultId;
  };

  const out = [];
  for (const p of detallePago || []) {
    const monto = round2(Number(p.monto) || 0);
    if (monto <= 0) continue;
    const rawFp = p.idFormaPago != null && p.idFormaPago !== "" ? Number(p.idFormaPago) : NaN;
    let idFormaPago = Number.isFinite(rawFp) && fpById.has(rawFp) ? rawFp : null;
    if (idFormaPago == null && p.descripcion) {
      const nd = normDesc(p.descripcion);
      for (const fp of fpById.values()) {
        if (normDesc(fp.descripcion) === nd) {
          idFormaPago = Number(fp.idFormaPago);
          break;
        }
      }
    }
    const row = {
      idMediosPago: resolverId(p),
      monto,
      descripcion: p.descripcion != null ? String(p.descripcion) : undefined
    };
    if (idFormaPago != null) row.idFormaPago = idFormaPago;
    out.push(row);
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
  esDescripcionSaldoFavor,
};
