# 🛒 Guía del Módulo de Compras

## Sistema de Gestión de Compras e Inventario

---

## 📋 Requisitos Previos

Antes de registrar compras, asegúrate de tener configurado:

- ✅ Al menos 1 colaborador creado
- ✅ Al menos 1 proveedor registrado
- ✅ Categorías de productos creadas
- ✅ Marcas registradas (opcional)
- ✅ Sucursal activa

---

## 🗄️ Estructura de Base de Datos

### Tabla: Compras

```sql
CREATE TABLE Compras (
    idCompra UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    compCompra VARCHAR(13) NOT NULL,      -- Código de compra
    idComprobante INT NOT NULL,            -- Tipo: Factura, Boleta, etc.
    serie VARCHAR(4) NOT NULL,             -- Serie del comprobante
    numero VARCHAR(8) NOT NULL,            -- Número del comprobante
    fEmision DATETIME NOT NULL,            -- Fecha de emisión
    fVencimiento DATETIME NULL,            -- Fecha de vencimiento
    idProveedor INT NOT NULL,              -- Proveedor
    idMoneda INT NOT NULL,                 -- Moneda (PEN, USD)
    idEstadoPago INT NOT NULL,             -- Estado: Pagado, Pendiente, etc.
    subTotal DECIMAL(18,2) DEFAULT 0,      -- Subtotal
    igv DECIMAL(18,2) DEFAULT 0,           -- IGV (18%)
    exonerado DECIMAL(18,2) DEFAULT 0,     -- Monto exonerado
    gratuito DECIMAL(18,2) DEFAULT 0,      -- Monto gratuito
    otrosCargos DECIMAL(18,2) DEFAULT 0,   -- Otros cargos
    descuentos DECIMAL(18,2) DEFAULT 0,    -- Descuentos
    total DECIMAL(18,2) DEFAULT 0,         -- Total a pagar
    idMediosPago INT NOT NULL,             -- Medio de pago
    compRelacionado VARCHAR(50) NULL,      -- Comprobante relacionado
    observacion VARCHAR(500) NULL,         -- Observaciones
    estado BIT DEFAULT 1,                  -- Activo/Inactivo
    fRegistro DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa)
);
```

### Tabla: DetalleCompras

```sql
CREATE TABLE DetalleCompras (
    idDetalleCompra INT IDENTITY PRIMARY KEY,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,  -- Sucursal destino
    idCompra UNIQUEIDENTIFIER NOT NULL,     -- Referencia a compra
    idProducto UNIQUEIDENTIFIER NOT NULL,   -- Producto comprado
    idPresentacion INT NOT NULL,            -- Presentación (UND, KG, etc.)
    cantidad DECIMAL(18,3) NOT NULL,        -- Cantidad comprada
    pUnitario DECIMAL(18,6) NOT NULL,       -- Precio unitario
    total DECIMAL(18,2) NOT NULL,           -- Total línea
    fleteXArticulo DECIMAL(10,5) NULL,      -- Flete por artículo
    idUsuario UNIQUEIDENTIFIER NOT NULL,    -- Usuario que registró
    fRegistro DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (idCompra) REFERENCES Compras(idCompra)
);
```

---

## 🚀 Cómo Registrar una Compra

### Opción 1: Registro Manual

#### Paso 1: Ir al Módulo de Compras
```
URL: http://localhost:4200/compras/create
```

#### Paso 2: Datos de la Compra

**Información General:**
- **Sucursal:** Seleccionar sucursal destino
- **Tipo de Comprobante:** Factura (01), Boleta (03), Nota de Crédito, etc.
- **Proveedor:** Seleccionar de la lista
- **Documento del Proveedor:** RUC o DNI

**Comprobante:**
- **Serie:** Ej: F001, B001 (4 caracteres)
- **Número:** Ej: 00000123 (8 dígitos)
- **Fecha de Emisión:** Fecha del comprobante
- **Fecha de Vencimiento:** Para créditos

**Condiciones:**
- **Moneda:** PEN (Soles), USD (Dólares)
- **Estado de Pago:** Pagado, Pendiente, Parcial
- **Medio de Pago:** Efectivo, Transferencia, Tarjeta, etc.

#### Paso 3: Agregar Productos

**Por cada producto:**

1. **Buscar Producto:**
   - Por código de barras
   - Por nombre
   - Por categoría

