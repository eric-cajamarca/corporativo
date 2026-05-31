const sql = require("mssql");
const {
  calcularResumenFinancieroPeriodo
} = require("../utils/kpisFinancierosOperativo.util");

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
  configInventario = {}
) => {
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
  const ventasActual = await req.query(`
    SELECT ISNULL(SUM(v.total), 0) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND CONVERT(DATE, v.fEmision) >= @fechaInicio
      AND CONVERT(DATE, v.fEmision) <= @fechaFin
  `);

  // Ventas totales del período anterior (para variación %)
  const ventasAnterior = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaInicioAnterior", sql.Date, fechaInicioAnterior)
    .input("fechaFinAnterior", sql.Date, fechaFinAnterior)
    .query(`
    SELECT ISNULL(SUM(v.total), 0) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND CONVERT(DATE, v.fEmision) >= @fechaInicioAnterior
      AND CONVERT(DATE, v.fEmision) <= @fechaFinAnterior
  `);

  // Clientes activos (total en la empresa, no solo del período)
  const clientesResult = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
    SELECT COUNT(*) AS total
    FROM Clientes
    WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
  `);

  // Clientes que compraron en período anterior (para variación aproximada: nuevos vs anteriores)
  const clientesAnterior = await pool
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

  const clientesActual = await pool
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
  const productosMasVendidos = await pool
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
  const ventasPorHora = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
    SELECT
      DATEPART(HOUR, v.fEmision) AS hora,
      ISNULL(SUM(v.total), 0) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND CONVERT(DATE, v.fEmision) = CONVERT(DATE, GETDATE())
    GROUP BY DATEPART(HOUR, v.fEmision)
    ORDER BY hora
  `);

  // Ventas del mes actual por día (para vista "Mes" - leyenda Por día)
  const ventasMesPorDia = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
    SELECT
      DAY(v.fEmision) AS dia,
      ISNULL(SUM(v.total), 0) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND YEAR(v.fEmision) = YEAR(GETDATE())
      AND MONTH(v.fEmision) = MONTH(GETDATE())
    GROUP BY DAY(v.fEmision)
    ORDER BY dia
  `);

  // Ventas por mes (últimos 6 meses)
  const ventas6Meses = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
    SELECT
      YEAR(v.fEmision) AS anio,
      MONTH(v.fEmision) AS mes,
      ISNULL(SUM(v.total), 0) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND v.fEmision >= DATEADD(MONTH, -6, GETDATE())
    GROUP BY YEAR(v.fEmision), MONTH(v.fEmision)
    ORDER BY anio, mes
  `);

  // Ventas por mes (últimos 12 meses)
  const ventasMensuales = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
    SELECT
      YEAR(v.fEmision) AS anio,
      MONTH(v.fEmision) AS mes,
      ISNULL(SUM(v.total), 0) AS total
    FROM Ventas v
    WHERE v.idEmpresa = @idEmpresa
      AND v.fEmision >= DATEADD(MONTH, -12, GETDATE())
    GROUP BY YEAR(v.fEmision), MONTH(v.fEmision)
    ORDER BY anio, mes
  `);

  // Alertas: stock bajo (umbral = alertaMinimo del producto, o stockMinimoGeneral si el producto no tiene)
  const stockBajo = await pool
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
      tiempo: "Actual"
    });
  });
  creditosPendientes.recordset.forEach((r) => {
    const fechaVenc = r.fechaVencimiento ? new Date(r.fechaVencimiento) : null;
    const dias = fechaVenc ? Math.ceil((fechaVenc - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    const texto =
      dias < 0 ? "Vencida" : dias === 0 ? "Vence hoy" : `Vence en ${dias} días`;
    alertas.push({
      titulo: "Pago Pendiente",
      mensaje: `${r.cliente} - ${r.comprobante || "N/C"} - S/ ${Number(r.monto || 0).toFixed(2)} - ${texto}`,
      icono: "fa-clock",
      tipo: "info",
      tiempo: "Actual"
    });
  });

  if (controlVencimiento) {
    let lotesProximosVencer = { recordset: [] };
    try {
      lotesProximosVencer = await pool
        .request()
        .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
        .query(`
        SELECT TOP 10
          p.descripcion AS nombreProducto,
          l.fechaVencimiento,
          l.cantidadDisponible
        FROM Lotes l
        INNER JOIN Productos p ON l.idProducto = p.idProducto AND p.idEmpresa = l.idEmpresa
        WHERE l.idEmpresa = @idEmpresa
          AND l.fechaVencimiento IS NOT NULL
          AND (l.fechaVencimiento <= DATEADD(DAY, 30, GETDATE()))
        ORDER BY l.fechaVencimiento ASC
        `);
    } catch (err) {
      // Si la columna no existe en Lotes, ignorar
    }
    (lotesProximosVencer.recordset || []).forEach((r) => {
      const fechaVenc = r.fechaVencimiento ? new Date(r.fechaVencimiento) : null;
      const dias = fechaVenc ? Math.ceil((fechaVenc - new Date()) / (1000 * 60 * 60 * 24)) : 0;
      const texto = dias < 0 ? "Vencido" : dias === 0 ? "Vence hoy" : `Vence en ${dias} días`;
      alertas.push({
        titulo: "Producto próximo a vencer",
        mensaje: `${r.nombreProducto} - ${Math.round(Number(r.cantidadDisponible || 0))} uds. - ${texto}`,
        icono: "fa-calendar-times",
        tipo: "warning",
        tiempo: "Actual"
      });
    });
  }

  // Construir array de 12 meses para el gráfico (meses con 0 si no hay ventas) y etiquetas
  const mesesMap = {};
  const mesesLabels = [];
  const nombresMes = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const now = new Date();
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
