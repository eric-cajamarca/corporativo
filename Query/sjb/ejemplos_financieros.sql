-- =============================================
-- EJEMPLOS DE ANÁLISIS FINANCIERO
-- Consultas específicas para evaluar salud financiera
-- =============================================

USE SistemaInventario;
GO

-- =============================================
-- SALUD FINANCIERA - INDICADORES PRINCIPALES
-- =============================================

-- 1. DASHBOARD DE SALUD FINANCIERA (últimos 6 meses)
SELECT TOP 6
    'SALUD FINANCIERA - ' + e.nombreComercial AS empresa,
    df.periodo,
    -- Indicadores de crecimiento
    df.crecimientoVentas,
    df.crecimientoUtilidad,

    -- Ratios de liquidez y solvencia
    rl.liquidezCorriente,
    rl.endeudamientoTotal,
    rl.endeudamientoPatrimonial,

    -- Ratios de rentabilidad
    rr.margenBruto,
    rr.margenNeto,
    rr.ROE,

    -- Ratios de eficiencia
    rot.rotacionInventarios,
    rot.periodoMedioCobro,
    rot.cicloConversionEfectivo,

    -- Alertas automáticas
    CASE
        WHEN rl.liquidezCorriente < 1.5 THEN '🔴 CRÍTICO'
        WHEN rl.liquidezCorriente < 2.0 THEN '🟡 REGULAR'
        ELSE '🟢 BUENO'
    END AS alertaLiquidez,

    CASE
        WHEN rr.margenNeto < 5 THEN '🔴 BAJO'
        WHEN rr.margenNeto < 10 THEN '🟡 REGULAR'
        ELSE '🟢 BUENO'
    END AS alertaRentabilidad,

    CASE
        WHEN rot.cicloConversionEfectivo > 90 THEN '🔴 LARGO'
        WHEN rot.cicloConversionEfectivo > 60 THEN '🟡 MODERADO'
        ELSE '🟢 EFICIENTE'
    END AS alertaCiclo

FROM vw_DashboardFinanciero df
INNER JOIN Empresas e ON df.idEmpresa = e.idEmpresa
LEFT JOIN vw_RatiosLiquidez rl ON df.idEmpresa = rl.idEmpresa AND df.periodo = rl.periodo
LEFT JOIN vw_RatiosRentabilidad rr ON df.idEmpresa = rr.idEmpresa AND df.periodo = rr.periodo
LEFT JOIN vw_RatiosRotacion rot ON df.idEmpresa = rot.idEmpresa AND df.periodo = rot.periodo
WHERE df.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY df.periodo DESC;

-- =============================================
-- ANÁLISIS DE RENTABILIDAD POR VENTAS
-- =============================================

-- 2. RENTABILIDAD GENERAL DE LA EMPRESA (último año)
SELECT
    'RENTABILIDAD EMPRESA' AS analisis,
    COUNT(DISTINCT periodo) AS periodosAnalizados,
    AVG(totalIngresos) AS ventasPromedio,
    AVG(utilidadNeta) AS utilidadPromedio,
    AVG(CASE WHEN totalIngresos <> 0 THEN (utilidadNeta / totalIngresos) * 100 ELSE 0 END) AS margenNetoPromedio,
    MIN(CASE WHEN totalIngresos <> 0 THEN (utilidadNeta / totalIngresos) * 100 ELSE 0 END) AS margenNetoMinimo,
    MAX(CASE WHEN totalIngresos <> 0 THEN (utilidadNeta / totalIngresos) * 100 ELSE 0 END) AS margenNetoMaximo,

    -- Evaluación general
    CASE
        WHEN AVG(CASE WHEN totalIngresos <> 0 THEN (utilidadNeta / totalIngresos) * 100 ELSE 0 END) > 15 THEN 'EXCELENTE (>15%)'
        WHEN AVG(CASE WHEN totalIngresos <> 0 THEN (utilidadNeta / totalIngresos) * 100 ELSE 0 END) > 10 THEN 'BUENO (10-15%)'
        WHEN AVG(CASE WHEN totalIngresos <> 0 THEN (utilidadNeta / totalIngresos) * 100 ELSE 0 END) > 5 THEN 'ACEPTABLE (5-10%)'
        ELSE 'PREOCUPANTE (<5%)'
    END AS evaluacionRentabilidad

FROM vw_EstadoResultados
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
  AND periodo LIKE '202%';

