# 🚀 FLUJO RÁPIDO - Nueva Empresa

## Para empresas que se suscriben al sistema

---

## 📝 RESUMEN EJECUTIVO

Este documento describe el flujo mínimo y esencial para que una empresa nueva pueda empezar a operar con el sistema en **menos de 30 minutos**.

---

## ⚡ CONFIGURACIÓN MÍNIMA (30 minutos)

### 1️⃣ CREAR CUENTA (5 min)
**URL:** http://localhost:4200/crear-empresa

```
1. Ingresar RUC: 20603181680
2. Click "Verificar" → Sistema obtiene datos de SUNAT
3. Verificar datos automáticos
4. Ingresar credenciales:
   - Email: lucasdiduniakakao@gmail.com
   - Contraseña: E12345@a (mín 8 caracteres con mayúsc, minúsc, número, especial)
   - Confirmar contraseña
5. Aceptar términos
6. Click "Registrar Empresa"
```

**✅ Resultado:** Empresa creada, dirección principal y sucursal inicial creadas automáticamente

---

### 2️⃣ INICIAR SESIÓN (1 min)
**URL:** http://localhost:4200/login-empresa

```
RUC: 10456333538
Email: lucasdiduniakakao@gmail.com
Contraseña: E12345@a
```

**✅ Resultado:** Acceso al dashboard principal

---

### 3️⃣ COMPLETAR DATOS DE EMPRESA (10 min)
**URL:** http://localhost:4200/editar-empresa

#### A. Subir Logo
```
1. Click "Seleccionar imagen"
2. Elegir logo (PNG/JPG, máx 4MB)
3. Ver preview
```

#### B. Completar Información
```
- Rubro: "Ferretería y materiales de construcción"
- Celular: 999999999
- Nombre Comercial: "GRUPO FERRETERO"
- Alias: "FERRETEC"
```

#### C. Guardar
```
Click "Actualizar Empresa"
```

**✅ Resultado:** Empresa con logo e información completa

---

#### D. Gestionar Direcciones

**Revisar Dirección Principal:**
- La dirección fiscal está marcada como "Principal"
- Esta se usa para facturación electrónica

**Agregar Nueva Dirección (opcional):**
```
1. Click "Nueva dirección"
2. Seleccionar:
   - Departamento
   - Provincia  
   - Distrito
3. Ingresar dirección completa
4. Click "Guardar"
```

**Cambiar Principal (si necesario):**
- Click en ⭐ junto a la dirección deseada

**Eliminar Dirección:**
- Click en 🗑️ (No se puede eliminar la principal)

---

### 4️⃣ CREAR PRIMER COLABORADOR (7 min)
**URL:** http://localhost:4200/colaborador/create

#### Datos del Colaborador
```
Nombres: Juan Carlos
Apellidos: Pérez García
DNI: 12345678
Email: jperez@grupoferretero.com (será su usuario)
Celular: 987654321
```

#### Credenciales
```
Usuario: jperez@grupoferretero.com
Contraseña: Colaborador123@
Confirmar: Colaborador123@
```

#### Asignación
```
Rol: Seleccionar "Vendedor" o "Almacenero"
Estado: ✓ Activo
Sucursal: (Seleccionar la principal)
```

#### Guardar
```
Click "Registrar Colaborador"
```

**✅ Resultado:** Primer colaborador creado y puede iniciar sesión

---

### 5️⃣ CONFIGURACIÓN BÁSICA DE INVENTARIO (7 min)

#### A. Crear Categorías
**URL:** http://localhost:4200/categorias/create

```
Ejemplos:
- Herramientas
- Pinturas
- Construcción
- Electricidad
- Plomería
```

#### B. Crear Marcas
**URL:** http://localhost:4200/marcas/create

```
Ejemplos:
- Stanley
- Truper
- Vencedor
- Tekno
```

**✅ Resultado:** Estructura básica de inventario lista

---

## 🎯 CONFIGURACIÓN COMPLETA (2-3 horas)

