# 🚀 Sistema de Onboarding Inteligente

## Implementación de Navegación Dinámica según Estado de Configuración

---

## 📋 Resumen

Se ha implementado un sistema inteligente que adapta la navegación del sidebar según el estado de configuración de la empresa. Esto guía al usuario paso a paso en el proceso de configuración inicial.

---

## ✅ Características Implementadas

### 1. **Creación Automática de Roles Predeterminados**

Cuando una empresa se registra, el sistema crea automáticamente 4 roles básicos:

- ✅ **Administrador** - Acceso completo al sistema
- ✅ **Vendedor** - Gestión de ventas y clientes
- ✅ **Almacenero** - Gestión de inventario y compras
- ✅ **Contador** - Reportes y análisis financiero

**Ubicación del código:**
- Backend: `backAppC/services/empresa.service.js` → `crearRolesPredeterminados()`
- Controlador: `backAppC/controllers/empresasController.js` → `createEmpresa()`

**Flujo:**
```javascript
1. Usuario registra empresa nueva
2. Sistema crea registro de empresa en BD
3. Sistema llama a crearRolesPredeterminados(pool, idEmpresa)
4. Se crean los 4 roles básicos
5. Usuario puede crear colaboradores inmediatamente
```

---

### 2. **Endpoint de Estado de Configuración**

Nuevo endpoint que retorna el estado de configuración de la empresa.

**Ruta:** `GET /api/estado_configuracion`

**Respuesta:**
```json
{
  "data": {
    "tieneColaboradores": false,
    "cantidadColaboradores": 0,
    "tieneProductos": false,
    "cantidadProductos": 0,
    "tieneProveedores": false,
    "cantidadProveedores": 0,
    "tieneClientes": false,
    "cantidadClientes": 0,
    "configuracionCompleta": false
  }
}
```

**Ubicación del código:**
- Ruta: `backAppC/routes/empresa.js`
- Controlador: `backAppC/controllers/empresasController.js` → `getEstadoConfiguracion()`
- Servicio: `backAppC/services/empresa.service.js` → `obtenerEstadoConfiguracion()`

---

### 3. **Sidebar Dinámico**

El sidebar ahora carga dinámicamente el menú según el estado de la empresa.

#### Estado 1: Empresa Nueva (Sin Colaboradores)

```
Dashboard
─────────────────────
Configuración Empresa
Crear Primer Colaborador  ← Solo esta opción visible
```

#### Estado 2: Empresa Configurada (Con Colaboradores)

```
Dashboard
─────────────────────
Configuración Empresa
─────────────────────
Colaboradores
Ventas
Compras
Inventario
Productos
Clientes
Proveedores
─────────────────────
Configuración
```

**Ubicación del código:**
- Componente: `adminSPA/src/app/components/sidebar/sidebar.component.ts`
- Métodos:
  - `cargarEstadoConfiguracion()` - Obtiene el estado
  - `actualizarNavegacionSegunEstado()` - Actualiza el menú

---

### 4. **Servicio de Empresa Actualizado**

Se agregó método para obtener estado de configuración.

**Ubicación:** `adminSPA/src/app/services/empresa.service.ts`

**Método nuevo:**
```typescript
getEstadoConfiguracion(): Observable<any> {
  let headers = new HttpHeaders({
    'Content-Type':'application/json',
    'Authorization':''
  });
  return this._http.get(
    this.url + 'estado_configuracion',
    { headers: headers, withCredentials: true }
  );
}
```

---

## 🔄 Flujo Completo del Usuario

### 1️⃣ Registro de Empresa

```
Usuario → http://localhost:4200/crear-empresa
  ├─ Ingresa RUC: 20603181680
  ├─ Sistema verifica con SUNAT
  ├─ Usuario completa datos
  ├─ Usuario crea credenciales
  └─ Sistema ejecuta:
      ├─ Crea empresa en BD
      ├─ Crea 4 roles predeterminados ✓ NUEVO
      ├─ Crea dirección principal
      └─ Crea sucursal inicial
```

### 2️⃣ Primer Login

```
Usuario → http://localhost:4200/login-empresa
  ├─ Ingresa credenciales
  ├─ Sistema autentica
  └─ Redirige a /home (Dashboard)
```

