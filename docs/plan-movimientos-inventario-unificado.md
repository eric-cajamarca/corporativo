# Plan: Movimientos de inventario unificado (tipo factura de compra)

## Objetivo

Tener **un solo componente** con estructura de **factura de compra** (cabecera + detalle) donde un campo **"Tipo de movimiento"** defina si es Inventario inicial, Reajuste, Entrada varia o Salida/Merma. Así se unifica la gestión de ingresos y salidas de mercaderías en una sola pantalla, sin múltiples formularios.

---

## Análisis de las imágenes de referencia

- **Ingresos:** Formulario con **Tipo Ingreso** (COMPRA, INVENTARIO, INVENTARIO INICIAL, REAJUSTE DE STOCK, TRANSFERENCIA ALMACEN, NOTA CREDITO…), Documento (N°, Fecha emisión), Proveedor, Vendedor, Moneda, Flete, Dscto, IGV, Total documento y **Detalle del ingreso** (tabla con ítems: producto, cantidad, precio/costo, importe).
- **Salidas:** Formulario con **Tipo Salida** (VENTA, CONSUMO EN TIENDA, DEVOLUCION, DESCARTE, TRANSFERENCIA ALMACEN, REAJUSTE DE STOCK…), Documento, Cliente, Vendedor y detalle de productos (cantidad, precio, descuento, importe).

Conclusión: se pide **una sola interfaz** similar a factura de compra, con un **selector de tipo de movimiento** (Inventario inicial, Inventario, Reajuste, Salida por merma, etc.) y la misma estructura cabecera + detalle.

---

## Análisis de la base de datos actual

### Tablas relevantes

| Tabla | Uso |
|-------|-----|
| **Compras** | Cabecera de compras (proveedor, comprobante, totales). Solo para compras con proveedor. |
| **DetalleCompras** | Líneas de compra (producto, cantidad, pUnitario, total). Origen de creación de Lotes en compras. |
| **MovimientosInventario** | En el proyecto se usa como **cabecera** (sin idProducto/cantidad): idEmpresa, idSucursal, tipoMovimiento ('EN','SA','AJ','TR'), docRelacionado, idUsuario, observaciones. |
| **MovimientosDetalle** | Detalle por ítem: idMovimiento, idProducto, cantidad, tipo ('ENTRADA'|'SALIDA'|'AJUSTE'). |
| **Lotes** | Stock por producto/sucursal (costoUnitario, cantidadDisponible, numeroLote, fechaVencimiento). |
| **LotesUbicacion** | Desglose por ubicación cuando aplica. |

En `base_datos_mejorada.sql`, `MovimientosInventario` aparece con idProducto/cantidad a nivel cabecera; en el código real (p. ej. transferencia) se usa **solo cabecera + MovimientosDetalle**. El plan asume este modelo: **cabecera + detalle**.

### Tipos de movimiento en BD

- **EN** = Entrada (inventario inicial, entrada varia).
- **SA** = Salida (merma, descarte, consumo, etc.).
- **AJ** = Ajuste (reajuste positivo o negativo).
- **TR** = Transferencia (se puede dejar en flujo aparte o integrar después).

---

## Opción recomendada: un solo formulario “Movimiento de inventario”

### Idea central

- **Un único formulario** en el frontend con la **misma estructura que la factura de compra**: cabecera (fecha, documento, sucursal, tipo de movimiento, opcional proveedor/cliente, moneda, totales) y **Detalle del movimiento** (tabla de ítems: producto, cantidad, precio/costo, importe).
- Un campo **“Tipo de movimiento”** (dropdown) con opciones que determinan si es entrada o salida y si se crean/compras o solo movimientos:

  - **Inventario inicial** → entrada (EN), crea Lotes, no usa Compras.
  - **Reajuste de stock (positivo)** → ajuste (AJ), suma en Lotes.
  - **Reajuste de stock (negativo)** → ajuste (AJ), resta en Lotes (validar stock).
  - **Entrada varia** → entrada (EN), crea/actualiza Lotes (sin compra).
  - **Salida / Merma** → salida (SA), descuenta de Lotes (merma, descarte, consumo, etc.).

- **Compras con proveedor** pueden seguir en el flujo actual de “Registrar compra” (create-compras) **o** integrarse en el mismo formulario eligiendo tipo “COMPRA” y mostrando Proveedor y comprobante; eso es decisión de producto. El plan se centra en **movimientos que no son compra** (inventario inicial, reajustes, entradas/salidas varias).

---

## 1. Frontend: componente unificado