Para una configuración más completa, consultar: **GUIA_ONBOARDING_EMPRESA.md**

### Incluye:
- ✅ Roles personalizados
- ✅ Múltiples sucursales
- ✅ Proveedores
- ✅ Clientes
- ✅ Configuración de facturación
- ✅ Series de comprobantes
- ✅ Configuración SUNAT

---

## 📊 PRÓXIMOS PASOS

Después de la configuración mínima:

### 1. Cargar Productos
```
URL: /productos
- Registrar productos iniciales
- Asignar categorías y marcas
- Establecer precios
```

### 2. Ingresar Stock Inicial
```
URL: /compras/create
- Crear primera compra
- Ingresar cantidades
- Asignar ubicaciones (si usa sistema de ubicaciones)
```

### 3. Realizar Primera Venta
```
URL: /ventas/create
- Probar flujo completo
- Verificar facturación
- Revisar stock actualizado
```

---

## 🔐 CREDENCIALES DE EJEMPLO

### Empresa Principal
```
RUC: 10456333538
Email: lucasdiduniakakao@gmail.com
Contraseña: E12345@a
Rol: Administrador (acceso completo)
```

### Colaborador (ejemplo)
```
Email: jperez@grupoferretero.com
Contraseña: Colaborador123@
Rol: Vendedor (acceso limitado)
```

---

## ⚠️ NOTAS IMPORTANTES

### Seguridad
- ✅ Las contraseñas deben tener mínimo 8 caracteres
- ✅ Incluir mayúsculas, minúsculas, números y caracteres especiales
- ✅ Cambiar contraseñas predeterminadas en primer acceso

### Permisos
- **Administrador:** Acceso completo al sistema
- **Vendedor:** Ventas, clientes, consulta de inventario
- **Almacenero:** Inventario, compras, movimientos de stock
- **Contador:** Reportes, análisis financiero, solo lectura

### Direcciones
- Solo puede haber UNA dirección principal
- La dirección principal se usa en todos los comprobantes
- No se puede eliminar la dirección principal
- Puedes tener múltiples direcciones adicionales

### Logo
- Formatos: PNG, JPG, JPEG, GIF, WEBP
- Tamaño máximo: 4 MB
- Recomendado: 200x200px o 500x500px
- Preferible: Fondo transparente (PNG)

---

## 🆘 SOLUCIÓN DE PROBLEMAS COMUNES

### No puedo iniciar sesión
```
✓ Verificar RUC correcto (11 dígitos)
✓ Verificar email exacto (mayúsculas/minúsculas)
✓ Verificar contraseña (sensible a mayúsculas)
✓ Esperar 24h si la cuenta es nueva
```

### No se sube el logo
```
✓ Verificar formato (PNG, JPG, etc.)
✓ Verificar tamaño (máx 4MB)
✓ Intentar con otra imagen
✓ Limpiar caché del navegador
```

### No puedo crear colaborador
```
✓ Verificar que existan roles creados
✓ Email debe ser único (no puede repetirse)
✓ Contraseña debe cumplir requisitos de seguridad
```

### No veo las provincias/distritos
```
✓ Primero seleccionar departamento
✓ Las provincias se cargan automáticamente
✓ Luego seleccionar provincia
✓ Los distritos se cargan automáticamente
```

---

## 📞 SOPORTE

**En caso de problemas técnicos:**
- Email: soporte@sistema.com
- Teléfono: (01) 123-4567
- Horario: Lunes a Viernes, 9am - 6pm

---

## ✅ CHECKLIST MÍNIMO

Antes de empezar a operar, verificar:

- [ ] Cuenta de empresa creada
- [ ] Login exitoso
- [ ] Logo subido
- [ ] Información corporativa completa
- [ ] Al menos 1 colaborador creado
- [ ] Al menos 3 categorías creadas
- [ ] Al menos 3 marcas creadas
- [ ] Dirección principal verificada

**Total estimado:** 30 minutos

---

*Última actualización: Enero 2026*
