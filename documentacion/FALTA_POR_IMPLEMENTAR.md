# Tablas de base_datos_mejorada.sql – Estado de implementación

**Origen:** `respaldo/base_datos_mejorada.sql`  
**Fecha de análisis:** Febrero 2026  
**Stack:** Node.js + Express (puerto 3000) + Angular 17 + SQL Server

---

## 1. Resumen ejecutivo

Del esquema **base_datos_mejorada.sql** se han extraído todas las tablas creadas con `CREATE TABLE`. Para cada una se indica si existe **API (backend)** y **UI (frontend)** en el proyecto actual.

- **Implementado:** hay ruta/controller (y donde aplica, pantalla en adminSPA).
- **Parcial:** solo lecturas, catálogos o uso interno.
- **No implementado:** ninguna ruta ni pantalla dedicada.

---

## 2. Tablas por módulo

### 2.1 Maestras globales (SUNAT)

| Tabla           | Backend     | Frontend | Notas                                      |
|-----------------|------------|----------|--------------------------------------------|
| Documentos      | Sí (documentos) | Sí      | Tipos de documento de identidad.          |
| Presentacion    | Sí (presentacion) | Sí   | Unidades de presentación.                  |
| MediosPago      | Sí (tablasSunat) | Sí   | Catálogo medios de pago.                    |
| Moneda          | Sí (tablasSunat) | Sí   | Catálogo monedas.                          |

### 2.2 Multiempresa – Configuración

| Tabla                | Backend     | Frontend | Notas                                      |
|----------------------|------------|----------|--------------------------------------------|
| Empresas             | Sí (empresa) | Sí     | CRUD empresa.                              |
| DireccionEmpresa     | Sí (empresa) | Sí     | Direcciones de la empresa.                 |
| Gestores_Empresas    | Sí (gestores) | Sí   | Empresas que gestionan otras.              |
| ConfiguracionEmpresa| Sí (gestores) | Parcial | Clave/valor por empresa; usado en gestores. |
| Correlativos         | Uso interno | No      | Numeración por empresa; usado en compras.  |

### 2.3 Usuarios y roles

| Tabla          | Backend   | Frontend | Notas                                      |
|----------------|----------|----------|--------------------------------------------|
| Rol            | Sí (rol) | Sí       | CRUD roles.                                |
| Permisos       | Sí (permisos) | Sí  | Permisos por empresa.                      |
| RolPermisos    | Sí (rol) | Sí       | Asignación permiso–rol.                     |
| UsuarioWeb     | Sí (admin) | Sí    | Colaboradores/usuarios.                    |
| SesionesUsuario| Uso interno | No    | Tokens/sesiones; solo auth.                 |

### 2.4 Catálogos por empresa

| Tabla      | Backend    | Frontend | Notas              |
|------------|-----------|----------|--------------------|
| Categorias | Sí (categoria) | Sí | Categorías de productos. |
| Marcas     | Sí (marcas) | Sí     | Marcas.            |
| Impuestos  | Sí (impuestos) | Sí   | IGV, exonerado, etc. |

### 2.5 Clientes y proveedores

| Tabla             | Backend  | Frontend | Notas                    |
|-------------------|----------|----------|--------------------------|
| Clientes          | Sí (clientes) | Sí | CRUD clientes.           |
| DireccionClientes| Sí (direccionClientes) | Sí | Direcciones cliente. |
| Proveedores       | Sí (proveedores) | Sí | CRUD proveedores.        |
| DireccionProveedor| Sí (proveedores) | Sí | Direcciones proveedor.   |

### 2.6 Sucursales y stock