### 1.1 Estructura del formulario (igual que factura de compra)

**Cabecera**

- **Tipo de movimiento** (obligatorio): lista fija o catálogo.
  - Inventario inicial  
  - Reajuste de stock (positivo)  
  - Reajuste de stock (negativo)  
  - Entrada varia  
  - Salida / Merma (Descarte, consumo, etc.)  
- Sucursal (obligatorio).  
- Fecha de movimiento / Fecha emisión.  
- Documento (opcional): tipo + N° (serie/correlativo) o “Sin documento”.  
- Proveedor o Cliente: opcional; visible según tipo (p. ej. oculto en Inventario inicial).  
- Moneda.  
- Observaciones.  
- Totales: Sub total, Dscto, IGV (si aplica), Total.

**Detalle del movimiento**

- Tabla: ítem, producto (código/descripción), unidad de medida, cantidad, precio/costo unitario, descuento, importe.  
- Botón “+” para agregar línea; búsqueda de producto por código/descripción (como en create-compras).  
- Para **salidas**: validar que cantidad no supere stock disponible (por producto/sucursal).

Comportamiento según **Tipo de movimiento**:

- **Entradas (Inventario inicial, Entrada varia, Reajuste positivo):** cantidad > 0; se permiten costo unitario e importe.  
- **Salidas / Reajuste negativo:** cantidad > 0; el sistema resta del stock; opcional mostrar “stock actual” en la línea.

### 1.2 Rutas y menú

- Una ruta: por ejemplo `inventario/movimiento` o `inventario/ingreso-salida` para este formulario unificado.  
- Un ítem de menú: “Movimientos de inventario” (o “Ingresos y salidas”) que abra este componente.  
- Opcional: mantener “Registrar compra” como pantalla aparte y desde aquí solo tipos “sin compra” (inventario inicial, reajuste, entrada varia, salida).

---

## 2. Backend: una API unificada

### 2.1 Modelo de datos recibido

Ejemplo de body para `POST /api/inventario/movimientos`:

```json
{
  "tipoMovimiento": "INVENTARIO_INICIAL",
  "idSucursal": "uuid",
  "fechaMovimiento": "2026-02-21",
  "docRelacionado": "OPCIONAL",
  "idProveedor": null,
  "idCliente": null,
  "idMoneda": 1,
  "observaciones": "",
  "items": [
    {
      "idProducto": "uuid",
      "cantidad": 10,
      "costoUnitario": 5.00,
      "fechaVencimiento": null,
      "numeroLote": null
    }
  ]
}
```

`tipoMovimiento` en frontend: `INVENTARIO_INICIAL` | `REAJUSTE_POSITIVO` | `REAJUSTE_NEGATIVO` | `ENTRADA_VARIA` | `SALIDA_MERMA`.  
En backend se traduce a:

- EN → Inventario inicial, Entrada varia, Reajuste positivo (si se implementa como entrada).  
- SA → Salida/Merma.  
- AJ → Reajuste (positivo = suma en Lotes, negativo = resta en Lotes).

### 2.2 Lógica del servicio (inventario.service)

- Validar `tipoMovimiento`, `idSucursal` e ítems.  
- Traducir `tipoMovimiento` del frontend a `tipoMovimiento` BD (EN/SA/AJ).  
- En una **transacción**:
  1. Insertar cabecera en **MovimientosInventario** (idEmpresa desde token, idSucursal, tipoMovimiento, docRelacionado, idUsuario, observaciones).  
  2. Para cada ítem:
     - **Entradas (EN):** crear o actualizar **Lotes** (y opcional **LotesUbicacion**), insertar línea en **MovimientosDetalle** (tipo ENTRADA).  
     - **Salidas (SA):** validar stock con `stockService.obtenerStockDisponible`, descontar con `stockService.descontarDesdeLotes` (respetando `INVENTARIO_CONTROL_UBICACIONES`), insertar en **MovimientosDetalle** (tipo SALIDA).  
     - **Ajustes (AJ):** sumar o restar en **Lotes** (y LotesUbicacion si aplica); si es resta, validar stock; insertar en **MovimientosDetalle** (tipo AJUSTE).  
- No tocar **Compras** ni **DetalleCompras** cuando el tipo sea inventario inicial, reajuste, entrada varia o salida.

### 2.3 Repositorio

- Reutilizar/crear en `inventario.repository`:  
  - Crear cabecera en MovimientosInventario.  
  - Insertar líneas en MovimientosDetalle.  
  - Crear/actualizar Lotes (entradas) y descontar Lotes (salidas) usando la misma lógica que ya se usa en compras y transferencias (o stock.repository).

