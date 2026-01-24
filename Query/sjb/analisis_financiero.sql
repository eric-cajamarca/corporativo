-- =============================================
-- VISTAS Y FUNCIONES PARA ANÁLISIS FINANCIERO
-- Ratios, Estados Financieros y KPIs
-- =============================================

USE SistemaInventario;
GO

-- =============================================
-- FUNCIONES PARA CÁLCULOS FINANCIEROS
-- =============================================

-- Función para obtener saldo de cuenta en un período
CREATE OR ALTER FUNCTION fn_GetSaldoCuenta (
    @idEmpresa UNIQUEIDENTIFIER,
    @idCuenta VARCHAR(20),
    @fechaInicio DATE,
    @fechaFin DATE
)
RETURNS DECIMAL(18,2)
AS
BEGIN
    DECLARE @saldo DECIMAL(18,2) = 0;

    -- Calcular saldo basado en naturaleza de la cuenta
    SELECT @saldo = COALESCE(SUM(
        CASE
            WHEN pc.naturaleza = 'D' THEN (da.debe - da.haber)
            ELSE (da.haber - da.debe)
        END
    ), 0)
    FROM PlanCuentas pc
    INNER JOIN DetalleAsientos da ON pc.idCuenta = da.idCuenta AND pc.idEmpresa = da.idEmpresa
    INNER JOIN AsientosContables ac ON da.idAsiento = ac.idAsiento AND da.idEmpresa = ac.idEmpresa
    WHERE pc.idEmpresa = @idEmpresa
      AND pc.idCuenta = @idCuenta
      AND ac.fechaAsiento BETWEEN @fechaInicio AND @fechaFin
      AND ac.estado = 'CONTABILIZADO';

    RETURN @saldo;
END
GO

-- Función para calcular promedio de cuentas por cobrar
CREATE OR ALTER FUNCTION fn_GetPromedioCuentasPorCobrar (
    @idEmpresa UNIQUEIDENTIFIER,
    @fechaFin DATE
)
RETURNS DECIMAL(18,2)
AS
BEGIN
    -- Promedio de saldo de cuentas por cobrar en los últimos 12 meses
    RETURN (
        SELECT AVG(saldo) FROM (
            SELECT
                DATEADD(MONTH, -n, @fechaFin) AS fecha,
                dbo.fn_GetSaldoCuenta(@idEmpresa, '1201-001', DATEADD(MONTH, -n-1, @fechaFin), DATEADD(MONTH, -n, @fechaFin)) AS saldo
            FROM (SELECT TOP 12 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n FROM master.dbo.spt_values) nums
        ) promedios
        WHERE saldo IS NOT NULL
    );
END
GO

-- =============================================
-- VISTAS DE ESTADOS FINANCIEROS
-- =============================================

-- Balance General Consolidado
CREATE VIEW vw_BalanceGeneral AS
SELECT
    bg.idEmpresa,
    e.nombreComercial AS empresa,
    bg.periodo,
    pc.tipo,
    pc.subTipo,
    SUM(bg.saldo) AS totalTipo,
    -- Activo Corriente
    SUM(CASE WHEN pc.tipo = 'ACTIVO' AND pc.subTipo = 'CORRIENTE' THEN bg.saldo ELSE 0 END) AS activoCorriente,
    -- Activo No Corriente
    SUM(CASE WHEN pc.tipo = 'ACTIVO' AND pc.subTipo = 'NO_CORRIENTE' THEN bg.saldo ELSE 0 END) AS activoNoCorriente,
    -- Total Activo
    SUM(CASE WHEN pc.tipo = 'ACTIVO' THEN bg.saldo ELSE 0 END) AS totalActivo,
    -- Pasivo Corriente
    SUM(CASE WHEN pc.tipo = 'PASIVO' AND pc.subTipo = 'CORRIENTE' THEN bg.saldo ELSE 0 END) AS pasivoCorriente,
    -- Pasivo No Corriente
    SUM(CASE WHEN pc.tipo = 'PASIVO' AND pc.subTipo = 'NO_CORRIENTE' THEN bg.saldo ELSE 0 END) AS pasivoNoCorriente,
    -- Total Pasivo
    SUM(CASE WHEN pc.tipo = 'PASIVO' THEN bg.saldo ELSE 0 END) AS totalPasivo,
    -- Patrimonio
    SUM(CASE WHEN pc.tipo = 'PATRIMONIO' THEN bg.saldo ELSE 0 END) AS patrimonio