-- 3. ANÁLISIS DE RENTABILIDAD POR PRODUCTO (Top 10 más rentables)
SELECT TOP 10
    'RENTABILIDAD POR PRODUCTO' AS analisis,
    p.descripcion AS producto,
    c.nombre AS categoria,
    SUM(rp.ventas) AS ventasTotal,
    SUM(rp.costoVentas) AS costoTotal,
    SUM(rp.ventas - rp.costoVentas - rp.gastosAsociados) AS margenContribucion,
    AVG(rp.margenPorcentual) AS margenPromedio,
    rp.rankingRentabilidad AS ranking,

    -- Clasificación de rentabilidad
    CASE
        WHEN AVG(rp.margenPorcentual) > 50 THEN 'MUY RENTABLE'
        WHEN AVG(rp.margenPorcentual) > 30 THEN 'RENTABLE'
        WHEN AVG(rp.margenPorcentual) > 15 THEN 'MODERADAMENTE RENTABLE'
        ELSE 'BAJA RENTABILIDAD'
    END AS clasificacion

FROM vw_RentabilidadProducto rp
INNER JOIN Productos p ON rp.idProducto = p.idProducto
INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
WHERE rp.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
  AND rp.periodo LIKE '2025%'
GROUP BY p.descripcion, c.nombre, rp.rankingRentabilidad
ORDER BY margenContribucion DESC;

-- 4. ANÁLISIS DE RENTABILIDAD POR CATEGORÍA
SELECT
    'RENTABILIDAD POR CATEGORÍA' AS analisis,
    c.nombre AS categoria,
    SUM(rc.ventas) AS ventasTotal,
    SUM(rc.costoVentas) AS costoTotal,
    SUM(rc.margenContribucion) AS margenTotal,
    AVG(rc.margenPorcentual) AS margenPromedio,
    SUM(rc.ventas) * 1.0 / SUM(SUM(rc.ventas)) OVER () * 100 AS participacionVentas,
    rc.rankingRentabilidad AS ranking,

    -- Análisis de contribución
    CASE
        WHEN SUM(rc.margenContribucion) > 0 THEN 'CONTRIBUYE UTILIDAD'
        ELSE 'GENERA PÉRDIDAS'
    END AS impactoUtilidad

FROM vw_RentabilidadCategoria rc
INNER JOIN Categorias c ON rc.idCategoria = c.idCategoria
WHERE rc.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
  AND rc.periodo LIKE '2025%'
GROUP BY c.nombre, rc.rankingRentabilidad
ORDER BY margenTotal DESC;

-- =============================================
-- ANÁLISIS DE LIQUIDEZ Y SOLVENCIA
-- =============================================

-- 5. ANÁLISIS DE CAPACIDAD DE PAGO
SELECT
    'CAPACIDAD DE PAGO' AS analisis,
    periodo,
    liquidezCorriente,
    liquidezAcida,
    liquidezInmediata,
    endeudamientoTotal,
    coberturaIntereses,

    -- Evaluación de liquidez
    CASE
        WHEN liquidezCorriente >= 2.0 THEN 'EXCELENTE'
        WHEN liquidezCorriente >= 1.5 THEN 'BUENA'
        WHEN liquidezCorriente >= 1.0 THEN 'ACEPTABLE'
        ELSE 'CRÍTICA'
    END AS evaluacionLiquidez,

    -- Evaluación de endeudamiento
    CASE
        WHEN endeudamientoTotal <= 0.4 THEN 'CONSERVADOR'
        WHEN endeudamientoTotal <= 0.6 THEN 'MODERADO'
        ELSE 'AGRESIVO'
    END AS evaluacionEndeudamiento,

    -- Riesgo financiero
    CASE
        WHEN liquidezCorriente >= 1.5 AND endeudamientoTotal <= 0.6 THEN 'BAJO RIESGO'
        WHEN liquidezCorriente >= 1.0 OR endeudamientoTotal <= 0.7 THEN 'RIESGO MODERADO'
        ELSE 'ALTO RIESGO'
    END AS riesgoFinanciero

FROM vw_RatiosLiquidez
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY periodo DESC;

