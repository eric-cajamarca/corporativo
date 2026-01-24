# 📊 GUÍA COMPLETA - ANÁLISIS FINANCIERO Y RATIOS

## 📋 Tablas Agregadas para Análisis Financiero

### 1. **ConfiguracionContable**
- Configuración específica por empresa
- Moneda funcional, períodos, centros de costo

### 2. **PlanCuentas**
- Plan de cuentas contables jerárquico
- Cuentas de activo, pasivo, patrimonio, ingresos, egresos
- Naturaleza débito/crédito por cuenta

### 3. **CentrosCosto**
- Estructura jerárquica de centros de costos
- Producción, ventas, administración, distribución

### 4. **PeriodosContables**
- Control de períodos mensuales/trimestrales/anuales
- Estados: abierto, cerrado, bloqueado

### 5. **AsientosContables** & **DetalleAsientos**
- Asientos contables con partida doble
- Vinculación con operaciones del sistema
- Origen: venta, compra, caja, inventario, manual

### 6. **CuentasBancarias** & **MovimientosBancarios**
- Conciliación bancaria automática
- Control de saldos por cuenta

### 7. **ActivosFijos** & **DepreciacionActivos**
- Control de activos fijos con depreciación
- Métodos: lineal, decreciente

### 8. **Presupuestos** & **DetallePresupuestos**
- Presupuestos de ingresos y egresos
- Control vs ejecución real

## 📈 RATIOS FINANCIEROS IMPLEMENTADOS

### **RATIOS DE LIQUIDEZ**
```sql
-- Liquidez Corriente = Activo Corriente / Pasivo Corriente
-- > 2.0: Excelente, 1.5-2.0: Bueno, 1.0-1.5: Regular, < 1.0: Crítico

-- Liquidez Ácida = (Activo Corriente - Inventarios) / Pasivo Corriente
-- > 1.0: Bueno, < 1.0: Preocupante

-- Liquidez Inmediata = (Efectivo + Inversiones) / Pasivo Corriente
-- > 0.5: Adecuado
```

### **RATIOS DE SOLVENCIA/ENDEUDAMIENTO**
```sql
-- Endeudamiento Total = Total Pasivo / Total Activo
-- < 0.4: Bajo, 0.4-0.6: Moderado, > 0.6: Alto

-- Endeudamiento Patrimonial = Total Pasivo / Patrimonio
-- < 1.0: Bajo, 1.0-2.0: Moderado, > 2.0: Alto

-- Nivel de Endeudamiento = Pasivo Corriente / Patrimonio
-- < 0.5: Bajo, 0.5-1.0: Moderado, > 1.0: Alto

-- Cobertura de Intereses = Utilidad Operacional / Gastos Financieros
-- > 3.0: Excelente, 2.0-3.0: Bueno, < 2.0: Riesgoso
```

### **RATIOS DE RENTABILIDAD**
```sql
-- Margen Bruto = (Ingresos - Costo Ventas) / Ingresos * 100
-- > 40%: Excelente, 30-40%: Bueno, 20-30%: Regular, < 20%: Bajo

-- Margen Operacional = Utilidad Operacional / Ingresos * 100
-- > 15%: Excelente, 10-15%: Bueno, 5-10%: Regular, < 5%: Bajo

-- Margen Neto = Utilidad Neta / Ingresos * 100
-- > 10%: Excelente, 5-10%: Bueno, 2-5%: Regular, < 2%: Bajo

-- ROA (Return on Assets) = Utilidad Neta / Total Activo * 100
-- > 15%: Excelente, 10-15%: Bueno, 5-10%: Regular, < 5%: Bajo

-- ROE (Return on Equity) = Utilidad Neta / Patrimonio * 100
-- > 20%: Excelente, 15-20%: Bueno, 10-15%: Regular, < 10%: Bajo

-- ROI (Return on Investment) = Utilidad Operacional / (Activo Corriente + Fijo) * 100
```