2. **Completar Detalles:**
   - Cantidad
   - Precio unitario
   - Presentación (UND, KG, LT, etc.)
   - Ubicación en almacén (opcional)
   - Fecha de producción (opcional)
   - Fecha de vencimiento (opcional)

3. **Agregar a Lista:**
   - Click en "Agregar"
   - Producto aparece en la tabla de detalles

#### Paso 4: Verificar Totales

El sistema calcula automáticamente:
- **Subtotal:** Suma de todos los productos
- **IGV (18%):** Calculado sobre el subtotal
- **Descuentos:** Si aplican
- **Otros Cargos:** Fletes, embalajes, etc.
- **TOTAL:** Monto final a pagar

#### Paso 5: Guardar Compra

- Revisar todos los datos
- Click en "Registrar Compra"
- Sistema valida y guarda
- Se actualiza el inventario automáticamente

---

### Opción 2: Importar desde XML (SUNAT)

#### Paso 1: Obtener XML del Proveedor

El proveedor debe enviarte el archivo XML del comprobante electrónico.

#### Paso 2: Subir XML al Sistema

```
1. En el formulario de compras
2. Click en "Consultar XML"
3. Completar datos:
   - RUC de tu empresa
   - Usuario SOL
   - Contraseña SOL
   - RUC del proveedor
   - Tipo de documento (01=Factura, 03=Boleta)
   - Serie y Número del comprobante
4. Click en "Consultar"
```

#### Paso 3: Sistema Carga Datos Automáticamente

El sistema extrae del XML:
- Datos del proveedor
- Fecha de emisión
- Serie y número
- Productos y cantidades
- Precios unitarios
- Totales e impuestos

#### Paso 4: Revisar y Confirmar

- Verificar que los datos sean correctos
- Ajustar si es necesario
- Guardar compra

---

## 📊 Flujo Completo

```
┌─────────────────────────────────────────┐
│  1. Usuario va a /compras/create       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Selecciona Sucursal y Proveedor    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. Ingresa datos del comprobante      │
│     - Tipo, Serie, Número              │
│     - Fechas                           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. Agrega productos uno por uno       │
│     - Busca producto                   │
│     - Ingresa cantidad y precio        │
│     - Agrega a lista                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  5. Sistema calcula totales            │
│     - Subtotal                         │
│     - IGV                              │
│     - Total                            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  6. Usuario guarda compra              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Sistema ejecuta:                      │
│  ✓ Crea registro en Compras           │
│  ✓ Crea detalles en DetalleCompras    │
│  ✓ Actualiza stock de productos       │
│  ✓ Crea lotes (si aplica)             │
│  ✓ Actualiza kardex                   │
└─────────────────────────────────────────┘
```

---

## 🎯 Ejemplo Práctico

### Escenario: Comprar herramientas al proveedor

#### Datos de la Compra:
```
Proveedor: FERRETERÍA DEL NORTE S.A.C.
RUC: 20123456789
Comprobante: Factura F001-00000123
Fecha: 30/01/2026
Moneda: PEN (Soles)
Estado: Pagado
Medio de Pago: Transferencia bancaria
```

#### Productos:
```
1. Martillo Stanley - 10 unidades - S/ 25.00 c/u
2. Destornillador Truper - 20 unidades - S/ 12.50 c/u
3. Llave inglesa - 5 unidades - S/ 35.00 c/u
```

#### Cálculos:
```
Subtotal:
- Martillo: 10 x S/ 25.00 = S/ 250.00
- Destornillador: 20 x S/ 12.50 = S/ 250.00
- Llave: 5 x S/ 35.00 = S/ 175.00
                   Total = S/ 675.00

IGV (18%): S/ 675.00 x 0.18 = S/ 121.50

TOTAL A PAGAR: S/ 675.00 + S/ 121.50 = S/ 796.50
```

---

## 🔍 Validaciones del Sistema

### Al Guardar Compra:

1. **Validaciones Básicas:**
   - ✅ Todos los campos requeridos completos
   - ✅ Proveedor seleccionado
   - ✅ Al menos 1 producto agregado
   - ✅ Serie y número de comprobante válidos

2. **Validaciones de Negocio:**
   - ✅ Comprobante no duplicado (serie + número)
   - ✅ Cantidades mayores a 0
   - ✅ Precios mayores a 0
   - ✅ Fechas válidas

