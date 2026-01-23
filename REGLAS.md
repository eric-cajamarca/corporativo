# REGLAS DE DESARROLLO
**Stack: Nodejs + Express + Angular17 + SQLServer**

## REGLAS DE BACKEND (Nodejs – Puerto 3000)

### 1.1 Arquitectura de carpetas
- SIEMPRE usa estructura controllers/, services/, repositories/, routers/, middlewares/, utils/
- NUNCA pongas lógica de negocio en controllers, solo llamadas a services.
- NUNCA hagas querys SQL directos en controllers. Usa repositories.
- SIEMPRE usa transacciones SQL cuando toques 2 o más tablas: BEGIN TRAN, COMMIT, ROLLBACK

### 1.3 Services
- SIEMPRE valida reglas de negocio (stock suficiente, costos positivos, etc.)
- NUNCA hagas cálculos de precios/impuestos en repositories. Hazlos aquí o en utils
- SIEMPRE lanza throw new Error('mensaje claro') para errores de negocio
- NUNCA uses console.log(). Usa console.error('contexto:', error)

### 1.4 Repositories
- SIEMPRE usa sql.UniqueIdentifier para UUIDs, sql.VarChar para cadenas, sql.Decimal(18,6) para costos
- NUNCA retornes fechas sin formatear: usa CONVERT(VARCHAR(19), fecha, 120) as fecha
- SIEMPRE crea índices en tablas de lotes: CREATE INDEX IX_Lotes_EmpresaProducto ON Lotes(idEmpresa, idProducto)
- NUNCA dupliques idEmpresa en tablas hijo si ya está en el padre (violación de normalización)

### 1.5 Rutas
- SIEMPRE usa rutas RESTful: /api/lotes, /api/ventas, /api/compras
- SIEMPRE aplica middleware de autenticación ANTES de las rutas: router.use(verificarToken)
- NUNCA dejes rutas públicas que devuelvan datos de empresa sin filtrar por idEmpresa

### 1.6 Multiempresa
- SIEMPRE filtra por idEmpresa en TODAS las consultas (incluso si crees que no es necesario)
- SIEMPRE usa req.user.empresa del token JWT, NUNCA dejes que el frontend envíe idEmpresa
- NUNCA permitas SELECT * FROM Productos sin WHERE idEmpresa = @idEmpresa

## 2. REGLAS DE FRONTEND (Angular)

### 2.1 Componentes
- SIEMPRE declara interfaces/models para todos los datos de APIs
- NUNCA uses any en inputs/outputs de componentes
- SIEMPRE usa formularios reactivos (FormBuilder) para forms > 3 campos
- NUNCA pongas lógica de negocio en HTML. Muévela a services o pipes

### 2.2 Services
- SIEMPRE usa environment para URLs: environment.apiUrl + '/lotes'
- SIEMPRE maneja errores en el subscribe

### 2.3 Rutas Angular
- SIEMPRE protege rutas de inventario con canActivate: [AuthGuard]

## 3. REGLAS DE BASE DE DATOS (SQL Server)

### 3.1 Tablas
- SIEMPRE usa UNIQUEIDENTIFIER para IDs principales con DEFAULT NEWID()
- SIEMPRE agrega FOREIGN KEY con ON DELETE CASCADE solo si la lógica lo requiere
- NUNCA uses FLOAT para costos/precios. Usa DECIMAL(18,6)
- SIEMPRE crea índices compuestos para queries frecuentes
```sql
CREATE INDEX IX_Lotes_EmpresaSucursal ON Lotes(idEmpresa, idSucursal) WHERE cantidadDisponible > 0;
```

### 4. Multiempresa
- TODA consulta DEBE filtrar por idEmpresa = @idEmpresa
- NUNCA confíes en que el frontend envíe el idEmpresa correcto. EXTRAÉLO del token JWT

## 5. REGLAS DE SEGURIDAD

### 5.1 JWT
- SIEMPRE usa middleware verificarToken en rutas /api/lotes, /api/ventas, etc.
- SIEMPRE valida req.user.empresa existe y es UUID válido
- NUNCA permitas idEmpresa en el body de la petición. Sobrescribe con req.user.empresa

## 6. REGLAS DE CONSISTENCIA

### 6.1 Nomenclatura
- SIEMPRE usa camelCase para variables/funciones en JavaScript/TypeScript
- SIEMPRE usa PascalCase para interfaces/models en TypeScript
- SIEMPRE usa UPPER_SNAKE_CASE para constantes: const API_URL = '...'

### 6.2 Archivos
- NUNCA uses nombres genéricos: service.js → lote.service.ts
- SIEMPRE usa sufijo: .service.ts, .component.ts, .model.ts
- SIEMPRE agrupa por módulo: /inventario/lote/list/, /ventas/factura/form/

### 6.3 Git
- NUNCA hagas commit con console.log() de debug
- SIEMPRE escribe mensajes claros: feat(inventario): agrega ubicación de stock a lotes

## 7. REGLAS DE ESTILOS
- SIEMPRE usa boostrap5 de manera local tal cual esta el projecto.