### **RATIOS DE ROTACIÓN**
```sql
-- Rotación de Inventarios = Costo Ventas / Inventario Promedio
-- > 8: Excelente (rápida rotación), 4-8: Bueno, < 4: Lento

-- Rotación de Cuentas por Cobrar = Ventas Crédito / Cuentas por Cobrar Promedio
-- > 6: Excelente, 4-6: Bueno, < 4: Lento

-- Rotación de Cuentas por Pagar = Compras Crédito / Cuentas por Pagar Promedio
-- > 4: Bueno (paga rápido), < 4: Lento (aprovecha crédito)

-- Período Medio de Cobro = 365 / Rotación Cuentas por Cobrar
-- < 60 días: Excelente, 60-90 días: Bueno, > 90 días: Lento

-- Período Medio de Pago = 365 / Rotación Cuentas por Pagar
-- Negociar mejores plazos si es bajo

-- Ciclo de Conversión de Efectivo = PMC + PMI - PMP
-- < 60 días: Excelente, 60-90 días: Bueno, > 90 días: Mejorar
```

## 📊 VISTAS DISPONIBLES

### **Estados Financieros**
- `vw_BalanceGeneral` - Balance consolidado por período
- `vw_EstadoResultados` - P&L por período
- `vw_FlujoEfectivo` - Flujo de caja por actividades

### **Ratios Financieros**
- `vw_RatiosLiquidez` - Todos los ratios de liquidez
- `vw_RatiosRentabilidad` - Ratios de rentabilidad
- `vw_RatiosRotacion` - Ratios de rotación y eficiencia

### **Análisis de Rentabilidad**
- `vw_RentabilidadProducto` - Margen por producto
- `vw_RentabilidadCategoria` - Margen por categoría
- `vw_DashboardFinanciero` - KPIs principales con alertas

## 🎯 CONSULTAS DE EJEMPLO

### **Dashboard Ejecutivo**
```sql
SELECT * FROM vw_DashboardFinanciero
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY periodo DESC;
```

### **Análisis de Liquidez**
```sql
SELECT periodo, liquidezCorriente, liquidezAcida, endeudamientoTotal,
       CASE WHEN liquidezCorriente < 1.5 THEN 'CRÍTICO' ELSE 'ADECUADO' END AS alerta
FROM vw_RatiosLiquidez
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY periodo DESC;
```

### **Productos Más Rentables**
```sql
SELECT TOP 10 descripcion, margenContribucion, margenPorcentual, rankingRentabilidad
FROM vw_RentabilidadProducto
WHERE periodo = '202501'
ORDER BY margenContribucion DESC;
```

### **Rotación de Inventarios**
```sql
SELECT periodo, rotacionInventarios, periodoMedioCobro, periodoMedioPago, cicloConversionEfectivo
FROM vw_RatiosRotacion
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY periodo DESC;
```

## 📋 INTERPRETACIÓN DE RATIOS

### **Liquidez Corriente**
- **> 2.0**: Excelente capacidad de pago
- **1.5-2.0**: Buena liquidez
- **1.0-1.5**: Liquidez regular, monitorear
- **< 1.0**: Situación crítica, riesgo de insolvencia

### **Endeudamiento Total**
- **< 40%**: Empresa conservadora, bajo riesgo
- **40-60%**: Nivel moderado de endeudamiento
- **> 60%**: Alto endeudamiento, mayor riesgo financiero

### **Margen Neto**
- **> 10%**: Excelente rentabilidad
- **5-10%**: Buena rentabilidad
- **2-5%**: Rentabilidad aceptable
- **< 2%**: Rentabilidad insuficiente

### **ROE**
- **> 20%**: Excelente retorno para accionistas
- **15-20%**: Bueno retorno
- **10-15%**: Retorno aceptable
- **< 10%**: Retorno insuficiente

### **Ciclo de Conversión**
- **< 60 días**: Gestión eficiente del capital de trabajo
- **60-90 días**: Gestión aceptable
- **> 90 días**: Necesita mejorar gestión de inventarios y cobros

## 🔍 ANÁLISIS POR CENTROS DE COSTO

```sql
-- Rentabilidad por centro de costo
SELECT
    cc.nombre AS centroCosto,
    SUM(CASE WHEN pc.tipo = 'INGRESO' THEN da.debe - da.haber ELSE 0 END) AS ingresos,
    SUM(CASE WHEN pc.tipo = 'EGRESO' THEN da.haber - da.debe ELSE 0 END) AS egresos,
    SUM(CASE WHEN pc.tipo = 'INGRESO' THEN da.debe - da.haber
             WHEN pc.tipo = 'EGRESO' THEN -(da.haber - da.debe) ELSE 0 END) AS utilidad
FROM DetalleAsientos da
INNER JOIN PlanCuentas pc ON da.idCuenta = pc.idCuenta AND da.idEmpresa = pc.idEmpresa
INNER JOIN CentrosCosto cc ON da.idCentroCosto = cc.idCentroCosto AND da.idEmpresa = cc.idEmpresa
INNER JOIN AsientosContables ac ON da.idAsiento = ac.idAsiento AND da.idEmpresa = ac.idEmpresa
WHERE ac.periodo = '202501'
  AND ac.estado = 'CONTABILIZADO'
  AND da.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
GROUP BY cc.nombre
ORDER BY utilidad DESC;
```

