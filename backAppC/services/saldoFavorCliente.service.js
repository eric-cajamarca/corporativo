/**
 * Saldo a favor del cliente + cierre de CxC al anular / baja / NC.
 *
 * Reglas:
 * - Crédito sin cobros → se anula (sin saldo a favor).
 * - Crédito con cobros → se anula la deuda pendiente y lo cobrado pasa a saldo a favor.
 * - Al vender, el medio SAF descuenta del ledger (no entra a caja).
 */
const saldoFavorRepo = require('../repositories/saldoFavorCliente.repository');

const TIPOS_ABONO = {
  ANULACION: 'ABONO_ANULACION',
  BAJA: 'ABONO_BAJA',
  NC: 'ABONO_NC',
  SANEAMIENTO: 'SANEAMIENTO'
};

function round2(n) {
  return saldoFavorRepo.round2(n);
}

async function idsMediosPagoSaldoFavor(transaction) {
  const r = await transaction.request().query(`
    SELECT idMediosPago FROM MediosPago
    WHERE RTRIM(LTRIM(ISNULL(codigo, ''))) IN ('SAF', 'saf')
       OR LOWER(ISNULL(descripcion, '')) LIKE '%saldo a favor%'
  `);
  return new Set((r.recordset || []).map((x) => Number(x.idMediosPago)).filter(Number.isFinite));
}

function sumaSaldoFavorEnDetalle(detallePago, idsSaf) {
  return round2(
    (detallePago || []).reduce((s, p) => {
      const id = Number(p.idMediosPago);
      if (!idsSaf.has(id)) return s;
      return s + (Number(p.monto) || 0);
    }, 0)
  );
}

/**
 * Cierra créditos de una venta y, si hubo cobros, acredita saldo a favor.
 * @param {'ANULACION'|'BAJA'|'NC'|'SANEAMIENTO'} origen
 */
async function cerrarCreditosDeVenta(ctx, opts) {
  const {
    idEmpresa,
    idVenta,
    origen = 'ANULACION',
    compVenta = null,
    idUsuario = null,
    montoMaximoAbono = null
  } = opts;

  if (!idEmpresa || idVenta == null) {
    return { cerrados: 0, saldoAcreditado: 0, detalles: [] };
  }

  const tipoAbono = TIPOS_ABONO[origen] || TIPOS_ABONO.ANULACION;
  const creditos = await saldoFavorRepo.listarCreditosActivosPorVenta(ctx, idEmpresa, idVenta);
  if (!creditos.length) {
    return { cerrados: 0, saldoAcreditado: 0, detalles: [] };
  }

  let saldoAcreditado = 0;
  const detalles = [];
  const refBase = String(compVenta || `VTA-${idVenta}`).slice(0, 40);

  for (const cr of creditos) {
    const resumen = await saldoFavorRepo.resumenCobrosCredito(ctx, idEmpresa, cr.idCredito);
    let aAcreditar = resumen.totalPagado;
    const topeCredito = round2(Number(cr.montoTotal) || 0);
    if (topeCredito > 0.009) {
      aAcreditar = round2(Math.min(aAcreditar, topeCredito));
    }

    if (montoMaximoAbono != null && Number.isFinite(Number(montoMaximoAbono))) {
      aAcreditar = round2(Math.min(aAcreditar, Number(montoMaximoAbono)));
    }

    const obs = `[${origen}] ${refBase}`;
    await saldoFavorRepo.anularCreditoYCuotasPendientes(ctx, idEmpresa, cr.idCredito, obs);

    let acred = null;
    if (aAcreditar > 0.009) {
      acred = await saldoFavorRepo.acreditar(ctx, {
        idEmpresa,
        idCliente: cr.idCliente,
        monto: aAcreditar,
        tipo: tipoAbono,
        referencia: `${origen}-${refBase}`.slice(0, 50),
        idVenta,
        idCreditoOrigen: cr.idCredito,
        motivo: `Cobros del crédito trasladados a saldo a favor (${origen} ${refBase})`,
        idUsuario
      });
      if (acred && acred.ok && !acred.idempotente) {
        saldoAcreditado = round2(saldoAcreditado + acred.monto);
      }
    }

    detalles.push({
      idCredito: cr.idCredito,
      idCliente: cr.idCliente,
      totalPagado: resumen.totalPagado,
      saldoPendienteAnulado: resumen.saldoPendiente,
      saldoAcreditado: acred && acred.ok && !acred.idempotente ? acred.monto : 0
    });
  }

  return { cerrados: creditos.length, saldoAcreditado, detalles };
}

/**
 * Tras NC parcial: abona cuotas (ya lo hace notaCreditoCobranza).
 * Si el monto NC supera lo abonado a cuotas, el exceso va a saldo a favor.
 * Si la NC cancela todo el crédito (saldo cuotas = 0), marca CANCELADO.
 */
async function acreditarExcesoNotaCredito(ctx, opts) {
  const {
    idEmpresa,
    idCliente,
    idVentaOrigen,
    idCredito,
    montoNc,
    montoAbonadoCuotas,
    compNc,
    idUsuario
  } = opts;

  const exceso = round2(Number(montoNc) - Number(montoAbonadoCuotas));
  if (exceso <= 0.02 || !idCliente) {
    return { acreditado: 0 };
  }

  const res = await saldoFavorRepo.acreditar(ctx, {
    idEmpresa,
    idCliente,
    monto: exceso,
    tipo: TIPOS_ABONO.NC,
    referencia: `NC-EXC-${String(compNc || idVentaOrigen || '').slice(0, 35)}`,
    idVenta: idVentaOrigen || null,
    idCreditoOrigen: idCredito || null,
    motivo: `Exceso de nota de crédito ${compNc || ''}`.trim(),
    idUsuario
  });

  return { acreditado: res.ok && !res.idempotente ? res.monto : 0, saldo: res.saldo };
}

