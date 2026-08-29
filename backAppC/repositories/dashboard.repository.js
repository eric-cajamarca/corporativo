const sql = require("mssql");
const {
  calcularResumenFinancieroPeriodo
} = require("../utils/kpisFinancierosOperativo.util");
const { getFechaHoyLocal } = require("../utils/fechaHoraLocal.util");
const { getAhoraAppYmdHms } = require("../utils/fechaDisplay.util");

function parseFechaReferenciaLocal(fechaReferencia) {
  const raw = String(fechaReferencia || getFechaHoyLocal()).trim().slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return hoy;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

/**
 * Obtiene el resumen del dashboard principal (inicio) con datos reales de la empresa.
 * @param {object} pool - Pool de conexión
 * @param {string} idEmpresa - UUID de la empresa
 * @param {string} fechaInicio - Fecha inicio período (YYYY-MM-DD)
 * @param {string} fechaFin - Fecha fin período (YYYY-MM-DD)
 * @param {string} fechaInicioAnterior - Fecha inicio período anterior (para variaciones)
 * @param {string} fechaFinAnterior - Fecha fin período anterior
 * @param {object} configInventario - { stockMinimoGeneral, stockMaximoGeneral, controlVencimiento }
 */
exports.obtenerResumenDashboardRepo = async (
  pool,
  idEmpresa,
  fechaInicio,
  fechaFin,
  fechaInicioAnterior,
  fechaFinAnterior,
  configInventario = {},
  fechaReferencia
) => {
  const fechaRef = String(fechaReferencia || getFechaHoyLocal()).trim().slice(0, 10);
  const refHoy = parseFechaReferenciaLocal(fechaRef);
  const stockMinimoGeneral = configInventario.stockMinimoGeneral != null ? Number(configInventario.stockMinimoGeneral) : 10;
  const controlVencimiento = configInventario.controlVencimiento !== false;
  const req = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaInicio", sql.Date, fechaInicio)
    .input("fechaFin", sql.Date, fechaFin)
    .input("fechaInicioAnterior", sql.Date, fechaInicioAnterior)
    .input("fechaFinAnterior", sql.Date, fechaFinAnterior);

  // Ventas totales del período actual
  const ventasActualPromise = req.query(`
    SELECT ISNULL(SUM(
      CASE
        WHEN UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('F7','B7','07') THEN -ABS(v.total)
        ELSE v.total
      END
    ), 0) AS total
    FROM Ventas v
    LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
    WHERE v.idEmpresa = @idEmpresa
      AND ISNULL(v.eliminado, 0) = 0
      AND CONVERT(DATE, v.fEmision) >= @fechaInicio
      AND CONVERT(DATE, v.fEmision) <= @fechaFin
  `);

  // Ventas totales del período anterior (para variación %)
  const ventasAnteriorPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaInicioAnterior", sql.Date, fechaInicioAnterior)
    .input("fechaFinAnterior", sql.Date, fechaFinAnterior)
    .query(`
    SELECT ISNULL(SUM(
      CASE
        WHEN UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('F7','B7','07') THEN -ABS(v.total)
        ELSE v.total
      END
    ), 0) AS total
    FROM Ventas v
    LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
    WHERE v.idEmpresa = @idEmpresa
      AND ISNULL(v.eliminado, 0) = 0
      AND CONVERT(DATE, v.fEmision) >= @fechaInicioAnterior
      AND CONVERT(DATE, v.fEmision) <= @fechaFinAnterior
  `);

  // Clientes activos (total en la empresa, no solo del período)
  const clientesResultPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
    SELECT COUNT(*) AS total
    FROM Clientes
    WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
  `);

  // Clientes que compraron en período anterior (para variación aproximada: nuevos vs anteriores)
  const clientesAnteriorPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaInicioAnterior", sql.Date, fechaInicioAnterior)
    .input("fechaFinAnterior", sql.Date, fechaFinAnterior)
    .query(`
    SELECT COUNT(DISTINCT v.idCliente) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND CONVERT(DATE, v.fEmision) >= @fechaInicioAnterior
      AND CONVERT(DATE, v.fEmision) <= @fechaFinAnterior
  `);

  const clientesActualPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaInicio", sql.Date, fechaInicio)
    .input("fechaFin", sql.Date, fechaFin)
    .query(`
    SELECT COUNT(DISTINCT v.idCliente) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND CONVERT(DATE, v.fEmision) >= @fechaInicio
      AND CONVERT(DATE, v.fEmision) <= @fechaFin
  `);

  // Productos más vendidos (período actual)
  const productosMasVendidosPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaInicio", sql.Date, fechaInicio)
    .input("fechaFin", sql.Date, fechaFin)
    .query(`
    SELECT TOP 5
      p.descripcion AS nombre,
      ISNULL(c.nombre, 'Sin categoría') AS categoria,
      SUM(dv.cantidad) AS ventas,
      SUM(ISNULL(dv.total, dv.subtotal)) AS monto
    FROM DetalleVenta dv
    INNER JOIN Ventas v ON dv.idVenta = v.idVenta AND v.idEmpresa = @idEmpresa
    INNER JOIN Productos p ON dv.idProducto = p.idProducto AND p.idEmpresa = @idEmpresa
    LEFT JOIN Categorias c ON p.idCategoria = c.idCategoria AND c.idEmpresa = @idEmpresa
    WHERE CONVERT(DATE, v.fEmision) >= @fechaInicio
      AND CONVERT(DATE, v.fEmision) <= @fechaFin
    GROUP BY p.idProducto, p.descripcion, c.nombre
    ORDER BY SUM(ISNULL(dv.total, dv.subtotal)) DESC
  `);

  // Ventas por hora del día actual (para vista "Por día" - leyenda Hora)
  const ventasPorHoraPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaReferencia", sql.Date, fechaRef)
    .query(`
    SELECT
      DATEPART(HOUR, v.fEmision) AS hora,
      ISNULL(SUM(v.total), 0) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND CONVERT(DATE, v.fEmision) = @fechaReferencia
    GROUP BY DATEPART(HOUR, v.fEmision)
    ORDER BY hora
  `);

  // Ventas del mes actual por día (para vista "Mes" - leyenda Por día)
  const ventasMesPorDiaPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaReferencia", sql.Date, fechaRef)
    .query(`
    SELECT
      DAY(v.fEmision) AS dia,
      ISNULL(SUM(v.total), 0) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND YEAR(v.fEmision) = YEAR(@fechaReferencia)
      AND MONTH(v.fEmision) = MONTH(@fechaReferencia)
    GROUP BY DAY(v.fEmision)
    ORDER BY dia
  `);

  // Ventas por mes (últimos 6 meses)
  const ventas6MesesPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaReferencia", sql.Date, fechaRef)
    .query(`
    SELECT
      YEAR(v.fEmision) AS anio,
      MONTH(v.fEmision) AS mes,
      ISNULL(SUM(v.total), 0) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND v.fEmision >= DATEADD(MONTH, -6, @fechaReferencia)
    GROUP BY YEAR(v.fEmision), MONTH(v.fEmision)
    ORDER BY anio, mes
  `);

  // Ventas por mes (últimos 12 meses)
  const ventasMensualesPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaReferencia", sql.Date, fechaRef)
    .query(`
    SELECT
      YEAR(v.fEmision) AS anio,
      MONTH(v.fEmision) AS mes,
      ISNULL(SUM(v.total), 0) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND v.fEmision >= DATEADD(MONTH, -12, @fechaReferencia)
    GROUP BY YEAR(v.fEmision), MONTH(v.fEmision)
    ORDER BY anio, mes
  `);

  // Alertas: stock bajo (umbral = alertaMinimo del producto, o stockMinimoGeneral si el producto no tiene)
  const stockBajoPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("stockMinimoGeneral", sql.Decimal(18, 2), stockMinimoGeneral)
    .query(`
    SELECT
      p.descripcion AS nombreProducto,
      SUM(l.cantidadDisponible) AS cantidadDisponible
    FROM Lotes l
    INNER JOIN Productos p ON l.idProducto = p.idProducto AND p.idEmpresa = l.idEmpresa
    WHERE l.idEmpresa = @idEmpresa
    GROUP BY l.idEmpresa, l.idProducto, p.descripcion, p.alertaMinimo
    HAVING SUM(l.cantidadDisponible) < COALESCE(NULLIF(ISNULL(p.alertaMinimo, 0), 0), @stockMinimoGeneral)
       AND SUM(l.cantidadDisponible) >= 0
  `);

  const [
    ventasActual,
    ventasAnterior,
    clientesResult,
    clientesAnterior,
    clientesActual,
    productosMasVendidos,
    ventasPorHora,
    ventasMesPorDia,
    ventas6Meses,
    ventasMensuales,
    stockBajo
  ] = await Promise.all([
    ventasActualPromise,
    ventasAnteriorPromise,
    clientesResultPromise,
    clientesAnteriorPromise,
    clientesActualPromise,
    productosMasVendidosPromise,
    ventasPorHoraPromise,
    ventasMesPorDiaPromise,
    ventas6MesesPromise,
    ventasMensualesPromise,
    stockBajoPromise
  ]);

  // Alertas: cuotas pendientes/vencidas (opcional: si no existe tabla CuotasCredito no se rompe el dashboard)
  let creditosPendientes = { recordset: [] };
  try {
    creditosPendientes = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
      SELECT TOP 5
        c.rSocial AS cliente,
        v.serie + '-' + v.numero AS comprobante,
        cu.saldoPendiente AS monto,
        cu.fechaVencimiento
      FROM CuotasCredito cu
      INNER JOIN CreditosClientes cc ON cu.idCredito = cc.idCredito
      INNER JOIN Clientes c ON cc.idCliente = c.idCliente AND c.idEmpresa = cc.idEmpresa
      LEFT JOIN Ventas v ON cc.idVenta = v.idVenta AND v.idEmpresa = cc.idEmpresa
      WHERE cu.idEmpresa = @idEmpresa
        AND cu.estado IN ('PENDIENTE', 'VENCIDO')
        AND cu.saldoPendiente > 0
        AND ISNULL(cc.estado, '') = 'ACTIVO'
        AND (v.idVenta IS NULL OR ISNULL(v.eliminado, 0) = 0)
      ORDER BY cu.fechaVencimiento ASC
    `);
  } catch (err) {
    if (err.number !== 208) throw err;
    // 208 = Invalid object name (tabla CuotasCredito no existe)
  }

  const toNum = (val) => (val != null && typeof val === "number" ? val : parseFloat(val) || 0);
  const row = (rs) => (rs && rs.recordset && rs.recordset[0] ? rs.recordset[0] : {});
  const getTotal = (r) => toNum(r.total ?? r.Total);
  const ventasTotales = getTotal(row(ventasActual));
  const ventasTotalesAnterior = getTotal(row(ventasAnterior));
  const ventasVariacion =
    ventasTotalesAnterior > 0
      ? ((ventasTotales - ventasTotalesAnterior) / ventasTotalesAnterior) * 100
      : (ventasTotales > 0 ? 100 : 0);

  const clientesActivos = Number(clientesResult.recordset[0]?.total || 0);
  const clientesActualCount = Number(clientesActual.recordset[0]?.total || 0);
  const clientesAnteriorCount = Number(clientesAnterior.recordset[0]?.total || 0);
  const clientesVariacion =
    clientesAnteriorCount > 0
      ? ((clientesActualCount - clientesAnteriorCount) / clientesAnteriorCount) * 100
      : (clientesActualCount > 0 ? 100 : 0);

  const kpisFin = await calcularResumenFinancieroPeriodo(
    pool,
    idEmpresa,
    fechaInicio,
    fechaFin,
    { fechaInicioAnterior, fechaFinAnterior }
  );
  const ingresos = kpisFin.ingresos;
  const costos = kpisFin.costos;
  const utilidadBruta = kpisFin.utilidadBruta;
  const gastosOperativos = kpisFin.gastosOperativos;
  const utilidadNeta = kpisFin.utilidadNeta;
  const utilidadVariacion = kpisFin.utilidadVariacion;
  const roi = kpisFin.roiPctVentas;

  const alertas = [];
  stockBajo.recordset.forEach((r) => {
    alertas.push({
      titulo: "Stock Bajo",
      mensaje: `${r.nombreProducto} tiene ${Math.round(Number(r.cantidadDisponible))} unidades`,
      icono: "fa-exclamation-triangle",
      tipo: "warning",
      tiempo: getAhoraAppYmdHms()
    });
  });
  creditosPendientes.recordset.forEach((r) => {
    const fechaVenc = r.fechaVencimiento ? new Date(r.fechaVencimiento) : null;
    const dias = fechaVenc ? Math.ceil((fechaVenc - refHoy) / (1000 * 60 * 60 * 24)) : 0;
    const texto =
      dias < 0 ? "Vencida" : dias === 0 ? "Vence hoy" : `Vence en ${dias} días`;
    alertas.push({
      titulo: "Pago Pendiente",
      mensaje: `${r.cliente} - ${r.comprobante || "N/C"} - S/ ${Number(r.monto || 0).toFixed(2)} - ${texto}`,
      icono: "fa-clock",
      tipo: "info",
      tiempo: getAhoraAppYmdHms()
    });
  });

  if (controlVencimiento) {
    let lotesProximosVencer = { recordset: [] };
    try {
      lotesProximosVencer = await pool
        .request()
        .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
        .input("fechaReferencia", sql.Date, fechaRef)
        .query(`
        SELECT TOP 10
          p.descripcion AS nombreProducto,
          l.fechaVencimiento,
          l.cantidadDisponible
        FROM Lotes l
        INNER JOIN Productos p ON l.idProducto = p.idProducto AND p.idEmpresa = l.idEmpresa
        WHERE l.idEmpresa = @idEmpresa
          AND l.fechaVencimiento IS NOT NULL
          AND (l.fechaVencimiento <= DATEADD(DAY, 30, @fechaReferencia))
        ORDER BY l.fechaVencimiento ASC
        `);
    } catch (err) {
      // Si la columna no existe en Lotes, ignorar
    }
    (lotesProximosVencer.recordset || []).forEach((r) => {
      const fechaVenc = r.fechaVencimiento ? new Date(r.fechaVencimiento) : null;
      const dias = fechaVenc ? Math.ceil((fechaVenc - refHoy) / (1000 * 60 * 60 * 24)) : 0;
      const texto = dias < 0 ? "Vencido" : dias === 0 ? "Vence hoy" : `Vence en ${dias} días`;
      alertas.push({
        titulo: "Producto próximo a vencer",
        mensaje: `${r.nombreProducto} - ${Math.round(Number(r.cantidadDisponible || 0))} uds. - ${texto}`,
        icono: "fa-calendar-times",
        tipo: "warning",
        tiempo: getAhoraAppYmdHms()
      });
    });
  }

  // Construir array de 12 meses para el gráfico (meses con 0 si no hay ventas) y etiquetas
  const mesesMap = {};
  const mesesLabels = [];
  const nombresMes = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const now = refHoy;
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    mesesMap[key] = { anio: d.getFullYear(), mes: d.getMonth() + 1, total: 0 };
    mesesLabels.push(nombresMes[d.getMonth()] + " " + String(d.getFullYear()).slice(2));
  }
  ventasMensuales.recordset.forEach((r) => {
    const key = `${r.anio}-${String(r.mes).padStart(2, "0")}`;
    if (mesesMap[key] !== undefined) {
      mesesMap[key].total = Number(r.total || 0);
    }
  });
  const ventasPorMes = Object.keys(mesesMap)
    .sort()
    .map((k) => mesesMap[k].total);

  // Gráfico por hora del día (24 horas) - leyenda "Hora"
  const horaMap = {};
  for (let h = 0; h < 24; h++) horaMap[h] = 0;
  ventasPorHora.recordset.forEach((r) => {
    const h = parseInt(r.hora, 10);
    if (h >= 0 && h < 24) horaMap[h] = Number(r.total || 0);
  });
  const graficoPorDiaHora = {
    etiquetas: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0") + "h"),
    datos: Array.from({ length: 24 }, (_, i) => horaMap[i]),
    leyenda: "Hora"
  };

  // Gráfico mes actual por día - leyenda "Por día"
  const diasEnMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const diaMap = {};
  for (let d = 1; d <= diasEnMes; d++) diaMap[d] = 0;
  ventasMesPorDia.recordset.forEach((r) => {
    const d = parseInt(r.dia, 10);
    if (d >= 1 && d <= diasEnMes) diaMap[d] = Number(r.total || 0);
  });
  const graficoMesPorDia = {
    etiquetas: Array.from({ length: diasEnMes }, (_, i) => "Día " + (i + 1)),
    datos: Array.from({ length: diasEnMes }, (_, i) => diaMap[i + 1]),
    leyenda: "Por día"
  };

  // Gráfico 6 meses - leyenda "Por mes"
  const meses6Map = {};
  const meses6Labels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    meses6Map[key] = 0;
    meses6Labels.push(nombresMes[d.getMonth()] + " " + String(d.getFullYear()).slice(2));
  }
  ventas6Meses.recordset.forEach((r) => {
    const key = `${r.anio}-${String(r.mes).padStart(2, "0")}`;
    if (meses6Map[key] !== undefined) meses6Map[key] = Number(r.total || 0);
  });
  const graficoSeisMeses = {
    etiquetas: meses6Labels,
    datos: Object.keys(meses6Map).sort().map((k) => meses6Map[k]),
    leyenda: "Por mes"
  };

  // Gráfico 12 meses - leyenda "Por mes"
  const graficoDoceMeses = {
    etiquetas: mesesLabels,
    datos: ventasPorMes,
    leyenda: "Por mes"
  };

  return {
    ventasTotales: Number(ventasTotales),
    ventasVariacion: Number(ventasVariacion),
    utilidadNeta: Number(utilidadNeta),
    utilidadVariacion: Number(utilidadVariacion),
    clientesActivos: Number(clientesActivos),
    clientesVariacion: Number(clientesVariacion),
    roi: Number(roi),
    ingresos: Number(ingresos),
    costos: Number(costos),
    utilidadBruta: Number(utilidadBruta),
    gastosOperativos: Number(gastosOperativos),
    productosMasVendidos: (productosMasVendidos.recordset || []).map((r) => ({
      nombre: r.nombre,
      categoria: r.categoria,
      ventas: Number(r.ventas || 0),
      monto: Number(r.monto || 0)
    })),
    ventasMensuales: ventasPorMes,
    ventasMensualesLabels: mesesLabels,
    graficoVentas: {
      porDiaHora: graficoPorDiaHora,
      mesPorDia: graficoMesPorDia,
      seisMeses: graficoSeisMeses,
      doceMeses: graficoDoceMeses
    },
    alertas
  };
};

