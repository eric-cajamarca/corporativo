# 🔐 CREDENCIALES DE ACCESO AL SISTEMA

## 📋 Credenciales Disponibles

### 👤 **Usuario Administrador Principal**
- **Email:** `ericortizguevara@gmail.com`
- **Contraseña:** `123456`
- **Rol:** Administrador
- **Estado:** Activo

### 🏢 **Usuario Empresa (Login de Empresa)**
- **RUC:** `20611688564`
- **Contraseña:** `123456`
- **Empresa:** EMPRESA FERRETERA AVE FENIX SJB E.I.R.L.

### 🔍 **Usuario Especial "Predeterminado"**
- **Nombre:** `Predeterminado Predeterminado`
- **Contraseña:** `123456` (o sin contraseña - acceso directo)
- **Rol:** Administrador (acceso completo)

## 🚀 **Cómo Ingresar al Sistema**

### **Paso 1: Iniciar Servidores**
```bash
# Terminal 1 - Backend
cd backAppC
npm start
# Servidor en: http://localhost:3000

# Terminal 2 - Frontend
cd adminSPA
ng serve --port 4200
# Aplicación en: http://localhost:4200
```

### **Paso 2: Acceder al Sistema**
1. Abrir navegador en: `http://localhost:4200`
2. **Login de Empresa:**
   - RUC: `20611688564`
   - Contraseña: `123456`

3. **Login de Usuario:**
   - Email: `ericortizguevara@gmail.com`
   - Contraseña: `123456`

### **Recuperar contraseña (enlace por correo)**
- En la pantalla de login, clic en **"Recuperar contraseña"** o ir a: `http://localhost:4200/recuperar-password`
- Paso 1: Ingresar **RUC** de la empresa y **correo** (el de la empresa o el del colaborador). Se envía un **enlace al correo registrado** (no se muestra en pantalla).
- Paso 2: Abrir el enlace recibido en el correo y establecer la **nueva contraseña** (mínimo 6 caracteres). El enlace es válido 15 minutos.
- **Producción:** configurar SMTP en el backend (ver sección "Configuración de correo" más abajo).

### **Nota: intentos fallidos**
- El sistema **no bloquea** la cuenta tras varios intentos fallidos de login; esa funcionalidad no está implementada. Si se desea, se puede añadir más adelante (por ejemplo, bloqueo temporal o captcha).

## 📊 **Funcionalidades Disponibles por Rol**

### **Administrador:**
- ✅ Gestión de Usuarios y Roles
- ✅ Gestión de Empresas y Sucursales
- ✅ Gestión de Productos e Inventario
- ✅ Gestión de Ventas y Compras
- ✅ **Nueva:** Gestión de Caja
- ✅ **Nueva:** Gestión de Créditos
- ✅ **Nueva:** Análisis Financiero Completo
- ✅ Reportes y Estadísticas

### **Vendedor:**
- ✅ Gestión de Ventas
- ✅ Gestión de Clientes
- ✅ Consulta de Productos

### **Almacenero:**
- ✅ Gestión de Inventario
- ✅ Control de Stock
- ✅ Movimientos de Ubicación

## 🔧 **Notas Técnicas**

### **Hash de Contraseña:**
El hash bcrypt usado en la base de datos corresponde a la contraseña `123456`:
```
$2a$08$iD7U/5D7Kc.BOH06wQg/.uGB7pY9CNSd2LYwEabV3QM9GCHIYQmby
```

### **Base de Datos:**
- **Servidor:** `DESKTOP-K41FUTR\SQLEXPRESS`
- **Base de Datos:** `SistemaInventario`
- **Usuario:** `sa`
- **Contraseña:** `123456`

### **Configuración de correo (recuperación de contraseña):**
En la carpeta del backend (`backAppC`) agregue en su archivo `.env` las variables SMTP para que el enlace de recuperación llegue por correo. Sin SMTP, en desarrollo el enlace se muestra en la consola del servidor.

```env
FRONTEND_URL=http://localhost:4200
SMTP_HOST=smtp.ejemplo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=correo@ejemplo.com
SMTP_PASS=su_contraseña_o_app_password
SMTP_FROM=nombre <correo@ejemplo.com>
```

Ejemplo con Gmail: use una contraseña de aplicación (no la contraseña normal), `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`.

### **API Endpoints:**
- **Base URL:** `http://localhost:3000/api`
- **Autenticación:** JWT con Bearer Token
- **Documentación:** Endpoints disponibles en archivos de rutas

## 🎯 **URLs de Acceso Directo**

### **Módulos Principales:**
- **Dashboard:** `http://localhost:4200/home`
- **Caja:** `http://localhost:4200/caja`
- **Créditos:** `http://localhost:4200/creditos`
- **Análisis Financiero:** `http://localhost:4200/analisis`

### **Módulos Existentes:**
- **Productos:** `http://localhost:4200/productos`
- **Ventas:** `http://localhost:4200/ventas`
- **Compras:** `http://localhost:4200/compras`
- **Clientes:** `http://localhost:4200/clientes`

## ⚠️ **Consideraciones de Seguridad**

### **En Desarrollo:**
- Las contraseñas están en texto plano para facilitar las pruebas
- JWT secret está expuesto (cambiar en producción)
- Base de datos sin encriptación

### **Para Producción:**
```bash
# Cambiar estas configuraciones:
JWT_SECRET=cambiar_por_secreto_fuerte_de_al_menos_64_caracteres
DB_PASSWORD=cambiar_por_contraseña_fuerte
DB_ENCRYPT=true
```

## 🎉 **Estado del Sistema**

### **✅ Funcionalidades Implementadas:**
- 🔐 Sistema de autenticación completo
- 👥 Control de usuarios y roles
- 🏢 Multiempresa configurado
- 💰 Sistema de caja operativo
- 💳 Gestión de créditos completa
- 📊 Dashboard financiero avanzado
- 🏪 Inventario y productos
- 🛒 Ventas y compras
- 👥 Gestión de clientes
- 🚛 Logística y envíos
- 🧾 Facturación electrónica SUNAT

### **🚀 Listo para Uso:**
El sistema está completamente funcional y listo para pruebas con datos reales.