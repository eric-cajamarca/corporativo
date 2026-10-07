const sql = require("mssql");
const CajaRepository = require("./caja.repository");
const { getFechaHoyLocal, resolveFechaHoraClienteSql } = require("../utils/fechaHoraLocal.util");

/** YYYY-MM-DD civil, sin new Date('YYYY-MM-DD') (eso resta un día en Perú). */
function fechaCivilYmd(valor) {
  if (valor == null || valor === "") return null;
  if (typeof valor === "string") {
    const m = valor.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const y = valor.getUTCFullYear();
    const mo = String(valor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(valor.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  return null;
}

function addMonthsYmd(ymd, months) {
  const base = fechaCivilYmd(ymd);
  if (!base) return getFechaHoyLocal();
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function normalizarIdsEmpresaCreditos(idEmpresas) {
  const arr = Array.isArray(idEmpresas) ? idEmpresas : idEmpresas ? [idEmpresas] : [];
  return arr.map((x) => String(x).trim()).filter(Boolean);
}

/**
 * MovimientosCaja.idMediosPago guarda idFormaPago (legado). Igual que nueva venta / recibo de ingreso.
 * No mapear contra MediosPago (catálogo SUNAT Contado/Crédito): el ID choca y el arqueo muestra Cheque.
 */
async function resolveIdFormaPagoCaja(transaction, idEnviado) {
  const res = await transaction.request().query("SELECT idFormaPago, descripcion FROM FormasPago");
  const rows = res.recordset || [];
  const n = idEnviado != null ? Number(idEnviado) : NaN;
  const ids = new Set(rows.map((r) => Number(r.idFormaPago)).filter(Number.isFinite));
  if (Number.isFinite(n) && ids.has(n)) return n;
  const efectivo = rows.find((r) =>
    String(r.descripcion || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes("EFECTIVO")
  );
  if (efectivo) return Number(efectivo.idFormaPago);
  return Number.isFinite(n) ? n : null;
}

/** Lista créditos de una o varias empresas. Si idCliente viene vacío/null, devuelve todos; si es número, filtra por ese cliente. */
exports.obtenerCreditosClienteRepo = async (pool, idEmpresas, idCliente) => {
  const idsEmp = normalizarIdsEmpresaCreditos(idEmpresas);
  if (idsEmp.length === 0) return [];

  const filtrarPorCliente = idCliente != null && String(idCliente).trim() !== '' && !isNaN(Number(idCliente));
  const request = pool.request();
  idsEmp.forEach((id, i) => request.input(`idEmp${i}`, sql.UniqueIdentifier, id));
  const inEmpresa =
    idsEmp.length === 1 ? "cc.idEmpresa = @idEmp0" : `cc.idEmpresa IN (${idsEmp.map((_, i) => `@idEmp${i}`).join(", ")})`;

  if (filtrarPorCliente) request.input("idCliente", sql.Int, Number(idCliente));

  const condicionCliente = filtrarPorCliente ? " AND cc.idCliente = @idCliente" : "";

  try {
    const result = await request.query(`
      SELECT
        cc.idEmpresa,
        cc.idCredito,
        cc.idCliente,
        ISNULL(c.rSocial, '') AS cliente,
        CONVERT(VARCHAR(19), cc.fechaCredito, 120) AS fechaCredito,
        cc.montoTotal,
        cc.plazoDias,
        cc.tasaInteres,
        cc.estado,
        cc.observaciones,
        v.idVenta,
        v.serie + '-' + v.numero AS comprobante,
        uw.nombres + ' ' + uw.apellidos AS usuarioCredito,
        COUNT(cu.idCuota) AS totalCuotas,
        COUNT(CASE WHEN cu.estado = 'PAGADO' THEN 1 END) AS cuotasPagadas,
        COUNT(CASE WHEN cu.estado = 'VENCIDO' THEN 1 END) AS cuotasVencidas,
        ISNULL(SUM(cu.montoCuota), 0) AS totalCuotasGeneradas,
        ISNULL(SUM(cu.montoCuota - ISNULL(cu.saldoPendiente, 0)), 0) AS totalPagado,
        ISNULL(SUM(ISNULL(cu.saldoPendiente, 0)), 0) AS saldoPendiente,
        CONVERT(VARCHAR(10), MIN(CASE WHEN cu.estado IN ('PENDIENTE', 'VENCIDO', 'PARCIAL') THEN cu.fechaVencimiento END), 23) AS proximaCuota
      FROM CreditosClientes cc
      LEFT JOIN Clientes c ON cc.idCliente = c.idCliente
      LEFT JOIN Ventas v ON cc.idVenta = v.idVenta
      LEFT JOIN CuotasCredito cu ON cc.idCredito = cu.idCredito
      LEFT JOIN UsuarioWeb uw ON cc.idUsuarioCredito = uw.idUsuario
      WHERE ${inEmpresa}${condicionCliente}
        AND ISNULL(cc.estado, '') NOT IN ('ANULADO', 'CANCELADO')
        AND (v.idVenta IS NULL OR ISNULL(v.eliminado, 0) = 0)
      GROUP BY cc.idEmpresa, cc.idCredito, cc.idCliente, c.rSocial, cc.fechaCredito, cc.montoTotal, cc.plazoDias,
               cc.tasaInteres, cc.estado, cc.observaciones, v.idVenta,
               v.serie, v.numero, uw.nombres, uw.apellidos
      ORDER BY cc.fechaCredito DESC
    `);
    return result.recordset;
  } catch (err) {
    const msg = err.message || '';
    const code = err.number ?? err.originalError?.number;
    if (code === 208 || /Invalid object name|CuotasCredito|UsuarioWeb/.test(msg)) {
      return await listarCreditosSimple(pool, idsEmp, filtrarPorCliente ? Number(idCliente) : null);
    }
    throw err;
  }
};

/** Fallback: listado solo desde CreditosClientes (sin JOINs) cuando faltan tablas relacionadas. */
async function listarCreditosSimple(pool, idsEmpresa, idCliente) {
  const ids = normalizarIdsEmpresaCreditos(idsEmpresa);
  if (ids.length === 0) return [];
  const req = pool.request();
  ids.forEach((id, i) => req.input(`idEmp${i}`, sql.UniqueIdentifier, id));
  const inEmp = ids.length === 1 ? "idEmpresa = @idEmp0" : `idEmpresa IN (${ids.map((_, i) => `@idEmp${i}`).join(", ")})`;
  const cond = idCliente != null ? " AND idCliente = @idCliente" : "";
  if (idCliente != null) req.input("idCliente", sql.Int, idCliente);
  const result = await req.query(`
    SELECT
      idEmpresa,
      idCredito,
      idCliente,
      CAST(NULL AS VARCHAR(250)) AS cliente,
      fechaCredito,
      montoTotal,
      plazoDias,
      tasaInteres,
      estado,
      observaciones,
      idVenta AS idVenta,
      CAST(NULL AS VARCHAR(50)) AS comprobante,
      CAST(NULL AS VARCHAR(200)) AS usuarioCredito,
      0 AS totalCuotas,
      0 AS cuotasPagadas,
      0 AS cuotasVencidas,
      0 AS totalCuotasGeneradas,
      0 AS totalPagado,
      montoTotal AS saldoPendiente,
      CAST(NULL AS DATE) AS proximaCuota
    FROM CreditosClientes
    WHERE ${inEmp}${cond}
    ORDER BY fechaCredito DESC
  `);
  return result.recordset;
}

exports.validarClienteEmpresaRepo = async (pool, idCliente, idEmpresa) => {
  const result = await pool
    .request()
    .input("idCliente", sql.Int, idCliente)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM Clientes
      WHERE idCliente = @idCliente AND idEmpresa = @idEmpresa AND estado = 1
    `);

  return result.recordset[0].existe > 0;
};

exports.validarVentaEmpresaRepo = async (pool, idVenta, idEmpresa) => {
  const result = await pool
    .request()
    .input("idVenta", sql.Int, idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM Ventas
      WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
    `);

  return result.recordset[0].existe > 0;
};

/**
 * Dentro de una transacción ya abierta: crédito + cuotas con montos y fechas explícitas (venta factura/boleta/NV).
 */
exports.crearCreditoYCuotasExplicitasEnTransaccion = async (transaction, params) => {
  const {
    idEmpresa,
    idCliente,
    idVenta,
    idUsuarioCredito,
    montoTotal,
    cuotas,
    observaciones,
    fechaCredito
  } = params;
  if (!idEmpresa || idCliente == null || !idUsuarioCredito) return null;
  const mt = Number(montoTotal);
  if (!Number.isFinite(mt) || mt <= 0) return null;
  if (!cuotas || !Array.isArray(cuotas) || cuotas.length === 0) return null;

  const fechaCreditoSql = resolveFechaHoraClienteSql(fechaCredito);

  const ins = await transaction
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idCliente", sql.Int, idCliente)
    .input("idVenta", sql.Int, idVenta)
    .input("idUsuarioCredito", sql.UniqueIdentifier, idUsuarioCredito)
    .input("montoTotal", sql.Decimal(18, 2), mt)
    .input("plazoDias", sql.Int, 0)
    .input("tasaInteres", sql.Decimal(5, 2), 0)
    .input("observaciones", sql.VarChar(500), observaciones || null)
    .input("fechaCredito", sql.VarChar(23), fechaCreditoSql)
    .query(`
      INSERT INTO CreditosClientes (
        idEmpresa, idCliente, idVenta, idUsuarioCredito, fechaCredito,
        montoTotal, plazoDias, tasaInteres, estado, observaciones
      )
      OUTPUT INSERTED.idCredito
      VALUES (
        @idEmpresa, @idCliente, @idVenta, @idUsuarioCredito, TRY_CONVERT(DATETIME, @fechaCredito, 120),
        @montoTotal, @plazoDias, @tasaInteres, 'ACTIVO', @observaciones
      )
    `);
  const idCredito = ins.recordset[0].idCredito;

  let n = 0;
  for (const c of cuotas) {
    n += 1;
    const num = c.numeroCuota != null ? Number(c.numeroCuota) : n;
    const monto = Number(c.monto);
    const fv = c.fechaVencimiento ? String(c.fechaVencimiento).trim().slice(0, 10) : "";
    if (!fv || !Number.isFinite(monto) || monto <= 0) continue;
    await transaction
      .request()
      .input("idCredito", sql.UniqueIdentifier, idCredito)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .input("numeroCuota", sql.Int, num)
      .input("fechaVencimiento", sql.VarChar(10), fv)
      .input("montoCuota", sql.Decimal(18, 2), monto)
      .input("interes", sql.Decimal(18, 2), 0)
      .input("capital", sql.Decimal(18, 2), monto)
      .input("saldoPendiente", sql.Decimal(18, 2), monto)
      .query(`
        INSERT INTO CuotasCredito (
          idCredito, idEmpresa, numeroCuota, fechaVencimiento,
          montoCuota, interes, capital, saldoPendiente, estado
        ) VALUES (
          @idCredito, @idEmpresa, @numeroCuota, TRY_CONVERT(DATE, @fechaVencimiento, 23),
          @montoCuota, @interes, @capital, @saldoPendiente, 'PENDIENTE'
        )
      `);
  }
  return { idCredito };
};

exports.crearCreditoRepo = async (pool, user, datos) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = transaction.request();
    const fechaInicio = fechaCivilYmd(datos.fechaInicio) || getFechaHoyLocal();

    const fechaCreditoSql = resolveFechaHoraClienteSql(datos.fechaCredito);

    // Crear el crédito
    const creditoResult = await request
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("idCliente", sql.Int, datos.idCliente)
      .input("idVenta", sql.Int, datos.idVenta || null)
      .input("idUsuarioCredito", sql.UniqueIdentifier, user.sub)
      .input("montoTotal", sql.Decimal(18, 2), datos.montoTotal)
      .input("plazoDias", sql.Int, datos.plazoDias)
      .input("tasaInteres", sql.Decimal(5, 2), datos.tasaInteres || 0)
      .input("observaciones", sql.VarChar, datos.observaciones || null)
      .input("fechaCredito", sql.VarChar(23), fechaCreditoSql)
      .query(`
        INSERT INTO CreditosClientes (
          idEmpresa, idCliente, idVenta, idUsuarioCredito, fechaCredito,
          montoTotal, plazoDias, tasaInteres, estado, observaciones
        )
        OUTPUT INSERTED.idCredito
        VALUES (
          @idEmpresa, @idCliente, @idVenta, @idUsuarioCredito, TRY_CONVERT(DATETIME, @fechaCredito, 120),
          @montoTotal, @plazoDias, @tasaInteres, 'ACTIVO', @observaciones
        )
      `);

    const idCredito = creditoResult.recordset[0].idCredito;

    // Generar cuotas automáticamente (desde venta: 1 cuota con fecha de vencimiento de la venta)
    await generarCuotasCredito(request, idCredito, user.empresa, datos.montoTotal, datos.plazoDias, datos.tasaInteres, fechaInicio, datos.numeroCuotas, datos.fechaVencimiento);

    await transaction.commit();
    return { idCredito, mensaje: "Crédito y cuotas generadas exitosamente" };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Función auxiliar para generar cuotas
async function generarCuotasCredito(request, idCredito, idEmpresa, montoTotal, plazoDias, tasaInteres, fechaInicio, numeroCuotasOverride, fechaVencimientoUnica) {
  const numeroCuotas = numeroCuotasOverride === 1 ? 1 : Math.ceil(plazoDias / 30);
  const montoCuota = montoTotal / numeroCuotas;
  const tasaMensual = (tasaInteres || 0) / 100 / 12;
  const inicioYmd = fechaCivilYmd(fechaInicio) || getFechaHoyLocal();
  const unicaYmd = fechaCivilYmd(fechaVencimientoUnica);

  for (let i = 1; i <= numeroCuotas; i++) {
    const fechaVencimiento =
      numeroCuotasOverride === 1 && unicaYmd ? unicaYmd : addMonthsYmd(inicioYmd, i);

    const interes = tasaMensual > 0 ? (montoTotal - (i - 1) * montoCuota) * tasaMensual : 0;
    const capital = montoCuota;
    const totalCuota = capital + interes;

    await request
      .input(`idCredito_${i}`, sql.UniqueIdentifier, idCredito)
      .input(`idEmpresa_${i}`, sql.UniqueIdentifier, idEmpresa)
      .input(`numeroCuota_${i}`, sql.Int, i)
      .input(`fechaVencimiento_${i}`, sql.VarChar(10), fechaVencimiento)
      .input(`montoCuota_${i}`, sql.Decimal(18, 2), totalCuota)
      .input(`interes_${i}`, sql.Decimal(18, 2), interes)
      .input(`capital_${i}`, sql.Decimal(18, 2), capital)
      .input(`saldoPendiente_${i}`, sql.Decimal(18, 2), totalCuota)
      .query(`
        INSERT INTO CuotasCredito (
          idCredito, idEmpresa, numeroCuota, fechaVencimiento,
          montoCuota, interes, capital, saldoPendiente, estado
        ) VALUES (
          @idCredito_${i}, @idEmpresa_${i}, @numeroCuota_${i}, TRY_CONVERT(DATE, @fechaVencimiento_${i}, 23),
          @montoCuota_${i}, @interes_${i}, @capital_${i}, @saldoPendiente_${i}, 'PENDIENTE'
        )
      `);
  }
}

exports.obtenerCuotasCreditoRepo = async (pool, idEmpresa, idCredito) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idCredito", sql.UniqueIdentifier, idCredito)
    .query(`
      SELECT
        cu.idCuota,
        cu.numeroCuota,
        CONVERT(VARCHAR(10), cu.fechaVencimiento, 23) AS fechaVencimiento,
        cu.montoCuota,
        cu.interes,
        cu.capital,
        cu.saldoPendiente,
        cu.estado,
        CONVERT(VARCHAR(19), cu.fechaPago, 120) AS fechaPago,
        -- Información de pagos
        COUNT(pc.idPagoCuota) AS numeroPagos,
        SUM(pc.montoPagado) AS totalPagado
      FROM CuotasCredito cu
      LEFT JOIN PagosCuotas pc ON cu.idCuota = pc.idCuota
      WHERE cu.idEmpresa = @idEmpresa AND cu.idCredito = @idCredito
      GROUP BY cu.idCuota, cu.numeroCuota, cu.fechaVencimiento, cu.montoCuota,
               cu.interes, cu.capital, cu.saldoPendiente, cu.estado, cu.fechaPago
      ORDER BY cu.numeroCuota
    `);

  return result.recordset;
};

exports.validarCuotaPendienteRepo = async (pool, idCuota, idEmpresa) => {
  const result = await pool
    .request()
    .input("idCuota", sql.UniqueIdentifier, idCuota)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM CuotasCredito
      WHERE idCuota = @idCuota AND idEmpresa = @idEmpresa
        AND estado IN ('PENDIENTE', 'VENCIDO', 'PARCIAL')
    `);

  return result.recordset[0].existe > 0;
};

exports.pagarCuotaRepo = async (pool, user, datos) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = transaction.request();

    // Obtener información de la cuota
    const cuotaResult = await request
      .input("idCuota", sql.UniqueIdentifier, datos.idCuota)
      .query(`
        SELECT cu.idCredito, cu.numeroCuota, cu.montoCuota, cu.saldoPendiente, cu.fechaVencimiento,
               ISNULL(c.rSocial, '') AS cliente
        FROM CuotasCredito cu
        LEFT JOIN CreditosClientes cc ON cc.idCredito = cu.idCredito
        LEFT JOIN Clientes c ON c.idCliente = cc.idCliente
        WHERE cu.idCuota = @idCuota
      `);

    const cuota = cuotaResult.recordset[0];
    let numeroReciboCobranza = datos.numeroRecibo || null;
    const fechaPagoSql = resolveFechaHoraClienteSql(datos.fechaPago);
    const idFormaPagoCaja = await resolveIdFormaPagoCaja(transaction, datos.idMediosPago);

    if (datos.idApertura && cuota) {
      const idTipoMovimientoCaja = await CajaRepository.obtenerIdTipoMovimientoIngresoRepo(
        transaction,
        "COBRANZA_CREDITO"
      );
      if (idTipoMovimientoCaja) {
        try {
          const { documentoRelacionado } = await CajaRepository.obtenerSiguienteNumeroReciboRepo(
            transaction,
            user.empresa,
            "RI",
            datos.idApertura
          );
          const nombreCliente = String(cuota.cliente || "").trim();
          const glosaCobranza = "Cobranza crédito - Cuota " + (cuota.numeroCuota || "");
          const observacionesCobranza = [
            nombreCliente ? "Recibido de: " + nombreCliente : "",
            "Glosa: " + glosaCobranza
          ].filter(Boolean).join(" | ");
          await CajaRepository.registrarMovimientoRepo(transaction, user, {
            idApertura: datos.idApertura,
            idTipoMovimientoCaja,
            concepto: glosaCobranza,
            monto: datos.montoPagado,
            idMediosPago: idFormaPagoCaja,
            idMoneda: datos.idMoneda || 1,
            documentoRelacionado,
            observaciones: observacionesCobranza,
            fechaMovimiento: fechaPagoSql
          });
          numeroReciboCobranza = documentoRelacionado;
        } catch (errMov) {
          console.error("Error registrar movimiento cobranza:", errMov);
        }
      }
    }

    // Determinar si es pago parcial o total
    const esPagoParcial = datos.montoPagado < cuota.saldoPendiente;

    if (esPagoParcial) {
      await procesarPagoParcial(transaction, cuota, datos, fechaPagoSql);
    } else {
      // Pago total: marcar cuota como pagada (request nuevo para no duplicar idCuota del SELECT inicial)
      const reqUpdate = transaction.request();
      await reqUpdate
        .input("idCuota", sql.UniqueIdentifier, datos.idCuota)
        .input("fechaPago", sql.VarChar(23), fechaPagoSql)
        .query(`
          UPDATE CuotasCredito
          SET estado = 'PAGADO', fechaPago = @fechaPago, saldoPendiente = 0
          WHERE idCuota = @idCuota
        `);
    }

    const requestPago = transaction.request();
    await requestPago
      .input("idCuota", sql.UniqueIdentifier, datos.idCuota)
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("idUsuarioPago", sql.UniqueIdentifier, user.sub)
      .input("montoPagado", sql.Decimal(18, 2), datos.montoPagado)
      .input("idMediosPago", sql.Int, idFormaPagoCaja)
      .input("idMoneda", sql.Int, datos.idMoneda || 1)
      .input("numeroRecibo", sql.VarChar, numeroReciboCobranza || datos.numeroRecibo || null)
      .input("observaciones", sql.VarChar, datos.observaciones || null)
      .input("fechaPago", sql.VarChar(23), fechaPagoSql)
      .query(`
        INSERT INTO PagosCuotas (
          idCuota, idEmpresa, idUsuarioPago, fechaPago, montoPagado,
          idMediosPago, idMoneda, numeroRecibo, observaciones
        ) VALUES (
          @idCuota, @idEmpresa, @idUsuarioPago, TRY_CONVERT(DATETIME, @fechaPago, 120), @montoPagado,
          @idMediosPago, @idMoneda, @numeroRecibo, @observaciones
        )
      `);

    await sincronizarEstadoCredito(transaction, cuota.idCredito, user.empresa);

    await transaction.commit();
    return {
      idCuota: datos.idCuota,
      montoPagado: datos.montoPagado,
      esPagoParcial,
      numeroRecibo: numeroReciboCobranza,
      mensaje: esPagoParcial ? "Pago parcial registrado. La cuota queda con el saldo restante." : "Cuota pagada completamente"
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

async function procesarPagoParcial(transaction, cuota, datos, fechaPagoSql) {
  const pagado = Number(datos.montoPagado) || 0;
  const saldoAntes = Number(cuota.saldoPendiente) || 0;
  const saldoNuevo = Math.round((saldoAntes - pagado) * 100) / 100;
  const req = transaction.request();
  await req
    .input("idCuota", sql.UniqueIdentifier, datos.idCuota)
    .input("fechaPago", sql.VarChar(23), fechaPagoSql)
    .input("saldoPendiente", sql.Decimal(18, 2), saldoNuevo > 0 ? saldoNuevo : 0)
    .query(`
      UPDATE CuotasCredito
      SET estado = CASE WHEN @saldoPendiente <= 0 THEN 'PAGADO' ELSE 'PARCIAL' END,
          fechaPago = TRY_CONVERT(DATETIME, @fechaPago, 120),
          saldoPendiente = @saldoPendiente
      WHERE idCuota = @idCuota
    `);
}

async function sincronizarEstadoCredito(transaction, idCredito, idEmpresa) {
  if (!idCredito || !idEmpresa) return;
  const r = await transaction.request()
    .input("idCreditoSync", sql.UniqueIdentifier, idCredito)
    .input("idEmpresaSync", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        SUM(CASE WHEN estado IN ('PENDIENTE', 'VENCIDO', 'PARCIAL') THEN 1 ELSE 0 END) AS abiertas,
        SUM(ISNULL(saldoPendiente, 0)) AS saldo
      FROM CuotasCredito
      WHERE idCredito = @idCreditoSync AND idEmpresa = @idEmpresaSync
    `);
  const abiertas = Number(r.recordset[0]?.abiertas) || 0;
  const saldo = Number(r.recordset[0]?.saldo) || 0;
  if (abiertas === 0 || saldo <= 0.009) {
    try {
      await transaction.request()
        .input("idCreditoDone", sql.UniqueIdentifier, idCredito)
        .query(`
          UPDATE CreditosClientes
          SET estado = 'COMPLETADO'
          WHERE idCredito = @idCreditoDone AND estado = 'ACTIVO'
        `);
    } catch (errEstado) {
      console.error("contexto: sincronizarEstadoCredito", errEstado.message || errEstado);
    }
  }
}

const resumenCreditosDefault = () => ({
  totalCreditos: 0,
  montoTotalCreditos: 0,
  creditosActivos: 0,
  montoCreditosActivos: 0,
  totalCuotas: 0,
  cuotasPagadas: 0,
  cuotasVencidas: 0,
  cuotasPendientes: 0,
  totalCobrado: 0,
  saldoPendienteTotal: 0,
  tasaInteresPromedio: 0,
  totalMontoOtorgado: 0,
  totalSaldoPendiente: 0,
  totalPagado: 0,
  tasaCobro: 0,
  eficienciaCobro: 0
});

exports.obtenerResumenCreditosRepo = async (pool, idEmpresas) => {
  const ids = normalizarIdsEmpresaCreditos(idEmpresas);
  if (ids.length === 0) return resumenCreditosDefault();
  try {
    const request = pool.request();
    ids.forEach((id, i) => request.input(`e${i}`, sql.UniqueIdentifier, id));
    const whereEmp =
      ids.length === 1 ? "cc.idEmpresa = @e0" : `cc.idEmpresa IN (${ids.map((_, i) => `@e${i}`).join(", ")})`;
    const cab = await request.query(`
        SELECT
          COUNT(*) AS totalCreditos,
          ISNULL(SUM(cc.montoTotal), 0) AS montoTotalCreditos,
          COUNT(CASE WHEN cc.estado = 'ACTIVO' THEN 1 END) AS creditosActivos,
          ISNULL(SUM(CASE WHEN cc.estado = 'ACTIVO' THEN cc.montoTotal ELSE 0 END), 0) AS montoCreditosActivos,
          ISNULL(AVG(cc.tasaInteres), 0) AS tasaInteresPromedio
        FROM CreditosClientes cc
        WHERE ${whereEmp}
      `);

    const reqCuotas = pool.request();
    ids.forEach((id, i) => reqCuotas.input(`e${i}`, sql.UniqueIdentifier, id));
    const cuotas = await reqCuotas.query(`
        SELECT
          COUNT(*) AS totalCuotas,
          COUNT(CASE WHEN cu.estado = 'PAGADO' THEN 1 END) AS cuotasPagadas,
          COUNT(CASE WHEN cu.estado = 'VENCIDO' THEN 1 END) AS cuotasVencidas,
          COUNT(CASE WHEN cu.estado IN ('PENDIENTE', 'PARCIAL') THEN 1 END) AS cuotasPendientes,
          ISNULL(SUM(cu.saldoPendiente), 0) AS saldoPendienteTotal
        FROM CuotasCredito cu
        INNER JOIN CreditosClientes cc ON cc.idCredito = cu.idCredito
        WHERE ${whereEmp}
      `);

    const reqPagos = pool.request();
    ids.forEach((id, i) => reqPagos.input(`e${i}`, sql.UniqueIdentifier, id));
    let cobrado = 0;
    try {
      const pagos = await reqPagos.query(`
          SELECT ISNULL(SUM(pc.montoPagado), 0) AS totalCobrado
          FROM PagosCuotas pc
          INNER JOIN CuotasCredito cu ON cu.idCuota = pc.idCuota
          INNER JOIN CreditosClientes cc ON cc.idCredito = cu.idCredito
          WHERE ${whereEmp}
        `);
      cobrado = Number(pagos.recordset[0]?.totalCobrado) || 0;
    } catch (errPagos) {
      const msg = errPagos.message || "";
      if (!/Invalid object name|PagosCuotas/.test(msg)) throw errPagos;
    }

    const row = cab.recordset[0] || {};
    const rowCuotas = cuotas.recordset[0] || {};
    const montoTotal = Number(row.montoTotalCreditos) || 0;
    const saldoTotal = Number(rowCuotas.saldoPendienteTotal) || 0;
    const tasaInteres = Number(row.tasaInteresPromedio) || 0;
    const totalCuotas = Number(rowCuotas.totalCuotas) || 0;
    const cuotasPag = Number(rowCuotas.cuotasPagadas) || 0;
    const tasaCobro = montoTotal > 0 ? (cobrado / montoTotal) * 100 : 0;
    return {
      ...resumenCreditosDefault(),
      totalCreditos: Number(row.totalCreditos) || 0,
      montoTotalCreditos: montoTotal,
      creditosActivos: Number(row.creditosActivos) || 0,
      montoCreditosActivos: Number(row.montoCreditosActivos) || 0,
      totalCuotas,
      cuotasPagadas: cuotasPag,
      cuotasVencidas: Number(rowCuotas.cuotasVencidas) || 0,
      cuotasPendientes: Number(rowCuotas.cuotasPendientes) || 0,
      totalCobrado: cobrado,
      saldoPendienteTotal: saldoTotal,
      tasaInteresPromedio: tasaInteres,
      totalMontoOtorgado: montoTotal,
      totalSaldoPendiente: saldoTotal,
      totalPagado: cobrado,
      tasaCobro,
      eficienciaCobro: tasaCobro
    };
  } catch (err) {
    const msg = err.message || '';
    const code = err.number ?? err.originalError?.number;
    if (code === 208 || /Invalid object name|CuotasCredito|CreditosClientes/.test(msg)) {
      console.error("Tablas de créditos no encontradas. Ejecute la migración create_creditos_clientes_cuotas_pagos.sql:", err.message);
      return resumenCreditosDefault();
    }
    throw err;
  }
};

exports.obtenerCuotasPendientesRepo = async (pool, idEmpresa, dias = 7) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("dias", sql.Int, dias)
    .query(`
      SELECT
        cu.idCuota,
        cu.numeroCuota,
        CONVERT(VARCHAR(10), cu.fechaVencimiento, 23) AS fechaVencimiento,
        cu.montoCuota,
        cu.saldoPendiente,
        cu.estado,
        DATEDIFF(DAY, GETDATE(), cu.fechaVencimiento) AS diasParaVencimiento,
        CASE
          WHEN DATEDIFF(DAY, GETDATE(), cu.fechaVencimiento) < 0 THEN 'VENCIDA'
          WHEN DATEDIFF(DAY, GETDATE(), cu.fechaVencimiento) <= @dias THEN 'POR_VENCER'
          ELSE 'AL_DIA'
        END AS situacion,
        c.rSocial AS cliente,
        cc.idCredito,
        uw.nombres + ' ' + uw.apellidos AS usuarioCredito
      FROM CuotasCredito cu
      INNER JOIN CreditosClientes cc ON cu.idCredito = cc.idCredito
      INNER JOIN Clientes c ON cc.idCliente = c.idCliente
      INNER JOIN UsuarioWeb uw ON cc.idUsuarioCredito = uw.idUsuario
      WHERE cu.idEmpresa = @idEmpresa
        AND cu.estado IN ('PENDIENTE', 'VENCIDO', 'PARCIAL')
        AND (
          DATEDIFF(DAY, GETDATE(), cu.fechaVencimiento) <= @dias
          OR cu.fechaVencimiento < GETDATE()
        )
      ORDER BY cu.fechaVencimiento
    `);

  return result.recordset;
};

exports.obtenerEficienciaCobrosRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        uw.nombres + ' ' + uw.apellidos AS usuario,
        COUNT(DISTINCT cc.idCredito) AS creditosOtorgados,
        COUNT(cu.idCuota) AS totalCuotas,
        COUNT(CASE WHEN cu.estado = 'PAGADO' THEN cu.idCuota END) AS cuotasPagadas,
        COUNT(CASE WHEN cu.estado = 'VENCIDO' THEN cu.idCuota END) AS cuotasVencidas,
        SUM(CASE WHEN cu.estado = 'PAGADO' THEN cu.montoCuota ELSE 0 END) AS montoCobrado,
        SUM(cu.montoCuota) AS montoTotal,
        CASE
          WHEN COUNT(cu.idCuota) > 0 THEN
            CAST(COUNT(CASE WHEN cu.estado = 'PAGADO' THEN cu.idCuota END) AS DECIMAL(10,2)) /
            COUNT(cu.idCuota) * 100
          ELSE 0
        END AS porcentajeCobranza,
        AVG(DATEDIFF(DAY, cu.fechaVencimiento,
          CASE WHEN cu.estado = 'PAGADO' THEN cu.fechaPago ELSE GETDATE() END)
        ) AS diasPromedioCobro
      FROM UsuarioWeb uw
      LEFT JOIN CreditosClientes cc ON uw.idUsuario = cc.idUsuarioCredito AND cc.idEmpresa = @idEmpresa
      LEFT JOIN CuotasCredito cu ON cc.idCredito = cu.idCredito
      WHERE uw.idEmpresa = @idEmpresa
      GROUP BY uw.idUsuario, uw.nombres, uw.apellidos
      ORDER BY porcentajeCobranza DESC
    `);

  return result.recordset;
};