-- 6. EVOLUCIÓN DE LA DEUDA Y SU COBERTURA
SELECT
    'EVOLUCIÓN DEUDA' AS analisis,
    periodo,
    totalActivo,
    totalPasivo,
    patrimonio,
    totalPasivo * 100.0 / totalActivo AS endeudamientoTotal,
    totalPasivo * 100.0 / patrimonio AS endeudamientoPatrimonial,
    pasivoCorriente * 100.0 / patrimonio AS nivelEndeudamiento,

    -- Tendencia de endeudamiento
    CASE
        WHEN totalPasivo * 100.0 / totalActivo >
             LAG(totalPasivo * 100.0 / totalActivo) OVER (ORDER BY periodo) THEN 'INCREMENTANDO'
        WHEN totalPasivo * 100.0 / totalActivo <
             LAG(totalPasivo * 100.0 / totalActivo) OVER (ORDER BY periodo) THEN 'DISMINUYENDO'
        ELSE 'ESTABLE'
    END AS tendenciaEndeudamiento

FROM vw_BalanceGeneral
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY periodo DESC;

-- =============================================
-- ANÁLISIS DE EFICIENCIA OPERATIVA
-- =============================================

-- 7. ROTACIÓN DE ACTIVOS Y EFICIENCIA
SELECT
    'EFICIENCIA OPERATIVA' AS analisis,
    periodo,
    rotacionInventarios,
    rotacionCuentasCobrar,
    rotacionCuentasPagar,
    periodoMedioCobro,
    periodoMedioPago,
    cicloConversionEfectivo,

    -- Evaluación de gestión de inventarios
    CASE
        WHEN rotacionInventarios > 8 THEN 'EXCELENTE (Alta rotación)'
        WHEN rotacionInventarios > 4 THEN 'BUENA'
        WHEN rotacionInventarios > 2 THEN 'ACEPTABLE'
        ELSE 'DEFICIENTE (Baja rotación)'
    END AS evaluacionInventarios,

    -- Evaluación de cobros
    CASE
        WHEN periodoMedioCobro < 45 THEN 'EXCELENTE'
        WHEN periodoMedioCobro < 60 THEN 'BUENA'
        WHEN periodoMedioCobro < 90 THEN 'ACEPTABLE'
        ELSE 'DEFICIENTE'
    END AS evaluacionCobros,

    -- Evaluación del ciclo de conversión
    CASE
        WHEN cicloConversionEfectivo < 60 THEN 'EXCELENTE'
        WHEN cicloConversionEfectivo < 90 THEN 'BUENA'
        ELSE 'REQUIERE MEJORA'
    END AS evaluacionCiclo

FROM vw_RatiosRotacion
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY periodo DESC;

-- 8. ANÁLISIS DE ACTIVOS FIJOS Y DEPRECIACIÓN
SELECT
    'ACTIVOS FIJOS' AS analisis,
    af.codigo,
    af.nombre,
    af.costoAdquisicion,
    af.depreciacionAcumulada,
    af.valorActual,
    af.vidaUtilMeses,
    af.fechaAdquisicion,
    af.fechaUltimaDepreciacion,
    pc.nombre AS cuentaContable,

    -- Estado del activo
    CASE
        WHEN af.valorActual / af.costoAdquisicion > 0.8 THEN 'NUEVO'
        WHEN af.valorActual / af.costoAdquisicion > 0.5 THEN 'SEMI-NUEVO'
        WHEN af.valorActual / af.costoAdquisicion > 0.2 THEN 'USADO'
        ELSE 'OBSOLETO'
    END AS estadoActivo,

    -- Vida útil restante
    af.vidaUtilMeses - DATEDIFF(MONTH, af.fechaAdquisicion, GETDATE()) AS mesesRestantes

FROM ActivosFijos af
LEFT JOIN PlanCuentas pc ON af.idCuentaContable = pc.idCuenta AND af.idEmpresa = pc.idEmpresa
WHERE af.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
  AND af.estado = 'ACTIVO'
ORDER BY af.valorActual DESC;

-- =============================================
-- ANÁLISIS DE FLUJO DE EFECTIVO
-- =============================================