FROM (
    SELECT
        pc.idEmpresa,
        pc.periodo,
        pc.idCuenta,
        pc.nombre,
        pc.tipo,
        pc.subTipo,
        dbo.fn_GetSaldoCuenta(pc.idEmpresa, pc.idCuenta,
            DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(pc.periodo + '01' AS DATE))),
            CAST(pc.periodo + '01' AS DATE)
        ) AS saldo
    FROM (
        SELECT DISTINCT
            pc.idEmpresa,
            pc.idCuenta,
            pc.nombre,
            pc.tipo,
            pc.subTipo,
            pc2.periodo
        FROM PlanCuentas pc
        CROSS JOIN PeriodosContables pc2
        WHERE pc.permiteMovimientos = 1
          AND pc2.estado = 'CERRADO'
    ) pc
) bg
INNER JOIN Empresas e ON bg.idEmpresa = e.idEmpresa
INNER JOIN PlanCuentas pc ON bg.idCuenta = pc.idCuenta AND bg.idEmpresa = pc.idEmpresa
WHERE bg.saldo <> 0
GROUP BY bg.idEmpresa, e.nombreComercial, bg.periodo, pc.tipo, pc.subTipo;
GO

-- Estado de Resultados
CREATE VIEW vw_EstadoResultados AS
SELECT
    er.idEmpresa,
    e.nombreComercial AS empresa,
    er.periodo,
    -- Ingresos
    SUM(CASE WHEN pc.tipo = 'INGRESO' THEN er.saldo ELSE 0 END) AS totalIngresos,
    -- Costos y Gastos
    SUM(CASE WHEN pc.tipo = 'EGRESO' AND pc.subTipo = 'COSTO_VENTAS' THEN ABS(er.saldo) ELSE 0 END) AS costoVentas,
    SUM(CASE WHEN pc.tipo = 'EGRESO' AND pc.subTipo = 'GASTOS_ADMIN' THEN ABS(er.saldo) ELSE 0 END) AS gastosAdministracion,
    SUM(CASE WHEN pc.tipo = 'EGRESO' AND pc.subTipo = 'GASTOS_VENTAS' THEN ABS(er.saldo) ELSE 0 END) AS gastosVentas,
    SUM(CASE WHEN pc.tipo = 'EGRESO' AND pc.subTipo = 'GASTOS_FINANCIEROS' THEN ABS(er.saldo) ELSE 0 END) AS gastosFinancieros,
    -- Utilidad
    SUM(CASE WHEN pc.tipo = 'INGRESO' THEN er.saldo ELSE -ABS(er.saldo) END) AS utilidadBruta,
    SUM(CASE WHEN pc.tipo = 'INGRESO' THEN er.saldo
             WHEN pc.tipo = 'EGRESO' AND pc.subTipo IN ('GASTOS_ADMIN', 'GASTOS_VENTAS') THEN -ABS(er.saldo)
             ELSE 0 END) AS utilidadOperacional,
    SUM(CASE WHEN pc.tipo = 'INGRESO' THEN er.saldo
             WHEN pc.tipo = 'EGRESO' THEN -ABS(er.saldo)
             ELSE 0 END) AS utilidadNeta
