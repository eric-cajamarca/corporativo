# 🏢 Sistema de Gestión Empresarial - Documentación Completa

## Stack Tecnológico

- **Frontend:** Angular 17 (Puerto 4200)
- **Backend:** Node.js + Express (Puerto 3000)
- **Base de Datos:** SQL Server
- **Arquitectura:** Multiempresa y Multiusuario

---

## 📁 Estructura del Proyecto

```
project172026/
├── adminSPA/              # Frontend Angular 17
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── empresa/
│   │   │   │   │   ├── create-empresa/       # Registro de empresas
│   │   │   │   │   ├── update-empresa/       # Editar empresa y direcciones
│   │   │   │   │   └── index-empresa/        # Lista de empresas (admin)
│   │   │   │   ├── login-empresa/            # Login de empresas
│   │   │   │   ├── colaboradores/            # Gestión de usuarios
│   │   │   │   ├── configuracion/            # Configuración del sistema
│   │   │   │   ├── productos/                # Gestión de productos
│   │   │   │   ├── ventas/                   # Módulo de ventas
│   │   │   │   ├── compras/                  # Módulo de compras
│   │   │   │   ├── inventario/               # Gestión de inventario y lotes
│   │   │   │   ├── clientes/                 # Gestión de clientes
│   │   │   │   ├── proveedores/              # Gestión de proveedores
│   │   │   │   ├── caja/                     # Gestión de caja
│   │   │   │   ├── creditos/                 # Créditos y cuotas
│   │   │   │   ├── analisis/                 # Análisis financiero
│   │   │   │   └── reportes/                 # Reportes y análisis
│   │   │   ├── services/                     # Servicios Angular
│   │   │   ├── guards/                       # Guards de autenticación
│   │   │   └── models/                       # Modelos de datos
│   │   └── environments/                     # Variables de entorno
│   └── package.json
├── backAppC/              # Backend Node.js
│   ├── controllers/       # Controladores (lógica de endpoints)
│   ├── services/          # Servicios (lógica de negocio)
│   ├── repositories/      # Repositorios (acceso a datos)
│   ├── routes/            # Definición de rutas
│   ├── middlewares/       # Middleware (autenticación, etc.)
│   ├── helpers/           # Helpers (JWT, etc.)
│   ├── uploads/           # Archivos subidos (logos, etc.)
│   └── app.js             # Punto de entrada
├── Query/                 # Scripts SQL
│   └── sjb/               # Scripts de base de datos
└── Documentación
    ├── GUIA_ONBOARDING_EMPRESA.md        # Guía completa paso a paso
    ├── FLUJO_RAPIDO_NUEVA_EMPRESA.md     # Guía rápida (30 min)
    └── README_SISTEMA_COMPLETO.md        # Este documento
```

---

## 🎯 FLUJO COMPLETO DE ONBOARDING

### 1. REGISTRO (5-7 min)

```
┌─────────────────────────────────────────┐
│  1. Usuario ingresa a /crear-empresa   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Ingresa RUC y verifica con SUNAT   │
│     - Sistema obtiene datos automát.   │
│     - Razón social, dirección, etc.    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. Revisa datos de la empresa         │
│     - Puede editar nombre comercial    │
│     - Puede editar dirección           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. Configura credenciales             │
│     - Email corporativo                │
│     - Contraseña segura (8+ chars)     │
│     - Acepta términos                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  5. Click "Registrar Empresa"          │
│     Backend crea:                      │
│     - Empresa                          │
│     - Dirección principal              │
│     - Sucursal inicial                 │
└─────────────────────────────────────────┘
```

### 2. PRIMER LOGIN (1 min)

```
┌─────────────────────────────────────────┐
│  Usuario ingresa a /login-empresa      │
│  Credenciales:                         │
│  - RUC (11 dígitos)                    │
│  - Email                               │
│  - Contraseña                          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Sistema valida y crea sesión JWT      │
│  Redirige a /home (Dashboard)          │
└─────────────────────────────────────────┘
```

### 3. CONFIGURACIÓN DE EMPRESA (10-15 min)

```
┌─────────────────────────────────────────┐
│  A. Subir Logo (/editar-empresa)      │
│     - Formatos: PNG, JPG, GIF, WEBP   │
│     - Máx 4MB                          │
│     - Preview automático               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  B. Completar Información              │
│     - Rubro del negocio                │
│     - Celular corporativo              │
│     - Nombre comercial                 │
│     - Alias (10 chars)                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  C. Gestionar Direcciones              │
│     - Revisar dirección principal      │
│     - Agregar direcciones adicionales  │
│     - Cambiar principal (opcional)     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  D. Guardar "Actualizar Empresa"       │
└─────────────────────────────────────────┘
```