## 📈 TENDENCIAS Y ANÁLISIS COMPARATIVO

```sql
-- Comparativo mensual de ventas y utilidades
SELECT
    periodo,
    totalIngresos AS ventas,
    utilidadNeta,
    margenNeto,
    LAG(totalIngresos) OVER (ORDER BY periodo) AS ventasMesAnterior,
    LAG(utilidadNeta) OVER (ORDER BY periodo) AS utilidadMesAnterior,
    CASE WHEN LAG(totalIngresos) OVER (ORDER BY periodo) <> 0
         THEN ((totalIngresos - LAG(totalIngresos) OVER (ORDER BY periodo)) / LAG(totalIngresos) OVER (ORDER BY periodo)) * 100
         ELSE 0 END AS crecimientoVentas
FROM vw_EstadoResultados
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY periodo;
```

## 🎯 ACCIONES RECOMENDADAS POR RATIOS

### **Si Liquidez Corriente < 1.5**
- Reducir inventarios innecesarios
- Cobrar cuentas por cobrar más rápido
- Negociar mejores plazos con proveedores
- Obtener financiamiento adicional

### **Si Endeudamiento > 60%**
- Reducir gastos financieros
- Generar más utilidades retenidas
- Vender activos no productivos
- Mejorar el flujo de caja operativo

### **Si Margen Neto < 5%**
- Revisar precios de venta
- Reducir costos variables
- Optimizar gastos administrativos
- Mejorar eficiencia operativa

### **Si ROE < 10%**
- Mejorar rentabilidad del activo
- Optimizar estructura financiera
- Invertir en proyectos rentables
- Mejorar eficiencia operativa

## 📊 REPORTES AVANZADOS

### **Análisis DuPont (ROE Descompuesto)**
```sql
SELECT
    periodo,
    margenNeto AS rentabilidad,
    rotacionActivo AS eficiencia,
    multiplicadorCapital AS apalancamiento,
    (margenNeto * rotacionActivo * multiplicadorCapital) / 10000 AS roe_calculado,
    roe AS roe_real
FROM (
    SELECT
        periodo,
        margenNeto,
        CASE WHEN totalActivo <> 0 THEN totalIngresos / totalActivo ELSE 0 END AS rotacionActivo,
        CASE WHEN patrimonio <> 0 THEN totalActivo / patrimonio ELSE 0 END AS multiplicadorCapital,
        roe
    FROM vw_RatiosRentabilidad rr
    INNER JOIN vw_BalanceGeneral bg ON rr.idEmpresa = bg.idEmpresa AND rr.periodo = bg.periodo
    INNER JOIN vw_EstadoResultados er ON rr.idEmpresa = er.idEmpresa AND rr.periodo = er.periodo
) dupont;
```

### **Punto de Equilibrio**
```sql
SELECT
    periodo,
    totalIngresos,
    costoVentas,
    gastosFijos,
    CASE WHEN (totalIngresos - costoVentas) <> 0
         THEN (gastosFijos / ((totalIngresos - costoVentas) / totalIngresos))
         ELSE 0 END AS puntoEquilibrio
FROM (
    SELECT
        periodo,
        totalIngresos,
        costoVentas,
        gastosAdministracion + gastosVentas AS gastosFijos
    FROM vw_EstadoResultados
    WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
) pe;
```

## 🚀 PRÓXIMAS EXPANSIONES

1. **Análisis Predictivo**: Tendencias y pronósticos
2. **Benchmarking**: Comparación con industria
3. **Análisis de Sensibilidad**: Escenarios what-if
4. **Reportes Automatizados**: Alertas por email
5. **Dashboard Interactivo**: Visualizaciones avanzadas

---

**Sistema completo para análisis financiero integral de la empresa.**
**Ratios automatizados + Estados Financieros + Control Presupuestal + Análisis de Rentabilidad.**