-- 9. FLUJO DE EFECTIVO POR ACTIVIDADES
SELECT
    'FLUJO DE EFECTIVO' AS analisis,
    periodo,
    flujoOperaciones,
    flujoInversion,
    flujoFinanciamiento,
    flujoNeto,
    saldoInicial,
    saldoFinal,

    -- Análisis de las actividades
    CASE
        WHEN flujoOperaciones > 0 THEN 'POSITIVO (Genera efectivo)'
        ELSE 'NEGATIVO (Consume efectivo)'
    END AS actividadOperativa,

    CASE
        WHEN flujoInversion < 0 THEN 'INVIRTIENDO (Compra activos)'
        WHEN flujoInversion > 0 THEN 'DESINVIRTIENDO (Vende activos)'
        ELSE 'NEUTRO'
    END AS actividadInversion,

    CASE
        WHEN flujoFinanciamiento > 0 THEN 'FINANCIAMIENTO (Recibe deuda/capital)'
        WHEN flujoFinanciamiento < 0 THEN 'DESENDEUDAMIENTO (Paga deuda)'
        ELSE 'NEUTRO'
    END AS actividadFinanciera,

    -- Capacidad de pago
    CASE
        WHEN flujoNeto > 0 THEN 'GENERA EFECTIVO'
        WHEN ABS(flujoNeto) / NULLIF(saldoInicial, 0) < 0.1 THEN 'ESTABLE'
        ELSE 'REQUIERE ATENCIÓN'
    END AS capacidadPago

FROM vw_FlujoEfectivo
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY periodo DESC;

-- =============================================
-- ANÁLISIS DE PRESUPUESTOS VS REAL
-- =============================================

-- 10. CONTROL PRESUPUESTAL
SELECT
    'CONTROL PRESUPUESTAL' AS analisis,
    p.nombre AS presupuesto,
    dp.periodo,
    pc.nombre AS cuenta,
    dp.montoPresupuestado,
    COALESCE(SUM(ABS(da.debe - da.haber)), 0) AS montoEjecutado,
    dp.montoPresupuestado - COALESCE(SUM(ABS(da.debe - da.haber)), 0) AS variacion,
    CASE
        WHEN dp.montoPresupuestado = 0 THEN 0
        ELSE (COALESCE(SUM(ABS(da.debe - da.haber)), 0) / dp.montoPresupuestado) * 100
    END AS porcentajeEjecucion,

    -- Estado del presupuesto
    CASE
        WHEN COALESCE(SUM(ABS(da.debe - da.haber)), 0) > dp.montoPresupuestado THEN 'SOBRE-EJECUTADO'
        WHEN COALESCE(SUM(ABS(da.debe - da.haber)), 0) > dp.montoPresupuestado * 0.9 THEN 'CERCA LÍMITE'
        WHEN COALESCE(SUM(ABS(da.debe - da.haber)), 0) < dp.montoPresupuestado * 0.8 THEN 'SUB-EJECUTADO'
        ELSE 'DENTRO PRESUPUESTO'
    END AS estadoPresupuesto

FROM Presupuestos p
INNER JOIN DetallePresupuestos dp ON p.idPresupuesto = dp.idPresupuesto
LEFT JOIN PlanCuentas pc ON dp.idCuenta = pc.idCuenta AND dp.idEmpresa = pc.idEmpresa
LEFT JOIN DetalleAsientos da ON dp.idCuenta = da.idCuenta
    AND dp.idEmpresa = da.idEmpresa
    AND da.idCentroCosto = dp.idCentroCosto
    AND EXISTS (
        SELECT 1 FROM AsientosContables ac
        WHERE ac.idAsiento = da.idAsiento
          AND ac.idEmpresa = da.idEmpresa
          AND ac.periodo = dp.periodo
          AND ac.estado = 'CONTABILIZADO'
    )
WHERE p.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
  AND p.estado = 'APROBADO'
GROUP BY p.nombre, dp.periodo, pc.nombre, dp.montoPresupuestado, dp.idCuenta, dp.idCentroCosto, p.idPresupuesto
ORDER BY p.nombre, dp.periodo;

-- =============================================
-- ANÁLISIS POR CENTROS DE COSTO
-- =============================================