### 3️⃣ Navegación Inicial (Sin Colaboradores)

```
Sidebar carga:
  ├─ Sistema llama a /api/estado_configuracion
  ├─ Detecta: tieneColaboradores = false
  └─ Muestra solo:
      ├─ Dashboard
      ├─ Configuración Empresa
      └─ Crear Primer Colaborador ✓ DESTACADO
```

### 4️⃣ Crear Primer Colaborador

```
Usuario → http://localhost:4200/colaborador/create
  ├─ Sidebar carga roles (ahora disponibles ✓)
  ├─ Usuario completa datos del colaborador
  ├─ Usuario selecciona rol (Administrador/Vendedor/etc)
  ├─ Usuario crea credenciales
  └─ Sistema:
      ├─ Crea colaborador en BD
      └─ Colaborador puede iniciar sesión
```

### 5️⃣ Navegación Completa (Con Colaboradores)

```
Sidebar detecta cambio:
  ├─ Sistema llama a /api/estado_configuracion
  ├─ Detecta: tieneColaboradores = true
  └─ Muestra menú completo:
      ├─ Dashboard
      ├─ Configuración Empresa
      ├──────────────
      ├─ Colaboradores
      ├─ Ventas ✓ NUEVO
      ├─ Compras ✓ NUEVO
      ├─ Inventario ✓ NUEVO
      ├─ Productos ✓ NUEVO
      ├─ Clientes ✓ NUEVO
      ├─ Proveedores ✓ NUEVO
      ├──────────────
      └─ Configuración
```

---

## 🛠️ Archivos Modificados

### Backend (Node.js)

1. **`backAppC/services/empresa.service.js`** ✨ NUEVO
   - `crearRolesPredeterminados(pool, idEmpresa)`
   - `verificarColaboradores(pool, idEmpresa)`
   - `obtenerEstadoConfiguracion(pool, idEmpresa)`

2. **`backAppC/controllers/empresasController.js`**
   - `createEmpresa()` - Ahora llama a `crearRolesPredeterminados()`
   - `getEstadoConfiguracion()` ✨ NUEVO

3. **`backAppC/routes/empresa.js`**
   - Nueva ruta: `GET /estado_configuracion`

### Frontend (Angular)

1. **`adminSPA/src/app/services/empresa.service.ts`**
   - `getEstadoConfiguracion()` ✨ NUEVO

2. **`adminSPA/src/app/components/sidebar/sidebar.component.ts`**
   - Importa `EmpresaService`
   - `estadoConfiguracion` signal ✨ NUEVO
   - `cargarEstadoConfiguracion()` ✨ NUEVO
   - `actualizarNavegacionSegunEstado()` ✨ NUEVO

---

## 🧪 Cómo Probar

### Paso 1: Crear Nueva Empresa

```bash
1. Ir a: http://localhost:4200/crear-empresa
2. Ingresar RUC: 20603181680
3. Verificar y completar datos
4. Crear credenciales
5. Registrar
```

### Paso 2: Verificar Roles Creados (Backend)

```sql
-- En SQL Server
SELECT * FROM Rol 
WHERE idEmpresa = 'ID-DE-TU-EMPRESA'
ORDER BY descripcion;

-- Deberías ver:
-- Administrador
-- Almacenero
-- Contador
-- Vendedor
```

### Paso 3: Verificar Sidebar Inicial

```bash
1. Iniciar sesión con credenciales de la empresa
2. Verificar que el sidebar muestra solo:
   - Dashboard
   - Configuración Empresa
   - Crear Primer Colaborador
```

### Paso 4: Crear Primer Colaborador

```bash
1. Click en "Crear Primer Colaborador"
2. Verificar que se cargan los 4 roles ✓
3. Completar datos del colaborador
4. Asignar rol "Administrador"
5. Guardar
```

### Paso 5: Verificar Sidebar Completo

```bash
1. Recargar la página o navegar
2. Verificar que el sidebar ahora muestra:
   - Todas las opciones del menú
   - Ventas, Compras, Inventario, etc.
```

---

## 🔍 Debug y Monitoreo

### Logs del Backend