function addDaysYmd(ymd, days) {
  const m = String(ymd || "").trim().slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Resumen operativo del día para el dueño del negocio (sin IA).
 * @param {object} pool
 * @param {string} idEmpresa
 * @param {string} fechaReferencia - YYYY-MM-DD
 */
exports.obtenerResumenDiarioRepo = async (pool, idEmpresa, fechaReferencia) => {
  const fecha = String(fechaReferencia || getFechaHoyLocal()).trim().slice(0, 10);
  const fechaAyer = addDaysYmd(fecha, -1);
  const fechaManana = addDaysYmd(fecha, 1);
  const toNum = (val) => (val != null && typeof val === "number" ? val : parseFloat(val) || 0);

  const baseReq = () =>
    pool.request().input("idEmpresa", sql.UniqueIdentifier, idEmpresa).input("fecha", sql.Date, fecha);

  const ventasTotalesPromise = baseReq().query(`
    SELECT ISNULL(SUM(
      CASE
        WHEN UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('F7','B7','07') THEN -ABS(v.total)
        ELSE v.total
      END
    ), 0) AS total
    FROM Ventas v
    LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
    WHERE v.idEmpresa = @idEmpresa
      AND ISNULL(v.eliminado, 0) = 0
      AND CONVERT(DATE, v.fEmision) = @fecha
  `);

  const ventasAyerPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fecha", sql.Date, fechaAyer)
    .query(`
    SELECT ISNULL(SUM(
      CASE
        WHEN UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('F7','B7','07') THEN -ABS(v.total)
        ELSE v.total
      END
    ), 0) AS total
    FROM Ventas v
    LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
    WHERE v.idEmpresa = @idEmpresa
      AND ISNULL(v.eliminado, 0) = 0
      AND CONVERT(DATE, v.fEmision) = @fecha
  `);

  /** Forma de pago igual que arqueo de caja: MovimientosCaja + FormasPago (prioridad) + MediosPago. */
  const pagosPorMedioPromise = baseReq().query(`
    SELECT
      ISNULL(
        NULLIF(LTRIM(RTRIM(fp.descripcion)), ''),
        ISNULL(NULLIF(LTRIM(RTRIM(mp.descripcion)), ''), 'Sin especificar')
      ) AS medio,
      ISNULL(SUM(mc.monto), 0) AS monto
    FROM MovimientosCaja mc
    INNER JOIN Ventas v ON v.idVenta = mc.idVenta
    INNER JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa AND ISNULL(c.codigo, '') <> 'CT'
    LEFT JOIN FormasPago fp ON fp.idFormaPago = mc.idMediosPago
    LEFT JOIN MediosPago mp ON mp.idMediosPago = mc.idMediosPago
    WHERE mc.idEmpresa = @idEmpresa
      AND v.idEmpresa = @idEmpresa
      AND ISNULL(mc.eliminado, 0) = 0
      AND mc.idVenta IS NOT NULL
      AND CONVERT(DATE, v.fEmision) = @fecha
    GROUP BY fp.descripcion, mp.descripcion
  `).catch(() => null);

  const ventasCreditoPromise = baseReq().query(`
    SELECT ISNULL(SUM(cc.montoTotal), 0) AS total
    FROM CreditosClientes cc
    WHERE cc.idEmpresa = @idEmpresa
      AND CONVERT(DATE, cc.fechaCredito) = @fecha
      AND UPPER(LTRIM(RTRIM(ISNULL(cc.estado, '')))) <> 'CANCELADO'
  `).catch(() => ({ recordset: [{ total: 0 }] }));

  const cobranzasDiaPromise = baseReq().query(`
    SELECT ISNULL(SUM(pc.montoPagado), 0) AS total
    FROM PagosCuotas pc
    WHERE pc.idEmpresa = @idEmpresa
      AND CONVERT(DATE, pc.fechaPago) = @fecha
  `).catch(() => ({ recordset: [{ total: 0 }] }));

  const porCobrarPromise = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
    SELECT ISNULL(SUM(cu.saldoPendiente), 0) AS total
    FROM CuotasCredito cu
    WHERE cu.idEmpresa = @idEmpresa
      AND cu.estado IN ('PENDIENTE', 'VENCIDO')
      AND cu.saldoPendiente > 0
  `).catch(() => ({ recordset: [{ total: 0 }] }));

  const comprasDiaPromise = baseReq().query(`
    SELECT ISNULL(SUM(c.total), 0) AS total
    FROM Compras c
    WHERE c.idEmpresa = @idEmpresa
      AND CONVERT(DATE, c.fEmision) = @fecha
  `).catch(() => ({ recordset: [{ total: 0 }] }));

  const [
    ventasTotalesRs,
    ventasAyerRs,
    pagosPorMedioRs,
    ventasCreditoRs,
    cobranzasDiaRs,
    porCobrarRs,
    comprasDiaRs
  ] = await Promise.all([
    ventasTotalesPromise,
    ventasAyerPromise,
    pagosPorMedioPromise,
    ventasCreditoPromise,
    cobranzasDiaPromise,
    porCobrarPromise,
    comprasDiaPromise
  ]);

  const ventasTotales = toNum(ventasTotalesRs.recordset?.[0]?.total);
  const ventasAyer = toNum(ventasAyerRs.recordset?.[0]?.total);
  const ventasCredito = toNum(ventasCreditoRs.recordset?.[0]?.total);
  const cobranzasDia = toNum(cobranzasDiaRs.recordset?.[0]?.total);
  const porCobrarTotal = toNum(porCobrarRs.recordset?.[0]?.total);
  const comprasDia = toNum(comprasDiaRs.recordset?.[0]?.total);

  const ventasVariacionPct =
    ventasAyer > 0 ? ((ventasTotales - ventasAyer) / ventasAyer) * 100 : (ventasTotales > 0 ? 100 : 0);

  const mapMedios = new Map();
  let pagosRows = pagosPorMedioRs?.recordset || [];
  if (!pagosPorMedioRs || pagosRows.length === 0) {
    try {
      const fallback = await baseReq().query(`
        SELECT
          ISNULL(
            NULLIF(LTRIM(RTRIM(fp.descripcion)), ''),
            ISNULL(NULLIF(LTRIM(RTRIM(mp.descripcion)), ''), 'Sin especificar')
          ) AS medio,
          ISNULL(SUM(dpv.monto), 0) AS monto
        FROM DetallePagoVenta dpv
        INNER JOIN Ventas v ON v.idVenta = dpv.idVenta AND v.idEmpresa = @idEmpresa
        LEFT JOIN FormasPago fp ON fp.idFormaPago = dpv.idMediosPago
        LEFT JOIN MediosPago mp ON mp.idMediosPago = dpv.idMediosPago
        WHERE v.idEmpresa = @idEmpresa
          AND ISNULL(v.eliminado, 0) = 0
          AND CONVERT(DATE, v.fEmision) = @fecha
        GROUP BY fp.descripcion, mp.descripcion

        UNION ALL

        SELECT
          ISNULL(
            NULLIF(LTRIM(RTRIM(fp.descripcion)), ''),
            ISNULL(NULLIF(LTRIM(RTRIM(mp.descripcion)), ''), 'Sin especificar')
          ) AS medio,
          ISNULL(SUM(v.total), 0) AS monto
        FROM Ventas v
        LEFT JOIN FormasPago fp ON fp.idFormaPago = TRY_CAST(v.idMediosPago AS INT)
        LEFT JOIN MediosPago mp ON mp.idMediosPago = TRY_CAST(v.idMediosPago AS INT)
        WHERE v.idEmpresa = @idEmpresa
          AND ISNULL(v.eliminado, 0) = 0
          AND CONVERT(DATE, v.fEmision) = @fecha
          AND NOT EXISTS (SELECT 1 FROM DetallePagoVenta dpv2 WHERE dpv2.idVenta = v.idVenta)
        GROUP BY fp.descripcion, mp.descripcion
      `);
      pagosRows = fallback.recordset || [];
    } catch (_) {
      pagosRows = [];
    }
  }
  pagosRows.forEach((r) => {
    const medio = String(r.medio || "Sin especificar").trim();
    mapMedios.set(medio, (mapMedios.get(medio) || 0) + toNum(r.monto));
  });
  const ventasPorMedioPago = Array.from(mapMedios.entries())
    .map(([medio, monto]) => ({ medio, monto: Number(monto) }))
    .filter((x) => x.monto > 0)
    .sort((a, b) => b.monto - a.monto);

  let kpisFin = { utilidadNeta: 0, ingresos: 0, costos: 0, utilidadBruta: 0, gastosOperativos: 0 };
  try {
    kpisFin = await calcularResumenFinancieroPeriodo(pool, idEmpresa, fecha, fecha, {
      fechaInicioAnterior: fechaAyer,
      fechaFinAnterior: fechaAyer
    });
  } catch (_) {}

  let enviosManana = [];
  try {
    const envRs = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .input("fechaManana", sql.Date, fechaManana)
      .query(`
      SELECT TOP 15
        e.idEnvio,
        ISNULL(c.rSocial, ISNULL(e.contactoDestinatario, 'Cliente')) AS cliente,
        ISNULL(e.direccionEntrega, '') AS direccion,
        CONVERT(VARCHAR(19), ISNULL(e.fechaProgramada, e.fechaSolicitud), 120) AS fechaProgramada,
        ISNULL(ee.descripcion, 'Programado') AS estado
      FROM Envios e
      LEFT JOIN Clientes c ON c.idCliente = e.idCliente AND c.idEmpresa = e.idEmpresa
      LEFT JOIN EstadosEnvio ee ON ee.idEstadoEnvio = e.idEstadoEnvio
      WHERE e.idEmpresa = @idEmpresa
        AND CONVERT(DATE, ISNULL(e.fechaProgramada, e.fechaSolicitud)) = @fechaManana
        AND ISNULL(e.idEstadoEnvio, 0) NOT IN (4, 5)
      ORDER BY ISNULL(e.fechaProgramada, e.fechaSolicitud)
    `);
    enviosManana = (envRs.recordset || []).map((r) => ({
      idEnvio: r.idEnvio,
      cliente: r.cliente,
      direccion: r.direccion,
      fechaProgramada: r.fechaProgramada,
      estado: r.estado
    }));
  } catch (_) {}

  return {
    fecha,
    ventasTotales: Number(ventasTotales),
    ventasAyer: Number(ventasAyer),
    ventasVariacionPct: Number(ventasVariacionPct),
    ventasPorMedioPago,
    ventasAlCredito: Number(ventasCredito),
    cobranzasDia: Number(cobranzasDia),
    porCobrarTotal: Number(porCobrarTotal),
    comprasDia: Number(comprasDia),
    utilidadDia: Number(kpisFin.utilidadNeta || 0),
    ingresosDia: Number(kpisFin.ingresos || ventasTotales),
    enviosManana,
    mensajeResumen: buildMensajeResumenDiario({
      fecha,
      ventasTotales,
      ventasPorMedioPago,
      ventasAlCredito: ventasCredito,
      cobranzasDia,
      porCobrarTotal,
      comprasDia,
      utilidadDia: kpisFin.utilidadNeta || 0,
      ventasVariacionPct,
      enviosManana
    })
  };
};

function buildMensajeResumenDiario(d) {
  const fmt = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
  const lineas = [`Hoy vendiste ${fmt(d.ventasTotales)}.`];
  if (d.ventasPorMedioPago?.length) {
    d.ventasPorMedioPago.slice(0, 6).forEach((p) => {
      lineas.push(`${p.medio}: ${fmt(p.monto)}`);
    });
  }
  if (Number(d.ventasAlCredito) > 0) {
    lineas.push(`Al crédito (nuevos): ${fmt(d.ventasAlCredito)}`);
  }
  if (Number(d.cobranzasDia) > 0) {
    lineas.push(`Cobranzas del día: ${fmt(d.cobranzasDia)}`);
  }
  if (Number(d.porCobrarTotal) > 0) {
    lineas.push(`Por cobrar (total): ${fmt(d.porCobrarTotal)}`);
  }
  if (Number(d.comprasDia) > 0) {
    lineas.push(`Compras: ${fmt(d.comprasDia)}`);
  }
  lineas.push(`Utilidad del día: ${fmt(d.utilidadDia)}`);
  const varPct = Number(d.ventasVariacionPct || 0);
  if (varPct !== 0) {
    lineas.push(`vs. ayer: ${varPct >= 0 ? "+" : ""}${varPct.toFixed(1)}% en ventas`);
  }
  if (Array.isArray(d.enviosManana) && d.enviosManana.length > 0) {
    lineas.push(`Envíos programados para mañana: ${d.enviosManana.length}`);
  }
  return lineas.join(" · ");
}
