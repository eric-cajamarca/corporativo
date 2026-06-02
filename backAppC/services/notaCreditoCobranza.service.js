/**
 * Al aceptar una Nota de Crédito (SUNAT 07): ajusta cobranza de la factura/boleta origen.
 * - Origen pendiente: reduce saldo; cierra cobranza si queda en cero.
 * - Origen pagada al contado: devolución en caja (mismo medio de pago del cobro).
 * - Origen a crédito (cuotas): abona saldo de cuotas sin movimiento de caja.
 */
const sql = require("mssql");
const CajaRepository = require("../repositories/caja.repository");
const ventasRepository = require("../repositories/ventas.repository");
const { esNotaCreditoCodigoComprobante } = require("../utils/sunatCodigoComprobante.util");

const MARCA_COBRANZA_OK = "[EFAF_NC_COBRANZA_OK]";
const MARCA_COBRANZA_PEND_CAJA = "[EFAF_NC_COBRANZA_PEND_CAJA]";
const CODIGOS_NC = new Set(["F7", "B7", "07"]);
const ESTADOS_SUNAT_ACEPTADOS = new Set([1, 3]);

function esEstadoAceptadoSunat(id) {
  return ESTADOS_SUNAT_ACEPTADOS.has(Number(id));
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function parseCompRelacionado(compRel) {
  const rel = String(compRel || "").trim();
  const dash = rel.indexOf("-");
  if (dash < 1) return null;
  const serie = rel.slice(0, dash).trim();
  const numPart = rel.slice(dash + 1).replace(/\D/g, "");
  const numInt = parseInt(numPart, 10);
  if (!serie || !Number.isFinite(numInt) || numInt < 0) return null;
  return { serie, numero: numInt, compNorm: rel.length > 30 ? rel.slice(0, 30) : rel };
}

async function obtenerCabeceraNc(ctx, idComprobanteElectronico) {
  const r = await ctx
    .request()
    .input("id", sql.UniqueIdentifier, idComprobanteElectronico)
    .query(`
      SELECT ce.idEmpresa, ce.tipoComprobante, v.idVenta, v.compVenta, v.compRelacionado,
             v.total, v.idSucursal, v.idUsuario, v.observaciones, v.idEstadoPago,
             UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante
      FROM ComprobantesElectronicos ce
      INNER JOIN Ventas v ON v.idVenta = ce.idVenta AND v.idEmpresa = ce.idEmpresa
      LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
      WHERE ce.idComprobanteElectronico = @id
    `);
  return r.recordset && r.recordset[0] ? r.recordset[0] : null;
}

async function resolverVentaOrigen(ctx, idEmpresa, compRelacionado) {
  const parsed = parseCompRelacionado(compRelacionado);
  if (!parsed) return null;
  const r = await ctx
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("serie", sql.VarChar(20), parsed.serie.slice(0, 20))
    .input("numero", sql.Int, parsed.numero)
    .input("compRel", sql.VarChar(30), parsed.compNorm)
    .query(`
      SELECT TOP 1
        v.idVenta, v.compVenta, v.total, v.idEstadoPago, v.idSucursal, v.idMediosPago,
        UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante
      FROM Ventas v
      LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
      WHERE v.idEmpresa = @idEmpresa
        AND ISNULL(v.eliminado, 0) = 0
        AND UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) NOT IN ('F7','B7','F8','B8','07','08')
        AND (
          RTRIM(LTRIM(UPPER(ISNULL(v.compVenta, '')))) = RTRIM(LTRIM(UPPER(@compRel)))
          OR (RTRIM(LTRIM(v.serie)) = @serie AND TRY_CAST(v.numero AS INT) = @numero)
        )
      ORDER BY v.fEmision DESC, v.idVenta DESC
    `);
  return r.recordset && r.recordset[0] ? r.recordset[0] : null;
}

async function sumarNcAceptadasOrigen(ctx, idEmpresa, compRelacionado, excluirIdVentaNc) {
  const parsed = parseCompRelacionado(compRelacionado);
  if (!parsed) return 0;
  const r = await ctx
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("compRel", sql.VarChar(30), parsed.compNorm)
    .input("excluir", sql.Int, excluirIdVentaNc != null ? excluirIdVentaNc : -1)
    .query(`
      SELECT ISNULL(SUM(vnc.total), 0) AS totalNc
      FROM Ventas vnc
      INNER JOIN Comprobantes cnc ON cnc.idComprobante = vnc.idComprobante AND cnc.idEmpresa = vnc.idEmpresa
      INNER JOIN ComprobantesElectronicos ce ON ce.idVenta = vnc.idVenta AND ce.idEmpresa = vnc.idEmpresa
      WHERE vnc.idEmpresa = @idEmpresa
        AND ISNULL(vnc.eliminado, 0) = 0
        AND UPPER(LTRIM(RTRIM(ISNULL(cnc.codigo, '')))) IN ('F7','B7','07')
        AND RTRIM(LTRIM(UPPER(ISNULL(vnc.compRelacionado, '')))) = RTRIM(LTRIM(UPPER(@compRel)))
        AND ce.tipoComprobante = '07'
        AND ce.idEstadoSunat IN (1, 2, 3)
        AND vnc.idVenta <> @excluir
    `);
  return Number((r.recordset[0] || {}).totalNc || 0);
}

async function obtenerCreditoPorVenta(ctx, idEmpresa, idVenta) {
  const r = await ctx
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idVenta", sql.Int, idVenta)
    .query(`
      SELECT TOP 1 idCredito, montoTotal, estado
      FROM CreditosClientes
      WHERE idEmpresa = @idEmpresa AND idVenta = @idVenta AND estado = 'ACTIVO'
      ORDER BY fechaCredito DESC
    `);
  return r.recordset && r.recordset[0] ? r.recordset[0] : null;
}

async function abonarCuotasCredito(ctx, idEmpresa, idCredito, montoAbonar) {
  let restante = round2(montoAbonar);
  if (restante <= 0) return { abonado: 0 };

  const cuotasRs = await ctx
    .request()
    .input("idCredito", sql.UniqueIdentifier, idCredito)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idCuota, saldoPendiente, numeroCuota
      FROM CuotasCredito
      WHERE idCredito = @idCredito AND idEmpresa = @idEmpresa
        AND estado IN ('PENDIENTE', 'VENCIDO')
      ORDER BY numeroCuota ASC
    `);
  const cuotas = cuotasRs.recordset || [];
  let abonado = 0;

  for (const cuota of cuotas) {
    if (restante <= 0.009) break;
    const saldo = round2(cuota.saldoPendiente);
    if (saldo <= 0) continue;
    const pago = round2(Math.min(restante, saldo));
    const nuevoSaldo = round2(saldo - pago);
    const req = ctx.request();
    await req
      .input("idCuota", sql.UniqueIdentifier, cuota.idCuota)
      .input("nuevoSaldo", sql.Decimal(18, 2), nuevoSaldo);
    if (nuevoSaldo <= 0.01) {
      await req.query(`
        UPDATE CuotasCredito
        SET saldoPendiente = 0, estado = 'PAGADO', fechaPago = GETDATE()
        WHERE idCuota = @idCuota
      `);
    } else {
      await req.query(`
        UPDATE CuotasCredito
        SET saldoPendiente = @nuevoSaldo
        WHERE idCuota = @idCuota
      `);
    }
    abonado = round2(abonado + pago);
    restante = round2(restante - pago);
  }

  if (restante > 0.02) {
    const credRs = await ctx
      .request()
      .input("idCredito", sql.UniqueIdentifier, idCredito)
      .query(`
        SELECT SUM(CASE WHEN estado IN ('PENDIENTE','VENCIDO') THEN saldoPendiente ELSE 0 END) AS saldo
        FROM CuotasCredito WHERE idCredito = @idCredito
      `);
    const saldoCuotas = Number((credRs.recordset[0] || {}).saldo || 0);
    if (saldoCuotas <= 0.02) {
      await ctx
        .request()
        .input("idCredito", sql.UniqueIdentifier, idCredito)
        .query(`UPDATE CreditosClientes SET estado = 'CANCELADO' WHERE idCredito = @idCredito`);
    }
  }

  return { abonado };
}

async function aplicarReduccionPendienteOrigen(ctx, idEmpresa, origen, compRelacionado, montoNc, idVentaNc) {
  const ncPrevias = await sumarNcAceptadasOrigen(ctx, idEmpresa, compRelacionado, idVentaNc);
  const totalOrigen = round2(origen.total);
  const ncTotal = round2(ncPrevias + montoNc);
  const saldo = round2(totalOrigen - ncTotal);

  if (saldo <= 0.01) {
    await ventasRepository.actualizarEstadoPagoVenta(ctx, origen.idVenta, idEmpresa, 2);
    return { tipo: "PENDIENTE_CERRADO", saldoRestante: 0 };
  }
  return { tipo: "PENDIENTE_PARCIAL", saldoRestante: saldo };
}

async function obtenerDetallePagoVenta(ctx, idVenta) {
  const r = await ctx
    .request()
    .input("idVenta", sql.Int, idVenta)
    .query(`
      SELECT idMediosPago, monto FROM DetallePagoVenta
      WHERE idVenta = @idVenta AND monto > 0
      ORDER BY monto DESC
    `);
  const filas = r.recordset || [];
  if (filas.length) return filas.map((f) => ({ idMediosPago: Number(f.idMediosPago), monto: round2(f.monto) }));
  return [];
}

async function registrarDevolucionCaja(ctx, opts) {
  const {
    idEmpresa,
    idSucursal,
    idUsuario,
    compNc,
    compOrigen,
    montoDevolver,
    detallePagoOrigen,
    idVentaNc,
  } = opts;

  let apertura = idSucursal
    ? await CajaRepository.obtenerAperturaAbiertaPorSucursalRepo(ctx, idEmpresa, idSucursal)
    : null;
  if (!apertura) {
    apertura = await CajaRepository.obtenerCualquierAperturaAbiertaRepo(ctx, idEmpresa);
  }
  if (!apertura || !apertura.idApertura) {
    return { ok: false, motivo: "sin_apertura_caja" };
  }

  const idTipoEgreso = await CajaRepository.obtenerIdTipoMovimientoEgresoRepo(ctx, "DEVOLUCION_VENTA");
  if (!idTipoEgreso) {
    return { ok: false, motivo: "sin_tipo_egreso" };
  }

  const userCaja = { empresa: idEmpresa, sub: idUsuario || idEmpresa, sucursal: apertura.idSucursal };
  const conceptoBase = `Devolución NC ${compNc} ref ${compOrigen}`.slice(0, 100);
  const docRel = String(compNc || "NC").slice(0, 20);

  let lineas = detallePagoOrigen.filter((p) => p.monto > 0);
  if (!lineas.length) {
    lineas = [{ idMediosPago: 1, monto: montoDevolver }];
  }

  const totalPagado = round2(lineas.reduce((s, p) => s + p.monto, 0));
  let restante = round2(montoDevolver);
  const partes = [];

  for (let i = 0; i < lineas.length; i++) {
    const p = lineas[i];
    let parte =
      i === lineas.length - 1
        ? restante
        : round2((montoDevolver * p.monto) / (totalPagado || 1));
    parte = round2(Math.min(parte, restante, p.monto));
    if (parte <= 0) continue;
    partes.push({ idMediosPago: p.idMediosPago, monto: parte });
    restante = round2(restante - parte);
  }
  if (!partes.length && montoDevolver > 0) {
    partes.push({ idMediosPago: lineas[0].idMediosPago, monto: montoDevolver });
  }

  for (const parte of partes) {
    await CajaRepository.registrarMovimientoRepo(ctx, userCaja, {
      idApertura: apertura.idApertura,
      idTipoMovimientoCaja: idTipoEgreso,
      concepto: conceptoBase,
      monto: parte.monto,
      idMediosPago: parte.idMediosPago,
      idMoneda: 1,
      documentoRelacionado: docRel,
      observaciones: `idVentaNc:${idVentaNc}`,
    });
  }

  return { ok: true, partes };
}

async function marcarObservacionesNc(ctx, idVenta, idEmpresa, textoExtra) {
  const prev = await ctx
    .request()
    .input("idVenta", sql.Int, idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`SELECT observaciones FROM Ventas WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa`);
  const obs = String((prev.recordset[0] || {}).observaciones || "").trim();
  const marca = textoExtra.includes(MARCA_COBRANZA_PEND_CAJA) ? MARCA_COBRANZA_PEND_CAJA : MARCA_COBRANZA_OK;
  if (obs.includes(MARCA_COBRANZA_OK) || obs.includes(MARCA_COBRANZA_PEND_CAJA)) return;
  const nuevo = `${obs ? obs + " " : ""}${marca}${textoExtra ? " " + textoExtra : ""}`.slice(0, 500);
  await ctx
    .request()
    .input("idVenta", sql.Int, idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("observaciones", sql.VarChar(500), nuevo)
    .query(`UPDATE Ventas SET observaciones = @observaciones WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa`);
}

/**
 * @param {import('mssql').ConnectionPool|import('mssql').Transaction} ctx
 * @param {string} idComprobanteElectronico
 * @param {number|null|undefined} idEstadoAnterior
 * @param {number|null|undefined} idEstadoNuevo
 * @param {string|null|undefined} idUsuarioEjecutor
 */
exports.aplicarCobranzaPorNotaCreditoSiCorresponde = async (
  ctx,
  idComprobanteElectronico,
  idEstadoAnterior,
  idEstadoNuevo,
  idUsuarioEjecutor = null
) => {
  if (!esEstadoAceptadoSunat(idEstadoNuevo)) return;
  if (esEstadoAceptadoSunat(idEstadoAnterior)) return;

  const cab = await obtenerCabeceraNc(ctx, idComprobanteElectronico);
  if (!cab) return;
  if (String(cab.tipoComprobante || "").trim() !== "07") return;
  if (!CODIGOS_NC.has(String(cab.codigoComprobante || "").trim().toUpperCase())) return;

  const obs = String(cab.observaciones || "");
  if (obs.includes(MARCA_COBRANZA_OK)) return;

  const idEmpresa = cab.idEmpresa;
  const montoNc = round2(cab.total);
  if (montoNc <= 0) return;

  await ventasRepository.actualizarEstadoPagoVenta(ctx, cab.idVenta, idEmpresa, 2);

  const origen = await resolverVentaOrigen(ctx, idEmpresa, cab.compRelacionado);
  if (!origen) {
    await marcarObservacionesNc(ctx, cab.idVenta, idEmpresa, "sin_origen");
    return;
  }

  const credito = await obtenerCreditoPorVenta(ctx, idEmpresa, origen.idVenta);
  let resultado;

  const compRel = cab.compRelacionado || origen.compVenta;

  if (credito) {
    const { abonado } = await abonarCuotasCredito(ctx, idEmpresa, credito.idCredito, montoNc);
    if (Number(origen.idEstadoPago) === 1) {
      const parcial = await aplicarReduccionPendienteOrigen(
        ctx,
        idEmpresa,
        origen,
        compRel,
        round2(montoNc - abonado),
        cab.idVenta
      );
      resultado = { tipo: "CREDITO", abonado, parcial };
    } else {
      resultado = { tipo: "CREDITO", abonado };
    }
  } else if (Number(origen.idEstadoPago) === 1) {
    resultado = await aplicarReduccionPendienteOrigen(ctx, idEmpresa, origen, compRel, montoNc, cab.idVenta);
  } else if (Number(origen.idEstadoPago) === 2) {
    const detalle = await obtenerDetallePagoVenta(ctx, origen.idVenta);
    const dev = await registrarDevolucionCaja(ctx, {
      idEmpresa,
      idSucursal: cab.idSucursal || origen.idSucursal,
      idUsuario: cab.idUsuario || idUsuarioEjecutor,
      compNc: cab.compVenta,
      compOrigen: origen.compVenta,
      montoDevolver: montoNc,
      detallePagoOrigen: detalle,
      idVentaNc: cab.idVenta,
    });
    if (!dev.ok) {
      await marcarObservacionesNc(
        ctx,
        cab.idVenta,
        idEmpresa,
        `${MARCA_COBRANZA_PEND_CAJA}:${dev.motivo}:${montoNc}`
      );
      return;
    }
    resultado = { tipo: "DEVOLUCION_CAJA", partes: dev.partes };
  } else {
    resultado = { tipo: "ORIGEN_OTRO_ESTADO", idEstadoPago: origen.idEstadoPago };
  }

  await marcarObservacionesNc(ctx, cab.idVenta, idEmpresa, JSON.stringify(resultado).slice(0, 120));
};

exports.MARCA_COBRANZA_OK = MARCA_COBRANZA_OK;
exports.esNotaCreditoCodigoComprobante = esNotaCreditoCodigoComprobante;