FROM (
    SELECT
        pc.idEmpresa,
        pc.periodo,
        pc.idCuenta,
        dbo.fn_GetSaldoCuenta(pc.idEmpresa, pc.idCuenta,
            DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(pc.periodo + '01' AS DATE))),
            CAST(pc.periodo + '01' AS DATE)
        ) AS saldo
    FROM (
        SELECT DISTINCT
            pc.idEmpresa,
            pc.idCuenta,
            pc2.periodo
        FROM PlanCuentas pc
        CROSS JOIN PeriodosContables pc2
        WHERE pc.permiteMovimientos = 1
          AND pc2.estado = 'CERRADO'
          AND pc.tipo IN ('INGRESO', 'EGRESO')
    ) pc
) er
INNER JOIN Empresas e ON er.idEmpresa = e.idEmpresa
INNER JOIN PlanCuentas pc ON er.idCuenta = pc.idCuenta AND er.idEmpresa = pc.idEmpresa
WHERE er.saldo <> 0
GROUP BY er.idEmpresa, e.nombreComercial, er.periodo;
GO

-- Flujo de Efectivo
CREATE VIEW vw_FlujoEfectivo AS
SELECT
    fe.idEmpresa,
    e.nombreComercial AS empresa,
    fe.periodo,
    -- Flujo de operaciones
    SUM(CASE WHEN pc.subTipo = 'OPERACIONES' THEN fe.saldo ELSE 0 END) AS flujoOperaciones,
    -- Flujo de inversión
    SUM(CASE WHEN pc.subTipo = 'INVERSION' THEN fe.saldo ELSE 0 END) AS flujoInversion,
    -- Flujo de financiamiento
    SUM(CASE WHEN pc.subTipo = 'FINANCIAMIENTO' THEN fe.saldo ELSE 0 END) AS flujoFinanciamiento,
    -- Flujo neto
    SUM(fe.saldo) AS flujoNeto,
    -- Saldo inicial
    LAG(SUM(fe.saldo)) OVER (PARTITION BY fe.idEmpresa ORDER BY fe.periodo) AS saldoInicial,
    -- Saldo final
    SUM(SUM(fe.saldo)) OVER (PARTITION BY fe.idEmpresa ORDER BY fe.periodo) AS saldoFinal
FROM (
    SELECT
        pc.idEmpresa,
        pc.periodo,
        pc.idCuenta,
        dbo.fn_GetSaldoCuenta(pc.idEmpresa, pc.idCuenta,
            DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(pc.periodo + '01' AS DATE))),
            CAST(pc.periodo + '01' AS DATE)
        ) AS saldo
    FROM (
        SELECT DISTINCT
            pc.idEmpresa,
            pc.idCuenta,
            pc2.periodo
        FROM PlanCuentas pc
        CROSS JOIN PeriodosContables pc2
        WHERE pc.permiteMovimientos = 1
          AND pc2.estado = 'CERRADO'
          AND pc.idCuenta LIKE '57%' -- Cuentas de flujo de efectivo
    ) pc
) fe
INNER JOIN Empresas e ON fe.idEmpresa = e.idEmpresa
INNER JOIN PlanCuentas pc ON fe.idCuenta = pc.idCuenta AND fe.idEmpresa = pc.idEmpresa
WHERE fe.saldo <> 0
GROUP BY fe.idEmpresa, e.nombreComercial, fe.periodo;
GO

-- =============================================
-- RATIOS FINANCIEROS
-- =============================================

