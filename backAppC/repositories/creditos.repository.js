const sql = require("mssql");
const CajaRepository = require("./caja.repository");
const { getNowLocal, getNowLocalSQLString } = require("../utils/fechaHoraLocal.util");

function normalizarIdsEmpresaCreditos(idEmpresas) {
  const arr = Array.isArray(idEmpresas) ? idEmpresas : idEmpresas ? [idEmpresas] : [];
  return arr.map((x) => String(x).trim()).filter(Boolean);
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
        cc.fechaCredito,
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
        ISNULL(SUM(CASE WHEN cu.estado = 'PAGADO' THEN cu.montoCuota ELSE 0 END), 0) AS totalPagado,
        ISNULL(SUM(ISNULL(cu.saldoPendiente, 0)), 0) AS saldoPendiente,
        MIN(CASE WHEN cu.estado IN ('PENDIENTE', 'VENCIDO') THEN cu.fechaVencimiento END) AS proximaCuota
      FROM CreditosClientes cc
      LEFT JOIN Ventas v ON cc.idVenta = v.idVenta
      LEFT JOIN CuotasCredito cu ON cc.idCredito = cu.idCredito
      LEFT JOIN UsuarioWeb uw ON cc.idUsuarioCredito = uw.idUsuario
      WHERE ${inEmpresa}${condicionCliente}
      GROUP BY cc.idEmpresa, cc.idCredito, cc.idCliente, cc.fechaCredito, cc.montoTotal, cc.plazoDias,
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
    observaciones
  } = params;
  if (!idEmpresa || idCliente == null || !idUsuarioCredito) return null;
  const mt = Number(montoTotal);
  if (!Number.isFinite(mt) || mt <= 0) return null;
  if (!cuotas || !Array.isArray(cuotas) || cuotas.length === 0) return null;

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
    .query(`
      INSERT INTO CreditosClientes (
        idEmpresa, idCliente, idVenta, idUsuarioCredito, fechaCredito,
        montoTotal, plazoDias, tasaInteres, estado, observaciones
      )
      OUTPUT INSERTED.idCredito
      VALUES (
        @idEmpresa, @idCliente, @idVenta, @idUsuarioCredito, GETDATE(),
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
      .input("fechaVencimiento", sql.Date, fv)
      .input("montoCuota", sql.Decimal(18, 2), monto)
      .input("interes", sql.Decimal(18, 2), 0)
      .input("capital", sql.Decimal(18, 2), monto)
      .input("saldoPendiente", sql.Decimal(18, 2), monto)
      .query(`
        INSERT INTO CuotasCredito (
          idCredito, idEmpresa, numeroCuota, fechaVencimiento,
          montoCuota, interes, capital, saldoPendiente, estado
        ) VALUES (
          @idCredito, @idEmpresa, @numeroCuota, @fechaVencimiento,
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
    const fechaInicio = datos.fechaInicio || new Date();

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
      .query(`
        INSERT INTO CreditosClientes (
          idEmpresa, idCliente, idVenta, idUsuarioCredito, fechaCredito,
          montoTotal, plazoDias, tasaInteres, estado, observaciones
        )
        OUTPUT INSERTED.idCredito
        VALUES (
          @idEmpresa, @idCliente, @idVenta, @idUsuarioCredito, GETDATE(),
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

  for (let i = 1; i <= numeroCuotas; i++) {
    let fechaVencimiento;
    if (numeroCuotasOverride === 1 && fechaVencimientoUnica) {
      fechaVencimiento = new Date(fechaVencimientoUnica);
    } else {
      fechaVencimiento = new Date(fechaInicio);
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + i);
    }

    const interes = tasaMensual > 0 ? (montoTotal - (i - 1) * montoCuota) * tasaMensual : 0;
    const capital = montoCuota;
    const totalCuota = capital + interes;

    await request
      .input(`idCredito_${i}`, sql.UniqueIdentifier, idCredito)
      .input(`idEmpresa_${i}`, sql.UniqueIdentifier, idEmpresa)
      .input(`numeroCuota_${i}`, sql.Int, i)
      .input(`fechaVencimiento_${i}`, sql.Date, fechaVencimiento)
      .input(`montoCuota_${i}`, sql.Decimal(18, 2), totalCuota)
      .input(`interes_${i}`, sql.Decimal(18, 2), interes)
      .input(`capital_${i}`, sql.Decimal(18, 2), capital)
      .input(`saldoPendiente_${i}`, sql.Decimal(18, 2), totalCuota)
      .query(`
        INSERT INTO CuotasCredito (
          idCredito, idEmpresa, numeroCuota, fechaVencimiento,
          montoCuota, interes, capital, saldoPendiente, estado
        ) VALUES (
          @idCredito_${i}, @idEmpresa_${i}, @numeroCuota_${i}, @fechaVencimiento_${i},
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
        cu.fechaVencimiento,
        cu.montoCuota,
        cu.interes,
        cu.capital,
        cu.saldoPendiente,
        cu.estado,
        cu.fechaPago,
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
        AND estado IN ('PENDIENTE', 'VENCIDO')
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
        SELECT idCredito, numeroCuota, montoCuota, saldoPendiente, fechaVencimiento
        FROM CuotasCredito
        WHERE idCuota = @idCuota
      `);

    const cuota = cuotaResult.recordset[0];
    let numeroReciboCobranza = datos.numeroRecibo || null;

    if (datos.idApertura && cuota) {
      const tipoIngreso = await request.query("SELECT TOP 1 idTipoMovimientoCaja FROM TiposMovimientoCaja WHERE tipo = 'I'");
      const idTipoMovimientoCaja = tipoIngreso.recordset?.[0]?.idTipoMovimientoCaja;
      if (idTipoMovimientoCaja) {
        try {
          const { documentoRelacionado } = await CajaRepository.obtenerSiguienteNumeroReciboRepo(transaction, user.empresa, "RI");
          await CajaRepository.registrarMovimientoRepo(transaction, user, {
            idApertura: datos.idApertura,
            idTipoMovimientoCaja,
            concepto: "Cobranza crédito - Cuota " + (cuota.numeroCuota || ""),
            monto: datos.montoPagado,
            idMediosPago: datos.idMediosPago || null,
            idMoneda: datos.idMoneda || 1,
            documentoRelacionado
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
      // Pago parcial: registrar pago y generar nueva cuota (usa su propio request para no duplicar parámetros)
      await procesarPagoParcial(transaction, cuota, datos, user);
    } else {
      // Pago total: marcar cuota como pagada (request nuevo para no duplicar idCuota del SELECT inicial)
      const reqUpdate = transaction.request();
      await reqUpdate
        .input("idCuota", sql.UniqueIdentifier, datos.idCuota)
        .input("fechaPago", sql.VarChar(23), getNowLocalSQLString())
        .query(`
          UPDATE CuotasCredito
          SET estado = 'PAGADO', fechaPago = @fechaPago, saldoPendiente = 0
          WHERE idCuota = @idCuota
        `);
    }

    const idMediosPagoVal = datos.idMediosPago != null ? Number(datos.idMediosPago) : null;
    const validIdsResult = await request.query("SELECT idMediosPago FROM MediosPago");
    const validIds = new Set((validIdsResult.recordset || []).map((r) => Number(r.idMediosPago)).filter((n) => !Number.isNaN(n)));
    const idMediosPagoFinal = idMediosPagoVal != null && validIds.has(idMediosPagoVal) ? idMediosPagoVal : (validIds.size ? Math.min(...validIds) : null);

    const requestPago = transaction.request();
    await requestPago
      .input("idCuota", sql.UniqueIdentifier, datos.idCuota)
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("idUsuarioPago", sql.UniqueIdentifier, user.sub)
      .input("montoPagado", sql.Decimal(18, 2), datos.montoPagado)
      .input("idMediosPago", sql.Int, idMediosPagoFinal)
      .input("idMoneda", sql.Int, datos.idMoneda || 1)
      .input("numeroRecibo", sql.VarChar, numeroReciboCobranza || datos.numeroRecibo || null)
      .input("observaciones", sql.VarChar, datos.observaciones || null)
      .query(`
        INSERT INTO PagosCuotas (
          idCuota, idEmpresa, idUsuarioPago, fechaPago, montoPagado,
          idMediosPago, idMoneda, numeroRecibo, observaciones
        ) VALUES (
          @idCuota, @idEmpresa, @idUsuarioPago, GETDATE(), @montoPagado,
          @idMediosPago, @idMoneda, @numeroRecibo, @observaciones
        )
      `);

    await transaction.commit();
    return {
      idCuota: datos.idCuota,
      montoPagado: datos.montoPagado,
      esPagoParcial,
      numeroRecibo: numeroReciboCobranza,
      mensaje: esPagoParcial ? "Pago parcial registrado, nueva cuota generada" : "Cuota pagada completamente"
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Función auxiliar para procesar pagos parciales (usa request propio para no duplicar parámetros con el request del flujo principal)
// La cuota actual se marca PAGADA (monto pagado = cancelado); solo el saldo restante genera una nueva cuota pendiente.
async function procesarPagoParcial(transaction, cuota, datos, user) {
  const req = transaction.request();
  // Marcar la cuota actual como PAGADA (el monto pagado queda cancelado; saldoPendiente en 0)
  await req
    .input("idCuota", sql.UniqueIdentifier, datos.idCuota)
    .input("fechaPago", sql.VarChar(23), getNowLocalSQLString())
    .query(`
      UPDATE CuotasCredito
      SET estado = 'PAGADO', fechaPago = @fechaPago, saldoPendiente = 0
      WHERE idCuota = @idCuota
    `);

  // Generar nueva cuota con el saldo restante (nuevo request para no reutilizar idCuota ni otros params)
  const reqNueva = transaction.request();
  const nuevaFechaVencimiento = new Date(cuota.fechaVencimiento);
  nuevaFechaVencimiento.setMonth(nuevaFechaVencimiento.getMonth() + 1); // Próximo mes

  await reqNueva
    .input("idCredito", sql.UniqueIdentifier, cuota.idCredito)
    .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
    .input("numeroCuota", sql.Int, cuota.numeroCuota + 1)
    .input("fechaVencimiento", sql.Date, nuevaFechaVencimiento)
    .input("montoCuota", sql.Decimal(18, 2), cuota.saldoPendiente - datos.montoPagado)
    .input("saldoPendiente", sql.Decimal(18, 2), cuota.saldoPendiente - datos.montoPagado)
    .query(`
      INSERT INTO CuotasCredito (
        idCredito, idEmpresa, numeroCuota, fechaVencimiento,
        montoCuota, interes, capital, saldoPendiente, estado
      ) VALUES (
        @idCredito, @idEmpresa, @numeroCuota, @fechaVencimiento,
        @montoCuota, 0, @montoCuota, @saldoPendiente, 'PENDIENTE'
      )
    `);
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
    const result = await request.query(`
        SELECT
          COUNT(DISTINCT cc.idCredito) AS totalCreditos,
          SUM(cc.montoTotal) AS montoTotalCreditos,
          COUNT(DISTINCT CASE WHEN cc.estado = 'ACTIVO' THEN cc.idCredito END) AS creditosActivos,
          SUM(CASE WHEN cc.estado = 'ACTIVO' THEN cc.montoTotal ELSE 0 END) AS montoCreditosActivos,
          COUNT(cu.idCuota) AS totalCuotas,
          COUNT(CASE WHEN cu.estado = 'PAGADO' THEN cu.idCuota END) AS cuotasPagadas,
          COUNT(CASE WHEN cu.estado = 'VENCIDO' THEN cu.idCuota END) AS cuotasVencidas,
          COUNT(CASE WHEN cu.estado = 'PENDIENTE' THEN cu.idCuota END) AS cuotasPendientes,
          SUM(CASE WHEN cu.estado = 'PAGADO' THEN cu.montoCuota ELSE 0 END) AS totalCobrado,
          SUM(cu.saldoPendiente) AS saldoPendienteTotal,
          AVG(cc.tasaInteres) AS tasaInteresPromedio
        FROM CreditosClientes cc
        LEFT JOIN CuotasCredito cu ON cc.idCredito = cu.idCredito
        WHERE ${whereEmp}
      `);

    const row = result.recordset[0] || {};
    const montoTotal = Number(row.montoTotalCreditos) ?? 0;
    const saldoTotal = Number(row.saldoPendienteTotal) ?? 0;
    const cobrado = Number(row.totalCobrado) ?? 0;
    const tasa = Number(row.tasaInteresPromedio) ?? 0;
    const totalCuotas = Number(row.totalCuotas) || 0;
    const cuotasPag = Number(row.cuotasPagadas) || 0;
    return {
      ...resumenCreditosDefault(),
      ...row,
      montoTotalCreditos: montoTotal,
      montoCreditosActivos: Number(row.montoCreditosActivos) ?? 0,
      totalCobrado: cobrado,
      saldoPendienteTotal: saldoTotal,
      tasaInteresPromedio: tasa,
      totalMontoOtorgado: montoTotal,
      totalSaldoPendiente: saldoTotal,
      totalPagado: cobrado,
      tasaCobro: tasa,
      eficienciaCobro: totalCuotas > 0 ? (cuotasPag / totalCuotas) * 100 : 0
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
        cu.fechaVencimiento,
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
        AND cu.estado IN ('PENDIENTE', 'VENCIDO')
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