# Inicialización Automática de Datos Maestros al Crear Empresa

## Resumen
Se implementó un sistema de inicialización automática que crea todos los datos maestros necesarios cuando se registra una nueva empresa en el sistema.

## Problema Identificado
Al crear una empresa nueva, no se creaban automáticamente:
- ✗ Roles predeterminados
- ✗ Comprobantes electrónicos
- ✗ Sucursal principal
- ✗ Secuencias de numeración
- ✗ Asignación de sucursal a colaboradores

Esto causaba que:
- El select de comprobantes aparecía vacío en el módulo de compras
- No había sucursales disponibles para asignar stock
- Los colaboradores no tenían sucursal asignada

## Solución Implementada

### 1. Servicio de Inicialización (`empresa.service.js`)

Se crearon las siguientes funciones en `backAppC/services/empresa.service.js`:

#### `crearRolesPredeterminados(pool, idEmpresa)`
Crea 4 roles básicos para la empresa:
- **Administrador**: Control total del sistema
- **Vendedor**: Gestión de ventas
- **Almacenero**: Gestión de inventario y compras
- **Contador**: Reportes y contabilidad

#### `crearComprobantesPredeterminados(pool, idEmpresa)`
Crea 5 tipos de comprobantes electrónicos:
- **01 - Factura Electrónica** (Serie: F001)
- **03 - Boleta de Venta Electrónica** (Serie: B001)
- **07 - Nota de Crédito Electrónica** (Serie: FC01)
- **08 - Nota de Débito Electrónica** (Serie: FD01)
- **09 - Guía de Remisión Electrónica** (Serie: T001)

#### `crearSucursalPrincipal(pool, idEmpresa, datosEmpresa)`
Crea la sucursal principal con:
- Nombre: "Sucursal Principal"
- Dirección y teléfono de la empresa
- Estado activo

#### `crearSecuenciasIniciales(pool, idEmpresa, idSucursal, comprobantes)`
Crea las secuencias de numeración para cada comprobante en la sucursal principal.

#### `inicializarDatosEmpresa(pool, idEmpresa, datosEmpresa)`
Función principal que orquesta la creación de todos los datos maestros:
1. Crea roles
2. Crea comprobantes
3. Crea sucursal principal
4. Crea secuencias de numeración

**Características:**
- Manejo robusto de errores (no bloquea el registro si falla algún paso)
- Logging detallado de cada operación
- Retorna resumen de operaciones exitosas y errores

### 2. Actualización del Controlador de Empresas

En `backAppC/controllers/empresasController.js`:

```javascript
// Antes
await empresaService.crearRolesPredeterminados(pool, idEmpresa);
res.status(200).send({ data: idEmpresa });

// Después
const resultadoInicializacion = await empresaService.inicializarDatosEmpresa(
    pool, 
    idEmpresa, 
    datosEmpresa
);

res.status(200).send({ 
    data: idEmpresa,
    sucursalPrincipal: resultadoInicializacion.sucursal?.idSucursal,
    mensaje: 'Empresa creada exitosamente con datos maestros inicializados'
});
```

### 3. Asignación Automática de Sucursal a Colaboradores

En `backAppC/services/auth.service.js`:

Se modificó `createAdministrador` para:
1. Buscar la sucursal principal de la empresa (primera sucursal creada)
2. Asignar automáticamente esa sucursal al nuevo colaborador en la tabla `UsuarioSucursal`
3. Marcar la asignación como predeterminada (`esDefault = 1`)

```javascript
// Buscar sucursal principal
const sucursalResult = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
        SELECT TOP 1 idSucursal 
        FROM Sucursal 
        WHERE idEmpresa = @idEmpresa AND estado = 1 
        ORDER BY fRegistro ASC
    `);

// Asignar sucursal al usuario
INSERT INTO UsuarioSucursal (idUsuarioSucursal, idUsuario, idSucursal, estado, esDefault, fAsignacion)
VALUES (@idUsuarioSucursal, @idUsuario, @idSucursal, 1, 1, GETDATE())
```

## Tablas Afectadas

### Creadas automáticamente:
1. **Rol** - 4 registros por empresa
2. **Comprobantes** - 5 registros por empresa
3. **Sucursal** - 1 registro (sucursal principal)
4. **Secuencias** - 5 registros (uno por cada comprobante)
5. **UsuarioSucursal** - 1 registro por cada colaborador creado

## Flujo de Creación de Empresa

```
1. Usuario registra empresa
   ↓
2. Se crea registro en tabla Empresas
   ↓
3. inicializarDatosEmpresa()
   ├── crearRolesPredeterminados()
   ├── crearComprobantesPredeterminados()
   ├── crearSucursalPrincipal()
   └── crearSecuenciasIniciales()
   ↓
4. Retorna: idEmpresa + idSucursalPrincipal
```

## Flujo de Creación de Colaborador

```
1. Admin crea colaborador
   ↓
2. Se crea registro en UsuarioWeb
   ↓
