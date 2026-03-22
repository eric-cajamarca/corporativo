/**
 * Utilidades para repartir formas de pago entre comprobantes de una venta agrupada (multiempresa).
 */

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Une líneas con el mismo idMediosPago (montos sumados).
 * @param {{ idMediosPago: number, monto: number }[]} rows
 */
function mergeDetallePorMedio(rows) {
  const m = new Map();
  for (const r of rows) {
    const mo = round2(Number(r.monto) || 0);
    if (mo <= 0) continue;
    const raw = r.idMediosPago;
    const idNum = raw != null && raw !== '' ? Number(raw) : NaN;
    const key = Number.isFinite(idNum) ? `id:${idNum}` : 'unset';
    m.set(key, round2((m.get(key) || 0) + mo));
  }
  return [...m.entries()].map(([key, monto]) =>
    key === 'unset' ? { monto } : { idMediosPago: Number(key.replace(/^id:/, '')), monto }
  );
}

/**
 * Reparte formas de pago en el orden enviado (consumo secuencial / "waterfall"):
 * se cubre el total del primer comprobante con los primeros medios hasta completar,
 * luego el segundo comprobante, etc.
 *
 * Ejemplo: comprobantes 60 + 40; pagos Yape 20 + Plin 20 + Efectivo 60
 * → primera venta: 20 Yape + 20 Plin + 20 Efectivo; segunda: 40 Efectivo.
 *
 * @param {{ idVenta: number, idEmpresa: string, compVenta?: string, idSucursal?: string|null, total: number }[]} lineasComprobante
 * @param {{ idMediosPago?: number, monto: number }[]} detallePago
 * @returns {Array<{ idVenta: number, idEmpresa: string, compVenta?: string, idSucursal?: string|null, total: number, detallePago: { idMediosPago: number, monto: number }[] }>}
 */
function repartirDetallePagoEntreComprobantes(lineasComprobante, detallePago) {
  const lineas = [...lineasComprobante].map((l) => ({
    idVenta: l.idVenta,
    idEmpresa: l.idEmpresa,
    compVenta: l.compVenta,
    idSucursal: l.idSucursal,
    total: round2(Number(l.total) || 0),
  }));

  const pool = (detallePago || [])
    .map((p) => ({
      idMediosPago: p.idMediosPago,
      monto: round2(Number(p.monto) || 0),
    }))
    .filter((p) => p.monto > 0);

  const sumPagos = round2(pool.reduce((s, p) => s + p.monto, 0));
  const sumComp = round2(lineas.reduce((s, l) => s + l.total, 0));

  if (Math.abs(sumPagos - sumComp) > 0.02) {
    const err = new Error(
      `El total de formas de pago (${sumPagos}) no coincide con la suma de comprobantes (${sumComp}).`
    );
    err.code = 'TOTAL_PAGO_INCONSISTENTE';
    throw err;
  }

  const poolWork = pool.map((p) => ({ ...p }));
  const resultado = [];

  for (const linea of lineas) {
    let due = linea.total;
    const alloc = [];
    while (due > 0.001 && poolWork.length > 0) {
      const bucket = poolWork[0];
      const take = round2(Math.min(due, bucket.monto));
      if (take <= 0) {
        poolWork.shift();
        continue;
      }
      alloc.push({ idMediosPago: bucket.idMediosPago, monto: take });
      due = round2(due - take);
      bucket.monto = round2(bucket.monto - take);
      if (bucket.monto <= 0.001) poolWork.shift();
    }
    if (due > 0.001) {
      const err = new Error(
        'No alcanzan las formas de pago para cubrir todos los comprobantes de la venta agrupada.'
      );
      err.code = 'PAGO_INSUFICIENTE';
      throw err;
    }
    resultado.push({
      ...linea,
      detallePago: mergeDetallePorMedio(alloc),
    });
  }

  const sobra = round2(poolWork.reduce((s, b) => s + b.monto, 0));
  if (sobra > 0.02) {
    const err = new Error('Sobran montos en formas de pago respecto al total de los comprobantes.');
    err.code = 'PAGO_EXCEDENTE';
    throw err;
  }

  return resultado;
}

module.exports = {
  repartirDetallePagoEntreComprobantes,
  round2,
  mergeDetallePorMedio,
};