-- 11. RENTABILIDAD POR CENTRO DE COSTO
SELECT
    'RENTABILIDAD POR CENTRO' AS analisis,
    cc.nombre AS centroCosto,
    cc.tipo,
    COUNT(DISTINCT ac.idAsiento) AS asientos,
    COALESCE(SUM(CASE WHEN pc.tipo = 'INGRESO' THEN ABS(da.debe - da.haber) ELSE 0 END), 0) AS ingresos,
    COALESCE(SUM(CASE WHEN pc.tipo = 'EGRESO' THEN ABS(da.haber - da.debe) ELSE 0 END), 0) AS egresos,
    COALESCE(SUM(CASE WHEN pc.tipo = 'INGRESO' THEN ABS(da.debe - da.haber)
                      WHEN pc.tipo = 'EGRESO' THEN -ABS(da.haber - da.debe) ELSE 0 END), 0) AS resultado,

    -- Eficiencia del centro
    CASE
        WHEN COALESCE(SUM(CASE WHEN pc.tipo = 'INGRESO' THEN ABS(da.debe - da.haber) ELSE 0 END), 0) > 0 THEN
            COALESCE(SUM(CASE WHEN pc.tipo = 'INGRESO' THEN ABS(da.debe - da.haber)
                              WHEN pc.tipo = 'EGRESO' THEN -ABS(da.haber - da.debe) ELSE 0 END), 0) /
            COALESCE(SUM(CASE WHEN pc.tipo = 'INGRESO' THEN ABS(da.debe - da.haber) ELSE 0 END), 0) * 100
        ELSE 0
    END AS margenCentro,

    -- Clasificación
    CASE
        WHEN COALESCE(SUM(CASE WHEN pc.tipo = 'INGRESO' THEN ABS(da.debe - da.haber)
                               WHEN pc.tipo = 'EGRESO' THEN -ABS(da.haber - da.debe) ELSE 0 END), 0) > 0 THEN 'RENTABLE'
        WHEN COALESCE(SUM(CASE WHEN pc.tipo = 'INGRESO' THEN ABS(da.debe - da.haber)
                               WHEN pc.tipo = 'EGRESO' THEN -ABS(da.haber - da.debe) ELSE 0 END), 0) = 0 THEN 'EQUILIBRADO'
        ELSE 'NO RENTABLE'
    END AS clasificacion

FROM CentrosCosto cc
LEFT JOIN DetalleAsientos da ON cc.idCentroCosto = da.idCentroCosto AND cc.idEmpresa = da.idEmpresa
LEFT JOIN AsientosContables ac ON da.idAsiento = ac.idAsiento AND da.idEmpresa = ac.idEmpresa
LEFT JOIN PlanCuentas pc ON da.idCuenta = pc.idCuenta AND da.idEmpresa = pc.idEmpresa
WHERE cc.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
  AND ac.periodo LIKE '2025%'
  AND ac.estado = 'CONTABILIZADO'
GROUP BY cc.idCentroCosto, cc.nombre, cc.tipo
ORDER BY resultado DESC;

-- =============================================
-- ANÁLISIS PREDICTIVO Y TENDENCIAS
-- =============================================

-- 12. PREDICCIÓN DE VENTAS (basado en tendencia últimos 6 meses)
SELECT
    'PREDICCIÓN VENTAS' AS analisis,
    'Próximo mes' AS periodo,
    AVG(totalIngresos) AS promedioMensual,
    AVG(totalIngresos) * 1.05 AS prediccionOptimista,
    AVG(totalIngresos) * 0.95 AS prediccionConservadora,

    -- Tendencia
    CASE
        WHEN AVG(totalIngresos) > AVG(LAG(totalIngresos) OVER (ORDER BY periodo)) THEN 'CRECIENTE'
        WHEN AVG(totalIngresos) < AVG(LAG(totalIngresos) OVER (ORDER BY periodo)) THEN 'DECRECIENTE'
        ELSE 'ESTABLE'
    END AS tendencia,

    -- Estacionalidad estimada
    MONTH(GETDATE()) AS mesActual,
    CASE MONTH(GETDATE())
        WHEN 12 THEN 'ALTA (Fin de año)'
        WHEN 1 THEN 'BAJA (Inicio año)'
        WHEN 6 THEN 'MEDIA (Mitad año)'
        WHEN 7 THEN 'MEDIA (Vacaciones)'
        ELSE 'NORMAL'
    END AS estacionalidad

FROM vw_EstadoResultados
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
  AND periodo >= FORMAT(DATEADD(MONTH, -6, GETDATE()), 'yyyyMM');