3. Se busca sucursal principal
   ↓
4. Se asigna sucursal en UsuarioSucursal
   ↓
5. Colaborador tiene acceso a sucursal principal
```

## Beneficios

✅ **Experiencia de usuario mejorada**: La empresa está lista para operar inmediatamente
✅ **Datos consistentes**: Todas las empresas tienen la misma estructura base
✅ **Menos errores**: No hay campos vacíos en selects críticos
✅ **Escalabilidad**: Fácil agregar más datos maestros en el futuro
✅ **Trazabilidad**: Logs detallados de cada operación

## Manejo de Errores

El sistema está diseñado para ser resiliente:
- Si falla la creación de roles, continúa con comprobantes
- Si falla la creación de comprobantes, continúa con sucursal
- Cada error se registra en el array `errores` del resultado
- La empresa se crea exitosamente incluso si algunos datos maestros fallan
- Se retorna un warning al frontend si hubo errores parciales

## Logs de Ejemplo

```
🚀 Inicializando datos maestros para empresa: abc-123-def
Creando roles predeterminados para empresa: abc-123-def
Rol creado: Administrador (role-uuid-1)
Rol creado: Vendedor (role-uuid-2)
Rol creado: Almacenero (role-uuid-3)
Rol creado: Contador (role-uuid-4)
✓ 4 roles predeterminados creados

Creando comprobantes predeterminados para empresa: abc-123-def
Comprobante creado: Factura Electrónica - F001
Comprobante creado: Boleta de Venta Electrónica - B001
...
✓ 5 comprobantes predeterminados creados

Creando sucursal principal para empresa: abc-123-def
✓ Sucursal principal creada: sucursal-uuid

Creando secuencias iniciales para sucursal: sucursal-uuid
Secuencia creada: 01 - F001
...
✓ 5 secuencias creadas

✅ Inicialización completada: {
  roles: 4,
  comprobantes: 5,
  sucursal: 'OK',
  secuencias: 5,
  ubicaciones: 3,
  listasPrecios: 2,
  errores: 0
}
```

## Testing

Para probar la funcionalidad:

1. **Crear nueva empresa**:
   - Ir a `/crear-empresa`
   - Registrar una empresa nueva
   - Verificar en la respuesta que incluye `sucursalPrincipal`

2. **Verificar datos creados**:
   ```sql
   -- Verificar roles
   SELECT * FROM Rol WHERE idEmpresa = 'tu-empresa-id'
   
   -- Verificar comprobantes
   SELECT * FROM Comprobantes WHERE idEmpresa = 'tu-empresa-id'
   
   -- Verificar sucursal
   SELECT * FROM Sucursal WHERE idEmpresa = 'tu-empresa-id'
   
   -- Verificar secuencias
   SELECT * FROM Secuencias WHERE idEmpresa = 'tu-empresa-id'
   
   -- Verificar ubicaciones
   SELECT up.* FROM UbicacionesPrioridad up 
   INNER JOIN Sucursal s ON up.idSucursal = s.idSucursal
   WHERE s.idEmpresa = 'tu-empresa-id'
   
   -- Verificar listas de precios
   SELECT * FROM ListasPrecio WHERE idEmpresa = 'tu-empresa-id'
   ```

3. **Crear colaborador**:
   - Crear un nuevo usuario/colaborador
   - Verificar que se asignó a la sucursal principal:
   ```sql
   SELECT * FROM UsuarioSucursal WHERE idUsuario = 'tu-usuario-id'
   ```

4. **Probar módulo de compras**:
   - Ir a crear compra
   - Verificar que el select de comprobantes tiene opciones
   - Verificar que el select de sucursal tiene la sucursal principal

## Archivos Modificados

### Backend
- ✅ `backAppC/services/empresa.service.js` - Nuevas funciones de inicialización
- ✅ `backAppC/controllers/empresasController.js` - Llamada a inicialización
- ✅ `backAppC/services/auth.service.js` - Asignación de sucursal a colaboradores

### Ningún cambio en Frontend
La inicialización es completamente transparente para el frontend.

## Próximas Mejoras Sugeridas

1. **Categorías predeterminadas**: Crear categorías básicas de productos
2. **Presentaciones predeterminadas**: Crear unidades de medida comunes (UND, KG, etc.)
3. **Formas de pago predeterminadas**: Efectivo, Tarjeta, Transferencia
4. **Configuración de impuestos**: IGV por defecto (18%)
5. **Cajas predeterminadas**: Crear caja principal por sucursal
6. **Almacenes predeterminados**: Crear almacén principal por sucursal

## Notas Técnicas

- Todas las operaciones usan transacciones implícitas de SQL Server
- Los UUIDs se generan con `uuidv4()` de la librería `uuid`
- Las fechas se registran con `GETDATE()` de SQL Server
- El sistema es compatible con multiempresa (cada empresa tiene sus propios datos)
- No hay dependencias circulares entre las funciones de inicialización
