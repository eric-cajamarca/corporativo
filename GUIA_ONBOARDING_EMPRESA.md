# 📋 GUÍA DE ONBOARDING PARA EMPRESAS NUEVAS

## Sistema de Gestión Empresarial - Proceso Completo de Configuración Inicial

---

## 🎯 FASE 1: REGISTRO DE LA EMPRESA

### Paso 1.1: Crear Cuenta de Empresa
**URL:** `http://localhost:4200/crear-empresa`

1. **Verificar RUC:**
   - Ingresar RUC de 11 dígitos (ej: 20603181680)
   - Click en "Verificar"
   - El sistema obtiene automáticamente datos de SUNAT:
     - Razón Social
     - Nombre Comercial
     - Estado
     - Condición
     - Dirección fiscal
     - Ubicación (departamento, provincia, distrito)

2. **Revisar Datos de la Empresa:**
   - Verificar que la razón social sea correcta
   - Opcionalmente, editar el nombre comercial
   - Verificar la dirección fiscal
   - Los campos de estado y condición SUNAT son de solo lectura

3. **Configurar Credenciales:**
   - **Email corporativo:** Este será el correo principal del administrador
   - **Contraseña segura:** Mínimo 8 caracteres que incluya:
     - Al menos una mayúscula
     - Al menos una minúscula  
     - Al menos un número
     - Al menos un carácter especial (@$!%*?&_-#.+=^)
   - **Confirmar contraseña:** Debe coincidir exactamente
   - **Aceptar términos y condiciones:** Obligatorio

4. **Registrar:**
   - Click en "Registrar Empresa"
   - Esperar confirmación de registro exitoso
   - El sistema crea automáticamente:
     - La empresa en la base de datos
     - La dirección fiscal principal
     - Una sucursal inicial (generalmente "Mi sucursal")

**⏱️ Tiempo estimado:** 5-7 minutos

**✅ Resultado:** Empresa registrada y lista para iniciar sesión

---

## 🔐 FASE 2: PRIMER INICIO DE SESIÓN

### Paso 2.1: Acceder al Sistema
**URL:** `http://localhost:4200/login-empresa`

1. **Credenciales:**
   - **RUC:** El RUC de 11 dígitos registrado
   - **Email:** El correo configurado en el registro
   - **Contraseña:** La contraseña creada

2. **Iniciar Sesión:**
   - Click en "Iniciar Sesión"
   - El sistema valida las credenciales
   - Redirige automáticamente al dashboard (`/home`)

**⏱️ Tiempo estimado:** 1 minuto

---

## ⚙️ FASE 3: CONFIGURACIÓN INICIAL DE LA EMPRESA

### Paso 3.1: Completar Datos de la Empresa
**URL:** `http://localhost:4200/editar-empresa`

#### 3.1.1 Subir Logo de la Empresa
1. En la sección "Datos de la Empresa"
2. Click en "Seleccionar imagen"
3. Elegir logo de la empresa:
   - **Formatos permitidos:** PNG, JPG, JPEG, GIF, WEBP
   - **Tamaño máximo:** 4 MB
   - **Recomendado:** 200x200 px o 500x500 px, fondo transparente
4. Preview del logo aparece automáticamente

#### 3.1.2 Completar Información Corporativa
- **Rubro:** Sector o giro del negocio (ej: Ferretería, Abarrotes, Servicios)
- **Celular:** Teléfono de contacto corporativo
- **Nombre Comercial:** Nombre con el que opera la empresa
- **Alias:** Nombre corto (máximo 10 caracteres)

#### 3.1.3 Guardar Cambios
- Click en "Actualizar Empresa"
- Esperar confirmación de actualización exitosa

**⏱️ Tiempo estimado:** 5-10 minutos

---

### Paso 3.2: Gestionar Direcciones
**En la misma página de editar empresa**

#### 3.2.1 Revisar Dirección Principal
- La dirección fiscal registrada inicialmente aparece marcada como "Principal"
- Esta dirección se usa para facturación electrónica

#### 3.2.2 Agregar Direcciones Adicionales (Opcional)
1. Click en "Agregar Nueva Dirección"
2. Completar datos:
   - **Departamento:** Seleccionar de la lista
   - **Provincia:** Se filtra según departamento
   - **Distrito:** Se filtra según provincia
   - **Dirección completa:** Calle, número, referencias
   - **Urbanización:** (opcional)
   - **Código Local:** Si aplica
3. Click en "Guardar Dirección"

#### 3.2.3 Cambiar Dirección Principal (Si necesario)
- En la lista de direcciones, click en "Marcar como Principal"
- Solo una dirección puede ser principal a la vez

#### 3.2.4 Eliminar Direcciones
- Click en botón de eliminar (ícono de basura)
- Confirmar eliminación
- **NOTA:** No se puede eliminar la dirección principal

**⏱️ Tiempo estimado:** 3-5 minutos por dirección adicional

---

## 👥 FASE 4: CONFIGURAR ROLES Y PERMISOS

### Paso 4.1: Revisar Roles Existentes
**URL:** `http://localhost:4200/rol`

El sistema incluye roles predefinidos:
- **Administrador:** Acceso completo al sistema
- **Vendedor:** Gestión de ventas y clientes
- **Almacenero:** Gestión de inventario y stock
- **Contador:** Acceso a reportes financieros

### Paso 4.2: Crear Roles Personalizados (Opcional)
**URL:** `http://localhost:4200/rol/create`

1. Click en "Crear Nuevo Rol"
2. Completar:
   - **Nombre del Rol:** Descriptivo y claro
   - **Descripción:** Funciones del rol
3. **Asignar Permisos:**
   - Ver lista de módulos disponibles
   - Marcar permisos específicos:
     - Lectura (Ver)
     - Escritura (Crear/Editar)
     - Eliminación
4. Click en "Guardar Rol"

**⏱️ Tiempo estimado:** 5-10 minutos

---

## 👤 FASE 5: CREAR PRIMER COLABORADOR

### Paso 5.1: Agregar Colaborador/Usuario
**URL:** `http://localhost:4200/colaborador/create`

#### 5.1.1 Datos Personales
1. **Nombres:** Nombres completos del colaborador
2. **Apellidos:** Apellidos completos
3. **DNI/Documento:** Número de identificación
4. **Email:** Correo electrónico corporativo o personal
   - Este será su usuario de acceso
   - Debe ser único en el sistema
5. **Teléfono/Celular:** Número de contacto

#### 5.1.2 Datos de Acceso
1. **Usuario:** (generalmente el email)
2. **Contraseña Inicial:** 
   - Debe cumplir requisitos de seguridad
   - El colaborador debe cambiarla en su primer acceso
3. **Confirmar Contraseña**

#### 5.1.3 Asignación de Rol
1. **Seleccionar Rol:**
   - Elegir de la lista de roles creados
   - Ej: Vendedor, Almacenero, Contador
2. **Estado:** Marcar como "Activo"

#### 5.1.4 Sucursal Asignada (Si aplica)
- Seleccionar la sucursal donde trabajará el colaborador
- Por defecto: Sucursal principal

#### 5.1.5 Guardar
- Click en "Registrar Colaborador"
- El colaborador ya puede acceder al sistema

**⏱️ Tiempo estimado:** 5-7 minutos por colaborador

---

## 🏪 FASE 6: CONFIGURAR SUCURSALES (Si aplica)

### Paso 6.1: Gestionar Sucursales
**URL:** `http://localhost:4200/sucursal`

#### 6.1.1 Revisar Sucursal Principal
- El sistema crea automáticamente una sucursal inicial
- Por defecto: "Mi sucursal"

#### 6.1.2 Editar Sucursal Principal
1. Click en "Editar" en la sucursal existente
2. Actualizar:
   - **Nombre:** Nombre de la sucursal (ej: "Sucursal Centro", "Tienda Principal")
   - **Dirección:** Dirección física completa
   - **Teléfono:** (opcional)
   - **Estado:** Activo/Inactivo
3. Click en "Actualizar"

#### 6.1.3 Crear Sucursales Adicionales
1. Click en "Crear Nueva Sucursal"
2. Completar datos similares
3. Asignar usuarios a cada sucursal

**⏱️ Tiempo estimado:** 3-5 minutos por sucursal

---

## 📦 FASE 7: CONFIGURACIÓN INICIAL DE INVENTARIO

### Paso 7.1: Configurar Categorías de Productos
**URL:** `http://localhost:4200/categorias`

1. Click en "Crear Categoría"
2. Ingresar:
   - **Nombre:** Ej: Herramientas, Pinturas, Tornillería
   - **Descripción:** (opcional)
3. Crear todas las categorías necesarias

### Paso 7.2: Configurar Marcas
**URL:** `http://localhost:4200/marcas`

1. Click en "Crear Marca"
2. Ingresar nombre de marcas que maneja
3. Repetir para todas las marcas

### Paso 7.3: Configurar Presentaciones (Si aplica)
**URL:** Verificar en el menú de configuración

- Unidades (UND, KG, LT, etc.)
- Presentaciones (Caja, Paquete, etc.)

**⏱️ Tiempo estimado:** 15-20 minutos total

---

## 🏢 FASE 8: CONFIGURACIÓN DE PROVEEDORES

### Paso 8.1: Registrar Proveedores
**URL:** `http://localhost:4200/proveedores/create`

1. **Datos del Proveedor:**
   - RUC o DNI
   - Razón Social / Nombres
   - Dirección
   - Teléfono
   - Email
   - Contacto principal

2. **Condiciones Comerciales:**
   - Días de crédito
   - Forma de pago preferida
   - Descuentos habituales

3. Click en "Registrar Proveedor"

**⏱️ Tiempo estimado:** 5 minutos por proveedor

---

## 🧾 FASE 9: CONFIGURACIÓN DE FACTURACIÓN

### Paso 9.1: Configurar Series de Comprobantes
**URL:** `http://localhost:4200/configuracion`

1. **Numeración de Comprobantes:**
   - **Serie Factura:** F001, F002, etc.
   - **Serie Boleta:** B001, B002, etc.
   - **Serie Nota de Crédito:** FC01
   - **Serie Nota de Débito:** FD01

2. **Configuración de Impuestos:**
   - **IGV:** 18% (por defecto)
   - Otros impuestos según aplique

3. **Configuración SUNAT:**
   - Activar envío automático a SUNAT (si aplica)
   - Configurar credenciales SOL (si aplica)

**⏱️ Tiempo estimado:** 10-15 minutos

---

## 👨‍💼 FASE 10: CONFIGURACIÓN DE CLIENTES

### Paso 10.1: Registrar Clientes Principales
**URL:** `http://localhost:4200/cliente/create`

1. **Datos del Cliente:**
   - Tipo de documento (RUC, DNI)
   - Número de documento
   - Razón Social / Nombres
   - Dirección
   - Teléfono
   - Email

2. **Condiciones Comerciales:**
   - Límite de crédito
   - Días de crédito permitidos
   - Descuento habitual

3. Click en "Registrar Cliente"

**⏱️ Tiempo estimado:** 5 minutos por cliente

---

## ✅ CHECKLIST FINAL DE CONFIGURACIÓN

### Datos de Empresa
- [ ] Logo subido
- [ ] Información corporativa completa
- [ ] Dirección principal verificada
- [ ] Direcciones adicionales agregadas (si aplica)

### Usuarios y Permisos
- [ ] Roles revisados/creados
- [ ] Primer colaborador creado
- [ ] Permisos asignados correctamente

### Estructura Organizacional
- [ ] Sucursales configuradas
- [ ] Usuarios asignados a sucursales

### Inventario
- [ ] Categorías de productos creadas
- [ ] Marcas registradas
- [ ] Presentaciones/unidades configuradas

### Relaciones Comerciales
- [ ] Proveedores principales registrados
- [ ] Clientes principales registrados

### Facturación
- [ ] Series de comprobantes configuradas
- [ ] Impuestos configurados
- [ ] Configuración SUNAT (si aplica)

---

## 🎓 PRÓXIMOS PASOS

Después de completar la configuración inicial:

1. **Cargar Inventario Inicial:**
   - Ir a Productos
   - Registrar productos iniciales
   - Asignar stock inicial

2. **Registrar Primera Compra:**
   - Ir a Compras
   - Registrar ingreso de mercadería

3. **Realizar Primera Venta:**
   - Ir a Ventas
   - Probar flujo completo de venta

4. **Capacitar a Colaboradores:**
   - Entregarles sus credenciales
   - Mostrarles sus funciones principales

---

## 🆘 SOPORTE Y AYUDA

**En caso de problemas:**
- Contactar a soporte técnico: soporte@sistema.com
- Revisar documentación en: /docs
- Chat de soporte: Disponible en el sistema

---

## ⏱️ RESUMEN DE TIEMPOS

| Fase | Tiempo Estimado |
|------|----------------|
| 1. Registro de Empresa | 5-7 min |
| 2. Primer Login | 1 min |
| 3. Configuración de Empresa | 5-10 min |
| 4. Direcciones | 3-5 min |
| 5. Roles y Permisos | 5-10 min |
| 6. Primer Colaborador | 5-7 min |
| 7. Sucursales | 3-5 min |
| 8. Inventario Base | 15-20 min |
| 9. Proveedores | 5 min por proveedor |
| 10. Facturación | 10-15 min |
| 11. Clientes | 5 min por cliente |

**TIEMPO TOTAL MÍNIMO:** 1-1.5 horas  
**TIEMPO TOTAL COMPLETO:** 2-3 horas (con datos completos)

---

*Documento actualizado: Enero 2026*