### 4. CREAR COLABORADORES (7-10 min por usuario)

```
┌─────────────────────────────────────────┐
│  A. Ir a /colaborador/create           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  B. Ingresar Datos Personales          │
│     - Nombres y Apellidos              │
│     - DNI                              │
│     - Email (será su usuario)          │
│     - Celular                          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  C. Configurar Credenciales            │
│     - Email como usuario               │
│     - Contraseña segura                │
│     - Confirmar contraseña             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  D. Asignar Rol y Permisos             │
│     - Seleccionar rol                  │
│     - Activar usuario                  │
│     - Asignar sucursal                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  E. Guardar "Registrar Colaborador"    │
│     Usuario puede iniciar sesión       │
└─────────────────────────────────────────┘
```

### 5. CONFIGURACIÓN DE INVENTARIO (15-20 min)

```
┌─────────────────────────────────────────┐
│  A. Crear Categorías                   │
│     /categorias/create                 │
│     Ej: Herramientas, Pinturas, etc.  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  B. Crear Marcas                       │
│     /marcas/create                     │
│     Ej: Stanley, Truper, etc.         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  C. Registrar Productos                │
│     /productos                         │
│     - Asignar categoría y marca        │
│     - Establecer precios               │
└─────────────────────────────────────────┘
```

---

## 🔐 SISTEMA DE AUTENTICACIÓN

### Flujo de Login

```
Cliente                Backend                Base de Datos
   │                      │                         │
   ├──POST /api/admin_login──>│                    │
   │  {ruc, email, password}  │                    │
   │                      │                         │
   │                      ├──Query Empresas────────>│
   │                      │  WHERE ruc = @ruc       │
   │                      │<─────Datos Empresa──────┤
   │                      │                         │
   │                      ├──bcrypt.compare()       │
   │                      │  (password, hash)       │
   │                      │                         │
   │                      ├──jwt.sign()             │
   │                      │  {empresa, rol, email}  │
   │                      │                         │
   │<─────Response─────────┤                        │
   │  {token, data}       │                         │
   │                      │                         │
   ├──Set Cookie──────────>│                        │
   │  token JWT           │                         │
```

### Middleware de Autenticación

```javascript
// middlewares/autenticate.js
exports.auth = (req, res, next) => {
    // 1. Extraer token de cookies
    const token = req.cookies.token;
    
    // 2. Verificar token JWT
    const decoded = jwt.verify(token, secret);
    
    // 3. Agregar usuario a request
    req.user = {
        empresa: decoded.empresa,
        rol: decoded.rol,
        email: decoded.email
    };
    
    // 4. Continuar
    next();
};
```

### Reglas de Seguridad

```
✅ SIEMPRE filtrar por idEmpresa en TODAS las consultas
✅ NUNCA confiar en idEmpresa del frontend
✅ SIEMPRE extraer idEmpresa del token JWT (req.user.empresa)
✅ NUNCA permitir SELECT * sin WHERE idEmpresa = @idEmpresa
✅ SIEMPRE usar bcrypt para passwords (factor 8)
✅ NUNCA guardar passwords en texto plano
```

---

## 🗄️ ARQUITECTURA DE BASE DE DATOS

### Tablas Principales

#### Empresas
```sql
CREATE TABLE Empresas(
    idEmpresa UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idDocumento VARCHAR(1) NOT NULL,
    ruc VARCHAR(11) NOT NULL,
    razon_Social VARCHAR(200) NOT NULL,
    nombreComercial VARCHAR(200) NULL,
    rubro VARCHAR(200) NULL,
    celular VARCHAR(11) NULL,
    correo VARCHAR(100) NOT NULL,
    password TEXT NOT NULL,
    logo VARCHAR(MAX) NULL,  -- Nombre del archivo
    alias VARCHAR(10) NULL,
    condicion VARCHAR(20) NULL,
    estSunat VARCHAR(20) NULL,
    estado BIT NOT NULL DEFAULT 1,
    fregistro DATETIME DEFAULT GETDATE()
);
```

#### DireccionEmpresa
```sql
CREATE TABLE DireccionEmpresa(
    idDireccionEmpresa INT IDENTITY PRIMARY KEY,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    ubigeo VARCHAR(6),
    codPais VARCHAR(3),
    region VARCHAR(10),
    provincia VARCHAR(10),
    distrito VARCHAR(10),
    urbanizacion VARCHAR(200),
    direccion VARCHAR(500),
    codLocal VARCHAR(10),
    principal BIT DEFAULT 0,
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa)
);
```

#### Sucursal
```sql
CREATE TABLE Sucursal(
    idSucursal UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    direccion VARCHAR(500),
    fregistro DATETIME DEFAULT GETDATE(),
    estado BIT DEFAULT 1,
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa)
);
```