### 2.4 Rutas

- `POST /api/inventario/movimientos` → registrar cualquier tipo (inventario inicial, reajuste, entrada varia, salida).  
- `GET /api/inventario/movimientos` (o `/historial`) → listar movimientos con filtros (fecha, sucursal, tipo).  
- Opcional: `GET /api/inventario/tipos-movimiento` → devolver lista de tipos para el dropdown (desde constante o tabla).

---

## 3. Base de datos

### 3.1 Sin cambios obligatorios

- **MovimientosInventario** (cabecera) + **MovimientosDetalle** (líneas) ya soportan EN/SA/AJ.  
- **Lotes** y **LotesUbicacion** ya existen.  
- No es estrictamente necesario crear nuevas tablas.

### 3.2 Opcional: catálogo de tipos

Si se quiere que el “Tipo de movimiento” sea configurable y multidioma:

- Tabla **TipoMovimientoInventario** (o similar):  
  - id, descripcion, codigo (INVENTARIO_INICIAL, REAJUSTE_POSITIVO, etc.), tipoBD ('EN'|'SA'|'AJ'), esEntrada (bit), activo.  
- El frontend consume `GET /api/inventario/tipos-movimiento` y el backend traduce `codigo` → tipo BD.

Si no se usa tabla, basta con un objeto/mapa en backend y un array constante en frontend para el dropdown.

---

## 4. Flujo resumido

1. Usuario abre **un solo formulario** “Movimiento de inventario” (vista tipo factura de compra).  
2. Elige **Tipo de movimiento**: Inventario inicial, Reajuste (positivo/negativo), Entrada varia o Salida/Merma.  
3. Completa sucursal, fecha, documento (opcional), observaciones y totales si aplica.  
4. Carga el **detalle** con productos, cantidades y precios/costos.  
5. Al guardar, el backend con un único endpoint:
   - Crea cabecera en MovimientosInventario.  
   - Por cada ítem: actualiza Lotes (entrada/ajuste positivo), des cuenta Lotes (salida/ajuste negativo) y registra MovimientosDetalle.  
6. Con esto se **unifica la gestión de ingresos y salidas** en una sola pantalla y un solo flujo, sin pantallas distintas para “inventario inicial”, “ajustes” y “salidas”.

---

## 5. Comparación con la implementación anterior

| Antes (revertido) | Con este plan |
|-------------------|----------------|
| Varios componentes: inventario-inicial, ajustes, salidas-mermas, historial, conteo. | Un solo componente “Movimiento de inventario” (tipo factura de compra). |
| Varias rutas y endpoints. | Una ruta de formulario y un endpoint principal `POST /api/inventario/movimientos`. |
| Sin campo “tipo de movimiento” visible como en las imágenes. | Campo “Tipo de movimiento” (Inventario inicial, Reajuste, Entrada varia, Salida/Merma) como en las imágenes. |
| Flujo fragmentado. | Un único flujo para ingresos y salidas de mercaderías. |

---

## 6. Orden sugerido de implementación

1. **Backend**  
   - Definir `tipoMovimiento` frontend → EN/SA/AJ.  
   - Implementar `POST /api/inventario/movimientos` (repositorio + servicio + controlador) con la lógica unificada (cabecera + detalle, Lotes, MovimientosDetalle).  
   - Opcional: `GET /api/inventario/tipos-movimiento` y/o `GET /api/inventario/movimientos` para historial.

2. **Frontend**  
   - Crear (o adaptar) un **solo** componente “Movimiento de inventario” con:
     - Cabecera: Tipo de movimiento, Sucursal, Fecha, Documento, Observaciones, totales.  
     - Detalle: tabla de ítems como en create-compras (producto, cantidad, precio/costo, importe).  
   - Conectar al `POST /api/inventario/movimientos` según el tipo elegido.  
   - Ajustar menú y ruta (una entrada “Movimientos de inventario”).

3. **Opcional**  
   - Catálogo en BD para tipos de movimiento.  
   - Integrar “Compras” en el mismo formulario con tipo “COMPRA” (proveedor + comprobante) si se desea todo en una sola pantalla.

Con este plan, el componente de inventario inicial (y el resto de movimientos) se hace **tal como una factura de compra**, con un campo que indica el **tipo de movimiento**, y se unifica la gestión de ingresos y salidas de mercaderías en la mejor opción posible con la estructura actual de la base de datos.