| Tabla              | Backend | Frontend | Notas                                                         |
|--------------------|---------|----------|----------------------------------------------------------------|
| Sucursal           | Sí (sucursal) | Sí | CRUD sucursales.                                              |
| UsuarioSucursal    | Sí (usuarioSucursal) | Sí | Asignación usuario–sucursal.                          |
| Productos          | Sí (productos) | Sí | CRUD productos.                                              |
| ProductosCompuestos| Sí (productoCompuesto) | Sí | Productos compuestos.                                |
| StockSucursal      | Parcial | No       | Código comentado en ventas/sucursal; no hay CRUD dedicado.    |
| Lotes              | Sí (lotes) | Sí   | Lotes por producto/sucursal.                                  |
| UbicacionesPrioridad| Sí (ubicacionesPrioridad) | Sí | Prioridad de ubicación.                    |
| LotesUbicacion     | Sí (lotesUbicacion) | Sí | Cantidad por lote/ubicación.                        |

### 2.7 Precios y listas

| Tabla          | Backend  | Frontend | Notas              |
|----------------|----------|----------|--------------------|
| ListasPrecio   | Sí (preciosV) | Sí | Listas de precio.  |
| PreciosProducto| Sí (preciosV) | Sí | Precio por producto/lista. |

### 2.8 Comprobantes y secuencias

| Tabla        | Backend       | Frontend | Notas                          |
|--------------|---------------|----------|--------------------------------|
| Comprobantes | Sí (comprobantes) | Sí | Tipos de comprobante.          |
| Secuencias   | Uso interno   | No      | Numeración por sucursal/comprobante (empresa.service). |
| EstadoPago   | Sí (tablasSunat) | Sí   | Catálogo; usado en compras.    |

### 2.9 Compras

| Tabla           | Backend  | Frontend | Notas        |
|-----------------|----------|----------|-------------|
| Compras         | Sí (compras) | Sí | Cabecera compras. |
| DetalleCompras  | Sí (dcompras) | Sí | Detalle compras.  |

### 2.10 Ventas

| Tabla               | Backend     | Frontend | Notas                                      |
|---------------------|------------|----------|--------------------------------------------|
| Ventas              | Sí (cventas) | Sí     | Cabecera ventas.                           |
| DetalleVenta        | Sí (detalleventas) | Sí | Detalle venta.                    |
| DetalleVentaEntrega | No         | No       | Entregas parciales por ítem; sin API/UI.    |
| EstadosPedidos      | Parcial    | Parcial  | Usado en programación; no CRUD dedicado.   |

### 2.11 Movimientos e inventario

| Tabla                  | Backend       | Frontend | Notas                          |
|------------------------|---------------|----------|--------------------------------|
| TiposMovimiento        | Parcial (catalogos) | Sí | CatalogoTipoMovimiento en migración distinta. |
| MovimientosInventario  | Sí (transferencia) | Sí | Transferencias/ajustes.        |

### 2.12 Auditoría

| Tabla           | Backend | Frontend | Notas                                   |
|-----------------|---------|----------|-----------------------------------------|
| AuditoriaUsuario| No      | No       | Login/acciones; no hay consulta/visor.   |

### 2.13 Caja

| Tabla                | Backend | Frontend | Notas                                      |
|----------------------|---------|----------|--------------------------------------------|
| TiposMovimientoCaja  | Sí (caja) | Sí     | CRUD tipos ingreso/egreso.                  |
| Cajas                | Sí (caja) | Sí     | CRUD cajas.                                 |
| AperturasCaja        | Sí (caja) | Sí     | Apertura de caja.                           |
| CierresCaja          | Sí (caja) | Sí     | Cierre y arqueo.                            |
| MovimientosCaja      | Sí (caja) | Sí     | Ingresos/egresos; FK a `Concepto` (catálogos definidos en el mismo `respaldo/base_datos_mejorada.sql` antes de esta tabla). |
| FormasPago           | Sí (catalogos + documentos) | Sí | Catálogo formas de pago.        |

### 2.14 Cuentas por cobrar

| Tabla            | Backend   | Frontend | Notas        |
|------------------|-----------|----------|-------------|
| CreditosClientes | Sí (creditos) | Sí | Créditos a clientes. |
| CuotasCredito    | Sí (creditos) | Sí | Cuotas.     |
| PagosCuotas      | Sí (creditos) | Sí | Pagos de cuotas. |

### 2.15 Despachos

