# Pruebas Escenario 2: Creación de producto y registro de compra

Este documento describe cómo probar el flujo completo de **registro manual de compra**: creación de producto (si es nuevo) y registro de compra con detalle.

## Requisitos previos

- Backend en ejecución (puerto 3000).
- Frontend Angular en ejecución.
- Usuario autenticado (empresa o colaborador) con acceso a Compras.
- Empresa con al menos: una sucursal, comprobantes, moneda, estado de pago, medio de pago, categoría, presentación (y opcionalmente marcas).

## Flujo a probar

### 1. Acceso a la pantalla

1. Iniciar sesión en la aplicación.
2. Ir a **Compras** → **Nueva compra** (o ruta equivalente que lleve a `create-compras`).
3. En la pantalla inicial de "Consulta de Comprobantes SUNAT", hacer clic en **Registro manual** para entrar al formulario manual.

### 2. Completar cabecera de la compra

1. **Proveedor**
   - Ingresar RUC o DNI del proveedor y pulsar **Buscar**.
   - Si no existe, usar **Nuevo** para crear el proveedor.
   - Verificar que se muestre el nombre del proveedor.

2. **Comprobante y fechas**
   - Seleccionar **Comprobante** (ej. Factura).
   - Ingresar **Serie** (ej. F001) y **Número** (ej. 00000001).
   - Ingresar **Fecha de emisión** y **Fecha de vencimiento**.
   - Seleccionar **Moneda**, **Estado de pago**, **Medios de pago**.
   - Seleccionar **Sucursal** (donde se registrará el stock).
   - Opcional: CompRelacionado.

### 3. Agregar detalle: producto nuevo

1. Una vez visible la tabla de búsqueda de productos, hacer clic en **Crear producto**.
2. En el modal **Nuevo Producto**:
   - Marcar "Usar correlativo" si aplica.
   - **Código** (obligatorio).
   - **Marca** (o **Nueva** si no existe).
   - **Categoría** (o **Nueva** si no existe).
   - **Descripción** (obligatorio).
   - **Presentación** (obligatorio).
   - **Precio unitario**, **Cantidad**.
   - Opcional: Fechas de producción/vencimiento, **Sucursal**, **Ubicación**.
3. Pulsar **Agregar**.
4. Comprobar que el producto aparece en la tabla de detalle de la compra.

### 4. Agregar detalle: producto existente (opcional)

1. En el cuadro de búsqueda, escribir descripción o código del producto.
2. Pulsar **Buscar**.
3. Seleccionar un producto de la tabla y agregarlo al detalle (según el flujo del componente).
4. Verificar que el ítem se añade con cantidad, precio y total.

### 5. Registrar la compra

1. Revisar que **Subtotal**, **IGV** y **Total** se actualicen correctamente (o completar observaciones si aplica).
2. Pulsar el botón **Registrar compra** (o equivalente).
3. **Resultado esperado**:
   - Para ítems con **producto nuevo**: el backend crea el producto, luego crea el detalle de compra (flujo en serie dentro de `forkJoin`).
   - Para ítems con **producto existente**: el backend actualiza el producto (si aplica) y luego crea el detalle de compra (flujo integrado en `forkJoin`).
   - Mensaje de éxito y redirección a la lista de compras.

### 6. Verificación en backend/base de datos

- **Tabla Compras**: nueva fila con la cabecera (proveedor, comprobante, fechas, total, etc.).
- **Tabla DetalleCompras** (o equivalente): una fila por cada ítem, vinculada a la compra y al producto.
- **Tabla Productos**: si se creó producto nuevo, una nueva fila con código, descripción, categoría, etc.
- **Stock/Lotes** (según modelo): actualización de stock por sucursal para los productos del detalle.

## Endpoints implicados

| Acción              | Método | Ruta           | Controlador                          |
|---------------------|--------|----------------|--------------------------------------|
| Crear compra        | POST   | `/api/compras` | comprasController.crear_compra       |
| Crear detalle       | POST   | `/api/dcompras`| dcomprasController.crear_detalle_...  |
| Crear producto      | POST   | `/api/productos`| productosController.crear_producto  |
| Actualizar producto | PUT    | `/api/productos/:id` | productosController.actualizar_producto |

Todas las rutas requieren autenticación (`auth.auth`).

## Posibles errores

- **401**: Token expirado o no enviado. Volver a iniciar sesión.
- **400/422**: Validación (campos obligatorios, formato). Revisar mensaje en respuesta y en toast.
- **500**: Error de negocio o BD. Revisar logs del backend (`console.error`) y tablas (proveedor, comprobante, sucursal, categoría, presentación existentes).

## Resumen del flujo en código (Escenario 2)

- `registrarCompras()`:
  1. Valida campos obligatorios.
  2. Llama a `crear_compra` (cabecera).
  3. Para cada ítem del detalle:
     - Si **no** tiene `idProducto`: `crearProducto` → con el `id` devuelto, `crear_detalle_compras_idcompra`.
     - Si tiene `idProducto`: `actualizarProducto` → luego `crear_detalle_compras_idcompra`.
  4. Todas las operaciones por ítem se ejecutan en paralelo con `forkJoin`; la actualización de producto ya no es "fire-and-forget".
  5. Al finalizar, se actualiza el correlativo y se redirige a la lista de compras.
