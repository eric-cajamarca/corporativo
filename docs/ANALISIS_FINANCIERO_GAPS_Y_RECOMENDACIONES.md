# Análisis financiero: qué falta para que sea real y 100% óptimo

Revisión a fondo de la estructura del sistema (backend, BD, frontend) para identificar datos y funcionalidades pendientes.

---

## 1. Lo que ya está implementado y de dónde sale

| Módulo | Fuente de datos actual | Tablas usadas |
|--------|------------------------|---------------|
| **Dashboard** | Repositorio operativo (fallback si no hay vistas contables) | Ventas, DetalleVenta, Lotes, CuotasCredito |
| **Balance general** | Inventario + CxC; pasivo = 0 hoy | Lotes, CuotasCredito |
| **Estado de resultados** | Ingresos y costo de ventas por mes | Ventas, DetalleVenta |
| **Ratios** | Derivados de balance y estado (operativo) | Lotes, CuotasCredito, Ventas, DetalleVenta |
| **Diagnóstico** | Calculado a partir de los ratios anteriores | — |

**Vistas contables (opcional):** Si existen PlanCuentas, AsientosContables, DetalleAsientos, PeriodosContables y las vistas de `Query/sjb/analisis_financiero.sql`, el sistema intenta usarlas primero y solo hace fallback al análisis operativo.

---

## 2. Datos que faltan registrar o completar

### 2.1 Costo en detalle de venta (crítico)

- **Tabla:** `DetalleVenta`
- **Columnas:** `costoUnitario`, `costoTotal` (migración `add_costos_detalle_venta.sql`).
- **Problema:** Si no se llenan al registrar la venta, el **costo de ventas** y la **utilidad bruta** del análisis serán 0 o incorrectos.
- **Acción:**
  - Al guardar una venta, calcular y persistir `costoUnitario` y `costoTotal` por línea (desde Lotes/Kardex o costo del producto).
  - Revisar en el flujo de ventas (backend/front) que estos campos se envíen y se guarden.

### 2.2 Cuentas por cobrar (CxC)

- **Estado:** Ya se usa `CuotasCredito.saldoPendiente` (PENDIENTE/VENCIDO) para CxC en balance y dashboard.
- **Recomendación:** Asegurar que cada venta a crédito genere registros en `CreditosClientes` y `CuotasCredito` y que los cobros actualicen `saldoPendiente` y estado de la cuota.

### 2.3 Cuentas por pagar (CxP) — no usadas hoy

- **Tabla:** `Compras`
- **Campos:** `idEstadoPago`, `total`, `idEmpresa`
- **Estado en análisis:** En el repositorio operativo, `cuentasPorPagar` y `pasivoCorriente` están fijos en **0**.
- **Acción:** Calcular CxP como suma de compras pendientes de pago, por ejemplo:
  - `SUM(Compras.total) WHERE idEmpresa = @idEmpresa AND idEstadoPago = 1` (Pendiente).
- **Registro:** Registrar correctamente en compras el `idEstadoPago` (1 = Pendiente, 2 = Pagado) al crear/pagar facturas de proveedor.

### 2.4 Efectivo y bancos (no usados en balance)

- **Tablas:** `Cajas`, `AperturasCaja`, `MovimientosCaja`, `TiposMovimientoCaja` (tipo I/E).
- **Estado:** El balance operativo no incluye efectivo; solo inventario + CxC en activo corriente.
- **Acción:** Calcular saldo de caja por empresa (por ejemplo: por cada apertura abierta, `montoInicial + SUM(ingresos) - SUM(egresos)`) y sumarlo al **activo corriente** en el balance operativo.

### 2.5 Gastos operativos (todos en 0 hoy)

- **Estado:** En estado de resultados y dashboard operativos, `gastosOperacion`, `gastosAdministracion`, `gastosVentas`, `gastosFinancieros` y `gastosOperativos` son **0**.
- **Opciones:**

  **A) Sin módulo contable**  
  - Crear tabla de gastos, por ejemplo:
    - `Gastos` (idEmpresa, fecha, tipo: ADMINISTRACION | VENTAS | FINANCIERO, monto, descripcion, idUsuario).
  - Pantalla para cargar gastos (fecha, tipo, monto, descripción) y usar en análisis por período.
  - En estado de resultados: sumar por tipo y período; en utilidad operativa y neta restar estos gastos.

  **B) Usar movimientos de caja (aproximado)**  
  - Sumar egresos de caja del período (`MovimientosCaja` con tipo 'E') como “gastos operativos” totales (sin desglose admin/ventas/financiero) y restarlos de la utilidad para acercar la utilidad neta a la realidad.

  **C) Con módulo contable**  
  - Si se usan las vistas de `analisis_financiero.sql`, los gastos salen de PlanCuentas (EGRESO, subTipo GASTOS_ADMIN, GASTOS_VENTAS, GASTOS_FINANCIEROS) y AsientosContables. No hace falta otra tabla de gastos para el análisis.