| Tabla           | Backend    | Frontend | Notas                    |
|-----------------|------------|----------|--------------------------|
| TiposDespacho   | Sí (despachos) | Sí | GET tipos.               |
| Despachos       | Sí (despachos) | Sí | CRUD despachos.         |
| DetalleDespachos| Sí (despachos) | Sí | Detalle por producto.   |

### 2.16 Envíos y delivery

| Tabla                 | Backend  | Frontend | Notas                |
|-----------------------|----------|----------|----------------------|
| TiposEnvio            | Sí (envios) | Sí   | GET tipos.           |
| EstadosEnvio          | Sí (envios) | Sí   | GET estados.         |
| Transportistas        | Sí (envios) | Sí   | CRUD transportistas. |
| Envios                | Sí (envios) | Sí   | CRUD envíos.         |
| HistorialEstadosEnvio | Uso interno | No  | Cambios de estado.   |

### 2.17 Cotizaciones

| Tabla             | Backend       | Frontend | Notas   |
|-------------------|---------------|----------|--------|
| Cotizaciones      | Sí (cotizaciones) | Sí | Cabecera. |
| DetalleCotizacion | Sí (cotizaciones) | Sí | Detalle. |

### 2.18 Facturación electrónica

| Tabla                              | Backend       | Frontend | Notas        |
|------------------------------------|---------------|----------|-------------|
| EstadosSunat                       | Sí (facturacion) | Sí   | GET estados. |
| ComprobantesElectronicos           | Sí (facturacion) | Sí   | Envío/consulta. |
| ConfiguracionFacturacionElectronica| Sí (facturacion) | Sí | Config por empresa. |

### 2.19 Sistema contable y financiero – NO IMPLEMENTADO

| Tabla               | Backend | Frontend | Notas                    |
|---------------------|---------|----------|--------------------------|
| ConfiguracionContable | No   | No       | Moneda, período, etc.    |
| PlanCuentas         | No      | No       | Plan contable.           |
| CentrosCosto        | No      | No       | Centros de costo.       |
| PeriodosContables   | No     | No       | Apertura/cierre períodos.|
| AsientosContables   | No     | No       | Asientos.                |
| DetalleAsientos     | No     | No       | Líneas del asiento.      |
| CuentasBancarias    | No     | No       | Cuentas bancarias.       |
| MovimientosBancarios| No     | No       | Depósitos/retiros.       |
| ActivosFijos        | No     | No       | Inmovilizado.            |
| DepreciacionActivos | No     | No       | Depreciación.            |
| Presupuestos        | No     | No       | Presupuestos.            |
| DetallePresupuestos | No     | No       | Detalle presupuesto.    |

---

## 3. Tablas que faltan por implementar (resumen)

### Sin API ni UI

1. **DetalleVentaEntrega** – Entregas parciales por ítem de venta.  
2. **AuditoriaUsuario** – Registro de acciones; no hay visor ni filtros.  
3. **ConfiguracionContable** – Config contable por empresa.  
4. **PlanCuentas** – Plan de cuentas.  
5. **CentrosCosto** – Centros de costo.  
6. **PeriodosContables** – Períodos (apertura/cierre).  
7. **AsientosContables** – Asientos contables.  
8. **DetalleAsientos** – Detalle de asientos.  
9. **CuentasBancarias** – Cuentas bancarias.  
10. **MovimientosBancarios** – Movimientos bancarios.  
11. **ActivosFijos** – Activos fijos.  
12. **DepreciacionActivos** – Depreciación.  
13. **Presupuestos** – Presupuestos.  
14. **DetallePresupuestos** – Detalle presupuesto.

### Parcial o solo uso interno

- **StockSucursal** – Sin CRUD dedicado; lógica comentada.  
- **SesionesUsuario** – Solo auth.  
- **Correlativos / Secuencias** – Uso interno.  
- **HistorialEstadosEnvio** – Uso interno en envíos.

---

## 4. Errores / advertencias en el script SQL