-- Ratios de Liquidez y Solvencia
CREATE VIEW vw_RatiosLiquidez AS
SELECT
    r.idEmpresa,
    e.nombreComercial AS empresa,
    r.periodo,
    -- Ratio de Liquidez Corriente (Activo Corriente / Pasivo Corriente)
    CASE WHEN r.pasivoCorriente <> 0 THEN r.activoCorriente / r.pasivoCorriente ELSE 0 END AS liquidezCorriente,

    -- Ratio de Liquidez Ácida (Activo Corriente - Inventarios) / Pasivo Corriente
    CASE WHEN r.pasivoCorriente <> 0 THEN (r.activoCorriente - r.inventarios) / r.pasivoCorriente ELSE 0 END AS liquidezAcida,

    -- Ratio de Liquidez Inmediata (Efectivo + Inversiones) / Pasivo Corriente
    CASE WHEN r.pasivoCorriente <> 0 THEN (r.efectivo + r.inversiones) / r.pasivoCorriente ELSE 0 END AS liquidezInmediata,

    -- Ratio de Endeudamiento Total (Total Pasivo / Total Activo)
    CASE WHEN r.totalActivo <> 0 THEN r.totalPasivo / r.totalActivo ELSE 0 END AS endeudamientoTotal,

    -- Ratio de Endeudamiento Patrimonial (Total Pasivo / Patrimonio)
    CASE WHEN r.patrimonio <> 0 THEN r.totalPasivo / r.patrimonio ELSE 0 END AS endeudamientoPatrimonial,

    -- Nivel de Endeudamiento (Pasivo Corriente / Patrimonio)
    CASE WHEN r.patrimonio <> 0 THEN r.pasivoCorriente / r.patrimonio ELSE 0 END AS nivelEndeudamiento,

    -- Cobertura de Intereses (Utilidad Operacional / Gastos Financieros)
    CASE WHEN r.gastosFinancieros <> 0 THEN r.utilidadOperacional / ABS(r.gastosFinancieros) ELSE 0 END AS coberturaIntereses

FROM (
    SELECT
        bg.idEmpresa,
        bg.periodo,
        bg.activoCorriente,
        bg.activoNoCorriente,
        bg.totalActivo,
        bg.pasivoCorriente,
        bg.pasivoNoCorriente,
        bg.totalPasivo,
        bg.patrimonio,
        -- Inventarios (aproximado)
        dbo.fn_GetSaldoCuenta(bg.idEmpresa, '2001-001', DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(bg.periodo + '01' AS DATE))), CAST(bg.periodo + '01' AS DATE)) AS inventarios,
        -- Efectivo e inversiones
        dbo.fn_GetSaldoCuenta(bg.idEmpresa, '1001-001', DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(bg.periodo + '01' AS DATE))), CAST(bg.periodo + '01' AS DATE)) +
        dbo.fn_GetSaldoCuenta(bg.idEmpresa, '1002-001', DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(bg.periodo + '01' AS DATE))), CAST(bg.periodo + '01' AS DATE)) AS efectivo,
        dbo.fn_GetSaldoCuenta(bg.idEmpresa, '1101-001', DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(bg.periodo + '01' AS DATE))), CAST(bg.periodo + '01' AS DATE)) AS inversiones,
        -- Utilidad operacional y gastos financieros
        er.utilidadOperacional,
        er.gastosFinancieros
    FROM vw_BalanceGeneral bg
    LEFT JOIN vw_EstadoResultados er ON bg.idEmpresa = er.idEmpresa AND bg.periodo = er.periodo
) r
INNER JOIN Empresas e ON r.idEmpresa = e.idEmpresa;
GO