```javascript
// Al crear empresa, ver en consola:
✓ Empresa creada con ID: xxx-xxx-xxx
Creando roles predeterminados para empresa: xxx-xxx-xxx
Rol creado: Administrador (xxx-xxx-xxx)
Rol creado: Vendedor (xxx-xxx-xxx)
Rol creado: Almacenero (xxx-xxx-xxx)
Rol creado: Contador (xxx-xxx-xxx)
✓ 4 roles predeterminados creados
✓ Roles predeterminados creados para la empresa
```

### Logs del Frontend

```javascript
// En consola del navegador (F12):
Estado de configuración: {
  tieneColaboradores: false,
  cantidadColaboradores: 0,
  ...
}

// Después de crear colaborador:
Estado de configuración: {
  tieneColaboradores: true,
  cantidadColaboradores: 1,
  ...
}
```

---

## 🐛 Solución de Problemas

### Problema: No se cargan los roles en colaboradores

**Causa:** No se crearon roles predeterminados

**Solución:**
```sql
-- Verificar roles en la base de datos
SELECT * FROM Rol WHERE idEmpresa = 'TU-ID-EMPRESA';

-- Si no hay roles, ejecutar manualmente:
DECLARE @idEmpresa UNIQUEIDENTIFIER = 'TU-ID-EMPRESA';

INSERT INTO Rol (idRol, idEmpresa, descripcion, estado, fCreacion) VALUES
(NEWID(), @idEmpresa, 'Administrador', 1, GETDATE()),
(NEWID(), @idEmpresa, 'Vendedor', 1, GETDATE()),
(NEWID(), @idEmpresa, 'Almacenero', 1, GETDATE()),
(NEWID(), @idEmpresa, 'Contador', 1, GETDATE());
```

### Problema: Sidebar no se actualiza

**Causa:** No se recarga el estado después de crear colaborador

**Solución:**
```typescript
// En create-colaborador.component.ts, después de crear:
this._router.navigate(['/colaborador']).then(() => {
  // Forzar recarga del sidebar
  window.location.reload();
});
```

### Problema: Error 403 en /estado_configuracion

**Causa:** Token JWT no válido o expirado

**Solución:**
```bash
1. Cerrar sesión
2. Iniciar sesión nuevamente
3. Verificar que el token se guarde en cookies
```

---

## 📊 Ventajas del Sistema

### Para el Usuario

- ✅ **Guía paso a paso** - Sabe exactamente qué hacer primero
- ✅ **Sin confusión** - Solo ve opciones relevantes
- ✅ **Rápida configuración** - Proceso optimizado
- ✅ **Sin errores** - No puede saltarse pasos críticos

### Para el Desarrollador

- ✅ **Código modular** - Servicios separados y reutilizables
- ✅ **Fácil mantenimiento** - Lógica centralizada
- ✅ **Escalable** - Fácil agregar más estados
- ✅ **Testeable** - Funciones independientes

### Para el Negocio

- ✅ **Menos soporte** - Usuarios se auto-configuran
- ✅ **Mejor UX** - Experiencia de incorporación fluida
- ✅ **Datos completos** - Asegura configuración correcta
- ✅ **Menor abandono** - Proceso claro y guiado

---

## 🔮 Mejoras Futuras

### Corto Plazo

- [ ] Agregar tooltips explicativos en cada paso
- [ ] Tutorial interactivo en primer login
- [ ] Checklist de configuración en el dashboard
- [ ] Notificaciones de pasos pendientes

### Mediano Plazo

- [ ] Wizard de configuración completo
- [ ] Progreso visual (barra de %

 completado)
- [ ] Sugerencias inteligentes según el rubro
- [ ] Plantillas de configuración por industria

### Largo Plazo

- [ ] Asistente virtual (chatbot)
- [ ] Video tutoriales contextuales
- [ ] Gamificación del onboarding
- [ ] Certificación de configuración completa

---

## 📞 Contacto y Soporte

Si tienes dudas sobre la implementación:

- **Documentación:** Este archivo
- **Código fuente:** Ver archivos mencionados arriba
- **Issues:** Reportar en el repositorio

---

*Última actualización: Enero 2026*
*Versión: 1.0*