#### Usuario (Colaboradores)
```sql
CREATE TABLE Usuario(
    idUsuario UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idRol UNIQUEIDENTIFIER,
    nombres VARCHAR(200),
    apellidos VARCHAR(200),
    email VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    dni VARCHAR(8),
    telefono VARCHAR(15),
    estado BIT DEFAULT 1,
    fregistro DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa),
    FOREIGN KEY (idRol) REFERENCES Rol(idRol)
);
```

---

## 🔧 APIs PRINCIPALES

### Empresas

```javascript
// Registro de empresa (público)
POST /api/empresa
Body: {
    idDocumento, ruc, razon_Social,
    nombre_Comercial, correo, password,
    condicion, estSunat
}

// Actualizar empresa (requiere auth)
PUT /api/empresa/:id
Headers: { Authorization, Cookie }
Body: FormData con logo y datos

// Obtener empresa actual (requiere auth)
GET /api/empresas_id
Headers: { Authorization, Cookie }

// Gestión de direcciones
POST /api/direccion_empresa
PUT /api/direccion_empresa/:id
DELETE /api/direccion_empresa/:id
PUT /api/cambiar_principal/:id
```

### Autenticación

```javascript
// Login de empresa
POST /api/admin_login
Body: { ruc, email, password }
Response: { token, data: {...} }
```

### Colaboradores

```javascript
// Crear colaborador
POST /api/registro_colaborador_admin
Headers: { Authorization }
Body: {
    nombres, apellidos, email, password,
    dni, telefono, idRol, estado
}

// Listar colaboradores
GET /api/colaboradores
Headers: { Authorization }
```

---

## 📝 BUENAS PRÁCTICAS

### Frontend (Angular)

```typescript
// ✅ BUENA PRÁCTICA: Usar FormBuilder
this.empresaForm = this.fb.group({
    ruc: ['', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
});

// ✅ BUENA PRÁCTICA: Usar environment
const apiUrl = environment.API_URL + 'empresa';

// ❌ MALA PRÁCTICA: Hardcodear URLs
const apiUrl = 'http://localhost:3000/api/empresa';
```

### Backend (Node.js)

```javascript
// ✅ BUENA PRÁCTICA: Filtrar por empresa
const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
    .query('SELECT * FROM Productos WHERE idEmpresa = @idEmpresa');

// ❌ MALA PRÁCTICA: Confiar en el frontend
const idEmpresa = req.body.idEmpresa; // ❌ Nunca hacer esto

// ✅ BUENA PRÁCTICA: Usar transacciones
const transaction = new sql.Transaction(pool);
await transaction.begin();
try {
    // Operaciones...
    await transaction.commit();
} catch (error) {
    await transaction.rollback();
    throw error;
}
```

---

## 🚀 COMANDOS ÚTILES

### Frontend
```bash
cd adminSPA
npm install
npm start           # Inicia en puerto 4200
npm run build       # Build para producción
```

### Backend
```bash
cd backAppC
npm install
npm start           # Inicia en puerto 3000
npm run dev         # Con nodemon (desarrollo)
```

---

## 📚 DOCUMENTOS RELACIONADOS

1. **GUIA_ONBOARDING_EMPRESA.md** - Guía completa paso a paso (2-3 horas)
2. **FLUJO_RAPIDO_NUEVA_EMPRESA.md** - Guía rápida (30 minutos)
3. **REGLAS.md** - Reglas de desarrollo del proyecto
4. **FASE3_PRODUCTO_ESTANDAR_MATRIZ.md** - Matriz configuración vs. roadmap, flags plan→módulos, respuestas comerciales (producto estándar SaaS)
5. **POLITICA_MIGRACION_LICENCIA_UNICA_A_SAAS.md** - Migración licencia única / on‑premise → SaaS (comercial + técnico)

---

## 🐛 TROUBLESHOOTING

### Problema: No se sube el logo

**Causas posibles:**
- Archivo muy grande (>4MB)
- Formato no soportado
- Error en el backend

**Solución:**
```bash
# Verificar logs del backend
cd backAppC
npm start
# Ver consola para errores

# Verificar carpeta de uploads
dir uploads/configuraciones
```

### Problema: No aparecen provincias/distritos

**Causa:** No se seleccionó primero el departamento

**Solución:**
```
1. Seleccionar Departamento
2. Esperar a que carguen las provincias
3. Seleccionar Provincia
4. Esperar a que carguen los distritos
5. Seleccionar Distrito
```

---

## 📞 CONTACTO Y SOPORTE

- **Email:** soporte@sistema.com
- **Teléfono:** (01) 123-4567
- **Horario:** Lunes a Viernes, 9am - 6pm

---

*Última actualización: Enero 2026*
