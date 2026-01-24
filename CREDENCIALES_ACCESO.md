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