### 2.6 Activo fijo (opcional)

- **Estado:** En balance operativo, `activoFijo` = 0.
- **Para empresas que llevan activos:** Crear tabla (por ejemplo `ActivosFijos`: idEmpresa, descripcion, valorInicial, depreciacionAcumulada, fechaAdquisicion) y considerar valor neto en activo no corriente. Si no se usa, dejarlo en 0 es aceptable.

---

## 3. Implementaciones recomendadas en backend (repositorio operativo)

### 3.1 Cuentas por pagar desde Compras

En `analisisOperativo.repository.js`:

- Consultar:
  - `SUM(Compras.total) WHERE idEmpresa = @idEmpresa AND idEstadoPago = 1` (o el id que corresponda a "Pendiente" en tu `EstadoPago`).
- Usar ese valor como `pasivoCorriente` y `cuentasPorPagar` en:
  - Dashboard.
  - Balance general.
  - Ratios (liquidez, endeudamiento).

### 3.2 Efectivo desde caja

- Por empresa: para cada `AperturasCaja` con `estado = 1` (abierta), calcular:
  - `montoInicial + SUM(MovimientosCaja.monto WHERE tipo='I') - SUM(MovimientosCaja.monto WHERE tipo='E')`.
- Sumar todos los saldos de cajas de la empresa e incluir ese total en **activo corriente** (junto a inventario y CxC).

### 3.3 Rotaciones reales (hoy hardcodeadas)

- **Rotación CxC:**  
  - Numerador: ventas a crédito del período (por ejemplo suma de `Ventas.total` con `idEstadoPago = 1` en el período, o suma de `CreditosClientes.montoTotal` con fecha en el período).  
  - Denominador: promedio de CxC (por ejemplo promedio de saldo de `CuotasCredito.saldoPendiente` por mes o saldo al cierre).  
  - `rotacionCuentasCobrar = ventasCreditoPeriodo / promedioCxC`.

- **Rotación CxP:**  
  - Numerador: compras a crédito del período (por ejemplo `SUM(Compras.total)` donde `idEstadoPago = 1` y fecha de emisión en el período, o compras pendientes que se generaron en el período).  
  - Denominador: promedio CxP (por ejemplo promedio de saldo pendiente compras por mes).  
  - `rotacionCuentasPagar = comprasCreditoPeriodo / promedioCxP`.

- **Ciclo de conversión de efectivo:**  
  - Usar las rotaciones reales para calcular días de inventario, días de cobro y días de pago, y luego:  
  - `días inventario + días cobro - días pago`.

### 3.4 Gastos operativos

- Si se implementa tabla **Gastos:** en estado de resultados y dashboard, sumar gastos por período y tipo (admin/ventas/financiero) y restarlos en utilidad operativa y utilidad neta.
- Si se usa solo **MovimientosCaja (egresos):** sumar egresos del período y restarlos como un solo rubro “Gastos operativos” para no dejar utilidad neta igual a utilidad bruta.

---

## 4. Resumen: prioridades para un análisis “ecografía real” y óptimo

| Prioridad | Qué hacer | Dónde |
|-----------|-----------|--------|
| Alta | Asegurar que **DetalleVenta.costoTotal** (y costoUnitario) se llenen en cada venta | Flujo de ventas (backend + front) |
| Alta | Incluir **CxP** en balance y ratios (Compras con idEstadoPago = Pendiente) | analisisOperativo.repository.js |
| Alta | Incluir **efectivo** (saldo cajas) en activo corriente | analisisOperativo.repository.js |
| Media | Registrar **gastos** (tabla Gastos o egresos de caja) y usarlos en estado de resultados y utilidad neta | Nueva tabla + repositorio operativo, o solo caja |
| Media | Calcular **rotaciones reales** de CxC y CxP y ciclo de conversión de efectivo | analisisOperativo.repository.js |
| Baja | Activo fijo (opcional) y depreciación | Tabla opcional + balance |

Con esto, el análisis financiero pasará de depender solo de ventas, inventario y créditos a clientes a una foto más completa: ventas con costo real, CxC, CxP, efectivo, gastos y rotaciones coherentes con los datos que ya registra el sistema.