3. **Validaciones de Inventario:**
   - ✅ Productos existen en el catálogo
   - ✅ Sucursal destino activa
   - ✅ Presentaciones válidas

---

## 🛠️ Configuraciones Necesarias

### 1. Tipos de Comprobante (Tabla: Comprobante)

```sql
INSERT INTO Comprobante (codigo, descripcion) VALUES
('01', 'Factura'),
('03', 'Boleta de Venta'),
('07', 'Nota de Crédito'),
('08', 'Nota de Débito'),
('09', 'Guía de Remisión'),
('12', 'Ticket');
```

### 2. Estados de Pago

```sql
INSERT INTO EstadoPago (descripcion) VALUES
('Pagado'),
('Pendiente'),
('Parcial'),
('Vencido');
```

### 3. Medios de Pago

```sql
INSERT INTO MediosPago (codigo, descripcion) VALUES
('001', 'Efectivo'),
('002', 'Transferencia Bancaria'),
('003', 'Tarjeta de Crédito'),
('004', 'Tarjeta de Débito'),
('005', 'Cheque');
```

### 4. Monedas

```sql
INSERT INTO Moneda (codigo, descripcion, simbolo) VALUES
('PEN', 'Sol Peruano', 'S/'),
('USD', 'Dólar Americano', '$'),
('EUR', 'Euro', '€');
```

---

## 📝 Consejos y Buenas Prácticas

### Al Registrar Compras:

1. **Verificar Comprobante:**
   - Siempre verificar serie y número del comprobante físico
   - No duplicar registros

2. **Precios Correctos:**
   - Ingresar precios sin IGV
   - El sistema calcula el IGV automáticamente

3. **Ubicaciones:**
   - Asignar ubicación en almacén para facilitar búsqueda
   - Usar códigos claros (Ej: A1, B2, C3)

4. **Fechas de Vencimiento:**
   - Siempre registrar para productos perecederos
   - Sistema alertará cuando productos estén próximos a vencer

5. **Lotes:**
   - Usar lotes para mejor trazabilidad
   - Especialmente importante para productos regulados

---

## 🐛 Problemas Comunes

### Problema: No aparecen proveedores

**Causa:** No hay proveedores registrados

**Solución:**
```
1. Ir a /proveedores/create
2. Registrar al menos 1 proveedor
3. Volver a compras
```

---

### Problema: No aparecen productos

**Causa:** No hay productos en el catálogo

**Solución:**
```
1. Ir a /productos
2. Crear productos con categorías y marcas
3. Volver a compras
```

---

### Problema: Error al calcular IGV

**Causa:** Configuración incorrecta de IGV

**Solución:**
```
Verificar en configuración que IGV = 18%
O ajustar según país
```

---

## 📊 Reportes Disponibles

Después de registrar compras, puedes ver:

- **Historial de Compras** - Todas las compras registradas
- **Compras por Proveedor** - Agrupar por proveedor
- **Compras por Fecha** - Filtrar por rango de fechas
- **Cuentas por Pagar** - Compras pendientes de pago
- **Análisis de Compras** - Gráficos y estadísticas

---

## 🔗 Integraciones

### Con Inventario:
- ✅ Actualiza stock automáticamente
- ✅ Crea lotes de productos
- ✅ Registra ubicaciones

### Con Contabilidad:
- ✅ Genera asientos contables
- ✅ Actualiza cuentas por pagar
- ✅ Registra movimientos de caja

### Con SUNAT:
- ✅ Consulta XML de comprobantes
- ✅ Valida RUC de proveedores
- ✅ Verifica comprobantes electrónicos

---

## ✅ Checklist de Compra

Antes de guardar una compra, verificar:

- [ ] Proveedor seleccionado correctamente
- [ ] Tipo de comprobante correcto
- [ ] Serie y número ingresados correctamente
- [ ] Fecha de emisión correcta
- [ ] Al menos 1 producto agregado
- [ ] Cantidades correctas
- [ ] Precios correctos (sin IGV)
- [ ] Totales verificados
- [ ] Estado de pago correcto
- [ ] Medio de pago seleccionado
- [ ] Observaciones agregadas (si necesario)

---

*Última actualización: Enero 2026*
*Versión: 1.0*