-- Ratios de Rentabilidad
CREATE VIEW vw_RatiosRentabilidad AS
SELECT
    rr.idEmpresa,
    e.nombreComercial AS empresa,
    rr.periodo,
    -- Margen Bruto ((Ingresos - Costo Ventas) / Ingresos) * 100
    CASE WHEN rr.totalIngresos <> 0 THEN ((rr.totalIngresos - rr.costoVentas) / rr.totalIngresos) * 100 ELSE 0 END AS margenBruto,

    -- Margen Operacional (Utilidad Operacional / Ingresos) * 100
    CASE WHEN rr.totalIngresos <> 0 THEN (rr.utilidadOperacional / rr.totalIngresos) * 100 ELSE 0 END AS margenOperacional,

    -- Margen Neto (Utilidad Neta / Ingresos) * 100
    CASE WHEN rr.totalIngresos <> 0 THEN (rr.utilidadNeta / rr.totalIngresos) * 100 ELSE 0 END AS margenNeto,

    -- ROA (Utilidad Neta / Total Activo) * 100
    CASE WHEN bg.totalActivo <> 0 THEN (rr.utilidadNeta / bg.totalActivo) * 100 ELSE 0 END AS ROA,

    -- ROE (Utilidad Neta / Patrimonio) * 100
    CASE WHEN bg.patrimonio <> 0 THEN (rr.utilidadNeta / bg.patrimonio) * 100 ELSE 0 END AS ROE,

    -- ROI (Utilidad Operacional / (Activo Corriente + Activo Fijo)) * 100
    CASE WHEN (bg.activoCorriente + bg.activoNoCorriente) <> 0 THEN (rr.utilidadOperacional / (bg.activoCorriente + bg.activoNoCorriente)) * 100 ELSE 0 END AS ROI

FROM vw_EstadoResultados rr
INNER JOIN Empresas e ON rr.idEmpresa = e.idEmpresa
INNER JOIN vw_BalanceGeneral bg ON rr.idEmpresa = bg.idEmpresa AND rr.periodo = bg.periodo;
GO

-- Ratios de Rotación y Eficiencia
CREATE VIEW vw_RatiosRotacion AS
SELECT
    rot.idEmpresa,
    e.nombreComercial AS empresa,
    rot.periodo,
    -- Rotación de Inventarios (Costo Ventas / Inventario Promedio)
    CASE WHEN rot.inventarioPromedio <> 0 THEN rot.costoVentas / rot.inventarioPromedio ELSE 0 END AS rotacionInventarios,

    -- Rotación de Cuentas por Cobrar (Ventas a Crédito / Cuentas por Cobrar Promedio)
    CASE WHEN rot.cuentasPorCobrarPromedio <> 0 THEN rot.ventasCredito / rot.cuentasPorCobrarPromedio ELSE 0 END AS rotacionCuentasCobrar,

    -- Rotación de Cuentas por Pagar (Compras a Crédito / Cuentas por Pagar Promedio)
    CASE WHEN rot.cuentasPorPagarPromedio <> 0 THEN rot.comprasCredito / rot.cuentasPorPagarPromedio ELSE 0 END AS rotacionCuentasPagar,

    -- Período Medio de Cobro (365 / Rotación Cuentas por Cobrar)
    CASE WHEN rot.ventasCredito <> 0 AND rot.cuentasPorCobrarPromedio <> 0 THEN 365 / (rot.ventasCredito / rot.cuentasPorCobrarPromedio) ELSE 0 END AS periodoMedioCobro,

    -- Período Medio de Pago (365 / Rotación Cuentas por Pagar)
    CASE WHEN rot.comprasCredito <> 0 AND rot.cuentasPorPagarPromedio <> 0 THEN 365 / (rot.comprasCredito / rot.cuentasPorPagarPromedio) ELSE 0 END AS periodoMedioPago,

    -- Ciclo de Conversión de Efectivo (PMC + PMI - PMP)
    CASE WHEN rot.ventasCredito <> 0 AND rot.cuentasPorCobrarPromedio <> 0 AND rot.comprasCredito <> 0 AND rot.cuentasPorPagarPromedio <> 0
         THEN (365 / (rot.ventasCredito / rot.cuentasPorCobrarPromedio)) +
              (365 / (rot.costoVentas / rot.inventarioPromedio)) -
              (365 / (rot.comprasCredito / rot.cuentasPorPagarPromedio))
         ELSE 0 END AS cicloConversionEfectivo