1. **MovimientosCaja (líneas 1087–1088)** — **CORREGIDO**  
   Se añadió la coma entre `idConcepto UNIQUEIDENTIFIER NULL` y `concepto VARCHAR(100)` en `respaldo/base_datos_mejorada.sql`. La FK a `Concepto(idConcepto)` exige que la tabla `Concepto` exista; en el esquema unificado los catálogos (incl. `Concepto`) se crean antes de `MovimientosCaja` en el mismo archivo.

2. **Cotizaciones**  
   FK a `idCondicionPago` sin tabla `CondicionPago` en el script. Revisar si existe en otra migración o si debe eliminarse la FK.

---

## 5. Recomendaciones prioritarias

### Corto plazo (operación y trazabilidad)

1. **AuditoriaUsuario** — **IMPLEMENTADO**  
   Endpoint `GET /api/auditoria` con filtros (accion, fechaDesde, fechaHasta, pagina, porPagina) y pantalla “Log de auditoría” en Configuración → Log de auditoría (`/auditoria`), solo lectura.

2. **DetalleVentaEntrega** — **IMPLEMENTADO**  
   API: `GET /api/ventas/:idVenta/entregas`, `POST /api/ventas/entregas` (idVenta, idDetalle, cantidad, notas). UI: en Detalle de venta se muestra tabla de entregas y formulario para registrar entrega parcial por ítem; se actualiza cantEntregada en DetalleVenta.

3. **StockSucursal**  
   **No se utiliza:** el sistema usa la tabla **Lotes** para el control de stock. La tabla StockSucursal no debe implementarse; se mantiene en el esquema por compatibilidad o referencia. No descomentar lógica que dependa de StockSucursal.

4. **Corregir script MovimientosCaja**  
   Añadir la coma y alinear la FK a `Concepto` con el orden de ejecución de migraciones (o hacer `idConcepto` nullable sin FK hasta tener la tabla).

### Medio plazo (módulo contable)

5. **Contabilidad básica**  
   Si el negocio requiere contabilidad:  
   - ConfiguracionContable y PeriodosContables (apertura/cierre).  
   - PlanCuentas (alta/baja de cuentas, jerarquía).  
   - AsientosContables + DetalleAsientos (origen: VENTA, COMPRA, CAJA, MANUAL), con validación totalDebe = totalHaber.  
   Priorizar integración con Ventas, Compras y Caja para generar asientos automáticos.

6. **Bancos**  
   Si se necesita control de cuentas bancarias: CuentasBancarias y MovimientosBancarios, con posible enlace a AsientosContables para conciliación.

### Largo plazo (opcional)

7. **Activos fijos y presupuestos**  
   ActivosFijos, DepreciacionActivos, Presupuestos y DetallePresupuestos son módulos grandes; implementar solo si hay requisito explícito y después de tener contabilidad básica estable.

8. **Seguridad y multiempresa**  
   - Revisar que todas las consultas que toquen tablas por empresa filtren por `idEmpresa` extraído del token (nunca del body).  
   - Mantener middleware de auth en todas las rutas `/api/*` (excepto login y las que se definan como públicas).  
   - No confiar en `idEmpresa` enviado por el frontend; sobrescribir con `req.user.empresa`.

9. **Consistencia**  
   - Unificar uso de MediosPago vs FormasPago según diseño (ventas/compras vs caja).  
   - Mantener fechas formateadas en repositorios (p. ej. `CONVERT(VARCHAR(19), fecha, 120)`) y tipos correctos (UniqueIdentifier, Decimal(18,6) para montos).

---

## 6. Dependencias entre scripts

- **respaldo/base_datos_mejorada.sql** define en orden los catálogos de caja (Concepto, ClasificacionConcepto, CatalogoTipoMovimiento, MotivoTraslado, MotivoNotaCredito) antes de **MovimientosCaja**.
- Instalación desde cero: **respaldo/instalar_base_completa.sql** (sqlcmd). Cambios posteriores al esquema unificado: **backAppC/migrations/** (incrementales).

---

*Documento generado a partir de la revisión de `respaldo/base_datos_mejorada.sql` y del código en `backAppC` y `adminSPA`.*