-- 13. ANÁLISIS DE PUNTO DE EQUILIBRIO
SELECT
    'PUNTO EQUILIBRIO' AS analisis,
    periodo,
    totalIngresos AS ventasReales,
    costoVentas,
    gastosFijos,
    gastosVariables,
    CASE
        WHEN (totalIngresos - costoVentas - gastosVariables) <> 0 THEN
            gastosFijos / ((totalIngresos - costoVentas - gastosVariables) / totalIngresos)
        ELSE 0
    END AS puntoEquilibrioEstimado,

    -- Margen de seguridad
    CASE
        WHEN (totalIngresos - costoVentas - gastosVariables) <> 0 THEN
            ((totalIngresos - (gastosFijos / ((totalIngresos - costoVentas - gastosVariables) / totalIngresos))) / totalIngresos) * 100
        ELSE 0
    END AS margenSeguridad,

    -- Riesgo operativo
    CASE
        WHEN totalIngresos > CASE WHEN (totalIngresos - costoVentas - gastosVariables) <> 0 THEN
                                    gastosFijos / ((totalIngresos - costoVentas - gastosVariables) / totalIngresos)
                                 ELSE 0 END THEN 'SUPERÁVIT'
        ELSE 'DÉFICIT'
    END AS situacionOperativa

FROM (
    SELECT
        periodo,
        totalIngresos,
        costoVentas,
        gastosAdministracion + gastosVentas AS gastosFijos,
        0 AS gastosVariables -- Aproximación, se puede refinar
    FROM vw_EstadoResultados
    WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
) pe
ORDER BY periodo DESC;

-- =============================================
-- DIAGNÓSTICO FINANCIERO COMPLETO
-- =============================================

-- 14. DIAGNÓSTICO EJECUTIVO (resumen completo)
SELECT
    'DIAGNÓSTICO FINANCIERO COMPLETO' AS reporte,
    GETDATE() AS fechaAnalisis,
    e.nombreComercial AS empresa,
    '202501' AS periodoAnalizado, -- Último período disponible

    -- Situación financiera general
    CASE
        WHEN rl.liquidezCorriente >= 2.0 AND rr.margenNeto >= 10 AND rot.cicloConversionEfectivo <= 60 THEN 'EXCELENTE'
        WHEN rl.liquidezCorriente >= 1.5 AND rr.margenNeto >= 5 AND rot.cicloConversionEfectivo <= 90 THEN 'BUENA'
        WHEN rl.liquidezCorriente >= 1.0 OR rr.margenNeto >= 2 THEN 'ACEPTABLE'
        ELSE 'REQUIERE ATENCIÓN'
    END AS saludFinanciera,

    -- Recomendaciones principales
    CASE
        WHEN rl.liquidezCorriente < 1.5 THEN 'MEJORAR LIQUIDEZ: Cobrar cuentas por cobrar, reducir inventarios'
        WHEN rr.margenNeto < 5 THEN 'AUMENTAR RENTABILIDAD: Revisar precios, reducir costos'
        WHEN rot.cicloConversionEfectivo > 90 THEN 'OPTIMIZAR CICLO: Mejorar gestión inventarios y cobros'
        ELSE 'MANTENER ESTRATEGIAS ACTUALES'
    END AS recomendacionesPrincipales,

    -- KPIs críticos
    rl.liquidezCorriente,
    rr.margenNeto,
    rot.cicloConversionEfectivo,
    rr.ROE,

    -- Alertas específicas
    CASE WHEN rl.liquidezCorriente < 1.0 THEN 'CRÍTICO: Riesgo de insolvencia' ELSE 'OK' END AS alertaLiquidez,
    CASE WHEN rr.margenNeto < 2 THEN 'CRÍTICO: Rentabilidad insuficiente' ELSE 'OK' END AS alertaRentabilidad,
    CASE WHEN rot.periodoMedioCobro > 90 THEN 'CRÍTICO: Cobros muy lentos' ELSE 'OK' END AS alertaCobros,
    CASE WHEN rl.endeudamientoTotal > 0.7 THEN 'CRÍTICO: Alto endeudamiento' ELSE 'OK' END AS alertaEndeudamiento

FROM Empresas e
CROSS JOIN (
    SELECT TOP 1 * FROM vw_RatiosLiquidez
    WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
    ORDER BY periodo DESC
) rl
CROSS JOIN (
    SELECT TOP 1 * FROM vw_RatiosRentabilidad
    WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
    ORDER BY periodo DESC
) rr
CROSS JOIN (
    SELECT TOP 1 * FROM vw_RatiosRotacion
    WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
    ORDER BY periodo DESC
) rot
WHERE e.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E';

PRINT 'Análisis financiero completado. Revisa los resultados para evaluar la salud financiera de tu empresa.';
GO