FROM (
    SELECT
        er.idEmpresa,
        er.periodo,
        er.totalIngresos,
        er.costoVentas,
        -- Ventas a crédito (aproximado)
        dbo.fn_GetSaldoCuenta(er.idEmpresa, '1201-001', DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(er.periodo + '01' AS DATE))), CAST(er.periodo + '01' AS DATE)) AS ventasCredito,
        -- Compras a crédito (aproximado)
        dbo.fn_GetSaldoCuenta(er.idEmpresa, '2201-001', DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(er.periodo + '01' AS DATE))), CAST(er.periodo + '01' AS DATE)) AS comprasCredito,
        -- Inventario promedio
        dbo.fn_GetPromedioCuentasPorCobrar(er.idEmpresa, CAST(er.periodo + '01' AS DATE)) AS cuentasPorCobrarPromedio,
        -- Cuentas por cobrar promedio (usando función similar)
        (SELECT AVG(saldo) FROM (
            SELECT dbo.fn_GetSaldoCuenta(er.idEmpresa, '2001-001', DATEADD(MONTH, -n, CAST(er.periodo + '01' AS DATE)), DATEADD(MONTH, -n+1, CAST(er.periodo + '01' AS DATE))) AS saldo
            FROM (SELECT TOP 12 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n FROM master.dbo.spt_values) nums
        ) proms WHERE saldo IS NOT NULL) AS inventarioPromedio,
        -- Cuentas por pagar promedio
        (SELECT AVG(saldo) FROM (
            SELECT dbo.fn_GetSaldoCuenta(er.idEmpresa, '2201-001', DATEADD(MONTH, -n, CAST(er.periodo + '01' AS DATE)), DATEADD(MONTH, -n+1, CAST(er.periodo + '01' AS DATE))) AS saldo
            FROM (SELECT TOP 12 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n FROM master.dbo.spt_values) nums
        ) proms WHERE saldo IS NOT NULL) AS cuentasPorPagarPromedio
    FROM vw_EstadoResultados er
) rot
INNER JOIN Empresas e ON rot.idEmpresa = e.idEmpresa;
GO

-- =============================================
-- ANÁLISIS DE RENTABILIDAD POR PRODUCTO/CATEGORÍA
-- =============================================

-- Rentabilidad por producto
CREATE VIEW vw_RentabilidadProducto AS
SELECT
    rp.idEmpresa,
    e.nombreComercial AS empresa,
    rp.idProducto,
    p.codigo,
    p.descripcion,
    c.nombre AS categoria,
    rp.periodo,
    rp.ventas,
    rp.costoVentas,
    rp.gastosAsociados,
    -- Margen de contribución
    rp.ventas - rp.costoVentas - rp.gastosAsociados AS margenContribucion,
    -- Margen porcentual
    CASE WHEN rp.ventas <> 0 THEN ((rp.ventas - rp.costoVentas - rp.gastosAsociados) / rp.ventas) * 100 ELSE 0 END AS margenPorcentual,
    -- Ranking de rentabilidad
    ROW_NUMBER() OVER (PARTITION BY rp.idEmpresa, rp.periodo ORDER BY (rp.ventas - rp.costoVentas - rp.gastosAsociados) DESC) AS rankingRentabilidad

FROM (
    SELECT
        dv.idProducto,
        YEAR(v.fEmision) * 100 + MONTH(v.fEmision) AS periodo,
        v.idEmpresa,
        SUM(dv.total) AS ventas,
        SUM(dv.cantidad * p.cUnitario) AS costoVentas,
        SUM(dv.descuento) AS gastosAsociados
    FROM DetalleVenta dv
    INNER JOIN Ventas v ON dv.idVenta = v.idVenta
    INNER JOIN Productos p ON dv.idProducto = p.idProducto
    GROUP BY dv.idProducto, YEAR(v.fEmision) * 100 + MONTH(v.fEmision), v.idEmpresa
) rp
INNER JOIN Empresas e ON rp.idEmpresa = e.idEmpresa
INNER JOIN Productos p ON rp.idProducto = p.idProducto
INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
WHERE rp.ventas > 0;
GO