/**
 * Aplica líneas de pago "Saldo a favor" del detallePago a cada venta.
 */
async function aplicarSaldoFavorDesdeDetallePago(ctx, opts) {
  const { ventasEmpresa, detallePago, userSub } = opts;
  if (!ventasEmpresa || !ventasEmpresa.length || !detallePago || !detallePago.length) {
    return { aplicadoTotal: 0 };
  }

  const idsSaf = await idsMediosPagoSaldoFavor(ctx);
  if (idsSaf.size === 0) return { aplicadoTotal: 0 };

  const totalSaf = sumaSaldoFavorEnDetalle(detallePago, idsSaf);
  if (totalSaf <= 0.02) return { aplicadoTotal: 0 };

  // Reparto proporcional por total de cada comprobante (mismo criterio que crédito).
  const totalVentas = round2(ventasEmpresa.reduce((s, v) => s + (Number(v.total) || 0), 0));
  let restante = totalSaf;
  let aplicadoTotal = 0;

  for (let i = 0; i < ventasEmpresa.length; i++) {
    const v = ventasEmpresa[i];
    if (v.idCliente == null) continue;
    let parte =
      i === ventasEmpresa.length - 1
        ? restante
        : round2((totalSaf * (Number(v.total) || 0)) / (totalVentas || 1));
    parte = round2(Math.min(parte, restante));
    if (parte <= 0.009) continue;

    await saldoFavorRepo.aplicarAVenta(ctx, {
      idEmpresa: v.idEmpresa,
      idCliente: v.idCliente,
      monto: parte,
      idVenta: v.idVenta,
      idUsuario: userSub,
      referencia: `VTA-${v.compVenta || v.idVenta}`
    });
    aplicadoTotal = round2(aplicadoTotal + parte);
    restante = round2(restante - parte);
  }

  return { aplicadoTotal };
}

async function obtenerSaldo(pool, idEmpresa, idCliente) {
  return saldoFavorRepo.obtenerSaldoDisponible(pool, idEmpresa, idCliente);
}

async function listarMovimientos(pool, idEmpresa, idCliente, limite) {
  return saldoFavorRepo.listarMovimientos(pool, idEmpresa, idCliente, limite);
}

async function listarSaldosEmpresa(pool, idEmpresa) {
  return saldoFavorRepo.listarSaldosEmpresa(pool, idEmpresa);
}

/**
 * Sanea créditos huérfanos (venta eliminada) de una empresa.
 */
async function sanearCreditosHuerfanos(pool, idEmpresa, idUsuario) {
  const sql = require('mssql');
  const huerfanos = await saldoFavorRepo.listarCreditosHuerfanos(pool, idEmpresa);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    let procesados = 0;
    let saldoTotal = 0;
    const detalles = [];
    const ventasYa = new Set();
    for (const h of huerfanos) {
      if (h.idVenta != null) {
        const key = `${String(h.idEmpresa).toLowerCase()}|${h.idVenta}`;
        if (ventasYa.has(key)) continue;
        ventasYa.add(key);
      }
      const r = await cerrarCreditosDeVenta(transaction, {
        idEmpresa: h.idEmpresa,
        idVenta: h.idVenta,
        origen: 'SANEAMIENTO',
        compVenta: h.compVenta,
        idUsuario
      });
      // Si idVenta es null, cerrarCreditosDeVenta no encuentra por venta: cerrar por idCredito directo.
      if (!h.idVenta) {
        const resumen = await saldoFavorRepo.resumenCobrosCredito(transaction, h.idEmpresa, h.idCredito);
        await saldoFavorRepo.anularCreditoYCuotasPendientes(
          transaction,
          h.idEmpresa,
          h.idCredito,
          '[SANEAMIENTO] sin venta'
        );
        let acredMonto = 0;
        if (resumen.totalPagado > 0.009) {
          const acred = await saldoFavorRepo.acreditar(transaction, {
            idEmpresa: h.idEmpresa,
            idCliente: h.idCliente,
            monto: resumen.totalPagado,
            tipo: TIPOS_ABONO.SANEAMIENTO,
            referencia: `SAN-${String(h.idCredito).slice(0, 8)}`,
            idCreditoOrigen: h.idCredito,
            motivo: 'Saneamiento crédito sin venta',
            idUsuario
          });
          acredMonto = acred.ok && !acred.idempotente ? acred.monto : 0;
        }
        procesados += 1;
        saldoTotal = round2(saldoTotal + acredMonto);
        detalles.push({ idCredito: h.idCredito, saldoAcreditado: acredMonto });
        continue;
      }
      procesados += r.cerrados;
      saldoTotal = round2(saldoTotal + r.saldoAcreditado);
      detalles.push(...r.detalles);
    }
    await transaction.commit();
    return { candidatos: huerfanos.length, procesados, saldoAcreditado: saldoTotal, detalles };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function diagnosticarHuerfanos(pool, idEmpresa) {
  return saldoFavorRepo.listarCreditosHuerfanos(pool, idEmpresa);
}

module.exports = {
  TIPOS_ABONO,
  idsMediosPagoSaldoFavor,
  sumaSaldoFavorEnDetalle,
  cerrarCreditosDeVenta,
  acreditarExcesoNotaCredito,
  aplicarSaldoFavorDesdeDetallePago,
  obtenerSaldo,
  listarMovimientos,
  listarSaldosEmpresa,
  sanearCreditosHuerfanos,
  diagnosticarHuerfanos
};