-- Rentabilidad por categoría
CREATE VIEW vw_RentabilidadCategoria AS
SELECT
    rc.idEmpresa,
    e.nombreComercial AS empresa,
    rc.idCategoria,
    c.nombre AS categoria,
    rc.periodo,
    rc.ventas,
    rc.costoVentas,
    rc.gastosAsociados,
    -- Margen de contribución
    rc.ventas - rc.costoVentas - rc.gastosAsociados AS margenContribucion,
    -- Margen porcentual
    CASE WHEN rc.ventas <> 0 THEN ((rc.ventas - rc.costoVentas - rc.gastosAsociados) / rc.ventas) * 100 ELSE 0 END AS margenPorcentual,
    -- Participación en ventas totales
    CASE WHEN rc.totalVentasPeriodo <> 0 THEN (rc.ventas / rc.totalVentasPeriodo) * 100 ELSE 0 END AS participacionVentas,
    -- Ranking de rentabilidad
    ROW_NUMBER() OVER (PARTITION BY rc.idEmpresa, rc.periodo ORDER BY (rc.ventas - rc.costoVentas - rc.gastosAsociados) DESC) AS rankingRentabilidad

FROM (
    SELECT
        p.idCategoria,
        YEAR(v.fEmision) * 100 + MONTH(v.fEmision) AS periodo,
        v.idEmpresa,
        SUM(dv.total) AS ventas,
        SUM(dv.cantidad * p.cUnitario) AS costoVentas,
        SUM(dv.descuento) AS gastosAsociados,
        SUM(SUM(dv.total)) OVER (PARTITION BY v.idEmpresa, YEAR(v.fEmision) * 100 + MONTH(v.fEmision)) AS totalVentasPeriodo
    FROM DetalleVenta dv
    INNER JOIN Ventas v ON dv.idVenta = v.idVenta
    INNER JOIN Productos p ON dv.idProducto = p.idProducto
    GROUP BY p.idCategoria, YEAR(v.fEmision) * 100 + MONTH(v.fEmision), v.idEmpresa
) rc
INNER JOIN Empresas e ON rc.idEmpresa = e.idEmpresa
INNER JOIN Categorias c ON rc.idCategoria = c.idCategoria
WHERE rc.ventas > 0;
GO

-- =============================================
-- DASHBOARD FINANCIERO
-- =============================================

-- KPIs Financieros Principales
CREATE VIEW vw_DashboardFinanciero AS
SELECT
    df.idEmpresa,
    e.nombreComercial AS empresa,
    df.periodo,
    -- Indicadores de crecimiento
    df.ventasActuales,
    df.ventasAnteriores,
    CASE WHEN df.ventasAnteriores <> 0 THEN ((df.ventasActuales - df.ventasAnteriores) / df.ventasAnteriores) * 100 ELSE 0 END AS crecimientoVentas,

    df.utilidadActual,
    df.utilidadAnterior,
    CASE WHEN df.utilidadAnterior <> 0 THEN ((df.utilidadActual - df.utilidadAnterior) / df.utilidadAnterior) * 100 ELSE 0 END AS crecimientoUtilidad,

    -- Ratios críticos
    df.liquidezCorriente,
    df.endeudamientoTotal,
    df.margenNeto,
    df.ROE,

    -- Alertas
    CASE WHEN df.liquidezCorriente < 1.5 THEN 'CRÍTICA' WHEN df.liquidezCorriente < 2 THEN 'BAJA' ELSE 'ADECUADA' END AS alertaLiquidez,
    CASE WHEN df.endeudamientoTotal > 0.6 THEN 'ALTO' WHEN df.endeudamientoTotal > 0.4 THEN 'MODERADO' ELSE 'BAJO' END AS alertaEndeudamiento,
    CASE WHEN df.margenNeto < 5 THEN 'BAJO' WHEN df.margenNeto > 15 THEN 'EXCELENTE' ELSE 'ADECUADO' END AS alertaRentabilidad

FROM (
    SELECT
        er.idEmpresa,
        er.periodo,
        er.totalIngresos AS ventasActuales,
        er.utilidadNeta AS utilidadActual,
        -- Ventas período anterior
        LAG(er.totalIngresos) OVER (PARTITION BY er.idEmpresa ORDER BY er.periodo) AS ventasAnteriores,
        LAG(er.utilidadNeta) OVER (PARTITION BY er.idEmpresa ORDER BY er.periodo) AS utilidadAnterior,
        -- Ratios del período actual
        rl.liquidezCorriente,
        rl.endeudamientoTotal,
        rr.margenNeto,
        rr.ROE
    FROM vw_EstadoResultados er
    LEFT JOIN vw_RatiosLiquidez rl ON er.idEmpresa = rl.idEmpresa AND er.periodo = rl.periodo
    LEFT JOIN vw_RatiosRentabilidad rr ON er.idEmpresa = rr.idEmpresa AND er.periodo = rr.periodo
) df
INNER JOIN Empresas e ON df.idEmpresa = e.idEmpresa
ORDER BY df.idEmpresa, df.periodo DESC;
GO

-- =============================================
-- PROCEDIMIENTOS PARA REPORTES
-- =============================================

-- Procedimiento para generar balance general
CREATE OR ALTER PROCEDURE sp_GenerarBalanceGeneral
    @idEmpresa UNIQUEIDENTIFIER,
    @periodo VARCHAR(6)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        pc.idCuenta,
        pc.nombre,
        pc.tipo,
        pc.subTipo,
        dbo.fn_GetSaldoCuenta(@idEmpresa, pc.idCuenta,
            DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(@periodo + '01' AS DATE))),
            CAST(@periodo + '01' AS DATE)
        ) AS saldo
    FROM PlanCuentas pc
    WHERE pc.idEmpresa = @idEmpresa
      AND pc.permiteMovimientos = 1
      AND pc.tipo IN ('ACTIVO', 'PASIVO', 'PATRIMONIO')
    ORDER BY pc.idCuenta;
END
GO

-- Procedimiento para generar estado de resultados
CREATE OR ALTER PROCEDURE sp_GenerarEstadoResultados
    @idEmpresa UNIQUEIDENTIFIER,
    @periodoInicio VARCHAR(6),
    @periodoFin VARCHAR(6) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @periodoFin IS NULL
        SET @periodoFin = @periodoInicio;

    SELECT
        pc.idCuenta,
        pc.nombre,
        pc.tipo,
        pc.subTipo,
        SUM(dbo.fn_GetSaldoCuenta(@idEmpresa, pc.idCuenta,
            DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(p.periodo + '01' AS DATE))),
            CAST(p.periodo + '01' AS DATE)
        )) AS saldo
    FROM PlanCuentas pc
    CROSS JOIN (
        SELECT periodo FROM PeriodosContables
        WHERE idEmpresa = @idEmpresa
          AND periodo BETWEEN @periodoInicio AND @periodoFin
          AND estado = 'CERRADO'
    ) p
    WHERE pc.idEmpresa = @idEmpresa
      AND pc.permiteMovimientos = 1
      AND pc.tipo IN ('INGRESO', 'EGRESO')
    GROUP BY pc.idCuenta, pc.nombre, pc.tipo, pc.subTipo
    HAVING SUM(dbo.fn_GetSaldoCuenta(@idEmpresa, pc.idCuenta,
        DATEADD(MONTH, -11, DATEADD(MONTH, 1, CAST(p.periodo + '01' AS DATE))),
        CAST(p.periodo + '01' AS DATE)
    )) <> 0
    ORDER BY pc.idCuenta;
END
GO

PRINT 'Vistas y funciones de análisis financiero creadas exitosamente.';
PRINT 'Ahora puedes consultar ratios financieros, estados financieros y análisis de rentabilidad.';
GO