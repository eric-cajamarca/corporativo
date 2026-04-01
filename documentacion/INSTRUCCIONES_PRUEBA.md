# 🧪 Instrucciones de Prueba

## Para el Usuario: Cómo Probar el Sistema Completo

---

## ⚠️ IMPORTANTE: Reiniciar Backend

Antes de probar, **DEBES REINICIAR** el servidor backend para que los cambios surtan efecto:

```bash
# En la terminal del backend:
1. Detener el servidor (Ctrl + C)
2. Reiniciar: npm start
3. Esperar mensaje: "Servidor corriendo en puerto 3000"
```

**El frontend NO necesita reiniciarse.**

---

## 🎯 PRUEBA 1: Crear Nueva Empresa con Roles Automáticos

### Objetivo:
Verificar que el sistema crea automáticamente los 4 roles al registrar una empresa.

### Pasos:

1. **Ir a registro:**
   ```
   http://localhost:4200/crear-empresa
   ```

2. **Ingresar RUC de prueba:**
   ```
   RUC: 20603181680
   Click "Verificar"
   ```

3. **Esperar datos de SUNAT:**
   - Razón Social: GRUPO FERRETERO TORRES E.I.R.L.
   - Dirección automática
   - Estado: ACTIVO

4. **Click "Continuar"**

5. **Ingresar credenciales:**
   ```
   Email: prueba@grupoferretero.com
   Contraseña: Test1234@.
   Confirmar: Test1234@.
   ✓ Aceptar términos
   ```

6. **Click "Registrar Empresa"**

7. **Verificar en BD (SQL Server):**
   ```sql
   -- Obtener el idEmpresa recién creado
   SELECT TOP 1 idEmpresa, razon_Social, correo 
   FROM Empresas 
   WHERE ruc = '20603181680'
   ORDER BY fRegistro DESC;
   
   -- Copiar el idEmpresa y usarlo aquí:
   SELECT * FROM Rol 
   WHERE idEmpresa = 'ID-QUE-COPIASTE'
   ORDER BY descripcion;
   ```

### ✅ Resultado Esperado:
```
Descripción    | Estado | fCreacion
---------------|--------|------------------
Administrador  | 1      | 2026-01-30 ...
Almacenero     | 1      | 2026-01-30 ...
Contador       | 1      | 2026-01-30 ...
Vendedor       | 1      | 2026-01-30 ...
```

---

## 🎯 PRUEBA 2: Verificar Sidebar Dinámico (Empresa Nueva)

### Objetivo:
Verificar que el sidebar solo muestra opciones básicas para empresa sin colaboradores.

### Pasos:

1. **Iniciar sesión:**
   ```
   URL: http://localhost:4200/login-empresa
   
   RUC: 20603181680
   Email: prueba@grupoferretero.com
   Contraseña: Test1234@.
   ```

2. **Observar el sidebar (menú lateral izquierdo)**

3. **Abrir DevTools (F12) → Console:**
   ```javascript
   // Buscar estos logs:
   Estado de configuración: {
     tieneColaboradores: false,
     cantidadColaboradores: 0,
     ...
   }
   ```

4. **Abrir DevTools (F12) → Network:**
   - Buscar petición: `estado_configuracion`
   - Ver respuesta

### ✅ Resultado Esperado:

**Sidebar muestra SOLO:**
- Dashboard
- ───────────
- Configuración Empresa
- ⭐ Crear Primer Colaborador

**Sidebar NO muestra:**
- ❌ Ventas
- ❌ Compras
- ❌ Inventario
- ❌ Productos
- ❌ Clientes
- ❌ Proveedores

---

## 🎯 PRUEBA 3: Crear Colaborador con Roles Cargados

### Objetivo:
Verificar que el formulario de colaboradores ahora SÍ carga los roles.

### Pasos:

1. **Click en "⭐ Crear Primer Colaborador"**
   ```
   O ir directamente a:
   http://localhost:4200/colaborador/create
   ```

2. **Abrir DevTools (F12) → Console:**
   ```javascript
   // Buscar estos logs:
   response.data: Array(4)
     0: {idRol: "...", descripcion: "Administrador", ...}
     1: {idRol: "...", descripcion: "Almacenero", ...}
     2: {idRol: "...", descripcion: "Contador", ...}
     3: {idRol: "...", descripcion: "Vendedor", ...}
   this.roles: Array(4)
   ```

3. **Completar formulario:**
   ```
   Nombres: Juan Carlos
   Apellidos: Pérez García
   DNI: 12345678
   Email: jperez@grupoferretero.com
   Celular: 987654321
   ```

4. **Verificar dropdown de roles:**
   - Debe mostrar: Administrador, Vendedor, Almacenero, Contador
   - Seleccionar: **Administrador**

5. **Crear credenciales:**
   ```
   Usuario: jperez@grupoferretero.com (o dejar vacío)
   Contraseña: Colab123@.
   Confirmar: Colab123@.
   ✓ Marcar "Activo"
   ```

6. **Click "Registrar Colaborador"**

### ✅ Resultado Esperado:
- Roles se cargan correctamente en el dropdown
- Colaborador se crea sin errores
- Mensaje: "Se registró correctamente el colaborador"
- Redirige a `/colaborador`

---

## 🎯 PRUEBA 4: Verificar Sidebar Completo (Con Colaborador)

### Objetivo:
Verificar que el sidebar ahora muestra todas las opciones.

### Pasos:

1. **Recargar la página (F5)**
   ```
   O navegar a cualquier otra sección
   ```

2. **Abrir DevTools (F12) → Console:**
   ```javascript
   // Buscar estos logs:
   Estado de configuración: {
     tieneColaboradores: true,    ← Cambió a true
     cantidadColaboradores: 1,     ← Ahora es 1
     ...
   }
   ```

3. **Observar el sidebar**

### ✅ Resultado Esperado:

**Sidebar ahora muestra:**
- Dashboard
- ───────────
- Configuración Empresa
- ───────────
- ✅ Colaboradores
- ✅ Ventas
- ✅ Compras
- ✅ Inventario
- ✅ Productos
- ✅ Clientes
- ✅ Proveedores
- ───────────
- ✅ Configuración

**Todas las opciones deben estar visibles y funcionales.**

---

## 🎯 PRUEBA 5: Login con Empresa Existente

### Objetivo:
Verificar el flujo con la empresa que ya existe.

### Pasos:

1. **Cerrar sesión**

2. **Iniciar sesión con empresa existente:**
   ```
   URL: http://localhost:4200/login-empresa
   
   RUC: 10456333538
   Email: lucasdiduniakakao@gmail.com
   Contraseña: E12345@a
   ```

3. **Observar el sidebar**

### ✅ Resultado Esperado:
- Si esta empresa YA tiene colaboradores, el sidebar debe mostrar TODAS las opciones
- El sistema debe funcionar normalmente

---

## 🎯 PRUEBA 6: Configurar Empresa (Logo y Datos)

### Objetivo:
Completar la configuración de la empresa.

### Pasos:

1. **Ir a editar empresa:**
   ```
   Sidebar → Configuración Empresa
   O directamente: http://localhost:4200/editar-empresa
   ```

2. **Subir logo:**
   - Click "Seleccionar imagen"
   - Elegir un logo (PNG/JPG, máx 4MB)
   - Ver preview

3. **Completar datos:**
   ```
   Rubro: Ferretería y materiales de construcción
   Celular: 999888777
   Nombre Comercial: GRUPO FERRETERO
   Alias: FERRETEC
   ```

4. **Click "Actualizar Empresa"**

### ✅ Resultado Esperado:
- Logo se sube correctamente
- Datos se actualizan
- Mensaje: "Empresa actualizada correctamente"

---

## 🎯 PRUEBA 7: Agregar Dirección Adicional

### Objetivo:
Probar la gestión de direcciones múltiples.

### Pasos:

1. **En la misma página de editar empresa, scroll down**

2. **Click "Nueva dirección"**

3. **Completar datos:**
   ```
   Departamento: Lima
   Provincia: Lima
   Distrito: Miraflores
   Dirección: Av. Larco 1234, Miraflores
   Ubigeo: 150122
   ```

4. **Click "Guardar"**

### ✅ Resultado Esperado:
- Nueva dirección aparece en la lista
- Dirección original sigue marcada como "Principal"
- Puedes cambiar la principal con el botón ⭐

---

## 🎯 PRUEBA 8: Crear Categorías y Marcas

### Objetivo:
Preparar el inventario para productos.

### Pasos:

1. **Crear categorías:**
   ```
   URL: http://localhost:4200/categorias/create
   
   Categorías sugeridas:
   - Herramientas
   - Pinturas
   - Construcción
   - Electricidad
   - Plomería
   ```

2. **Crear marcas:**
   ```
   URL: http://localhost:4200/marcas/create
   
   Marcas sugeridas:
   - Stanley
   - Truper
   - Vencedor
   - Tekno
   ```

### ✅ Resultado Esperado:
- Categorías y marcas se crean correctamente
- Están disponibles al crear productos

---

## 🎯 PRUEBA 9: Registrar Proveedor

### Objetivo:
Tener proveedores para registrar compras.

### Pasos:

1. **Ir a proveedores:**
   ```
   Sidebar → Proveedores → Crear
   O: http://localhost:4200/proveedores/create
   ```

2. **Completar datos:**
   ```
   RUC: 20123456789
   Razón Social: FERRETERÍA DEL NORTE S.A.C.
   Dirección: Av. Industrial 456
   Teléfono: 987654321
   Email: ventas@ferreriadelnorte.com
   ```

3. **Click "Registrar"**

### ✅ Resultado Esperado:
- Proveedor registrado
- Aparece en la lista de proveedores
- Disponible para compras

---

## 🎯 PRUEBA 10: Crear Primera Compra

### Objetivo:
Registrar una compra completa.

**NOTA:** Esta prueba requiere tener:
- ✅ Proveedor registrado
- ✅ Al menos 1 producto en el catálogo

### Pasos:

1. **Ir a compras:**
   ```
   Sidebar → Compras → Crear
   O: http://localhost:4200/compras/create
   ```

2. **Completar datos generales:**
   ```
   Sucursal: Sucursal Principal
   Tipo Comprobante: Factura
   Proveedor: FERRETERÍA DEL NORTE S.A.C.
   Serie: F001
   Número: 00000001
   Fecha Emisión: 30/01/2026
   Moneda: PEN (Soles)
   Estado Pago: Pagado
   Medio Pago: Transferencia Bancaria
   ```

3. **Agregar producto:**
   - Buscar producto existente
   - Cantidad: 10
   - Precio unitario: 25.00
   - Click "Agregar"

4. **Verificar totales:**
   - Subtotal: S/ 250.00
   - IGV (18%): S/ 45.00
   - Total: S/ 295.00

5. **Click "Registrar Compra"**

### ✅ Resultado Esperado:
- Compra registrada exitosamente
- Stock actualizado automáticamente
- Lote creado (si aplica)
- Redirige a lista de compras

---

## 📋 CHECKLIST COMPLETO DE PRUEBAS

### Fase 1: Configuración Inicial
- [ ] ✅ Crear nueva empresa
- [ ] ✅ Verificar roles en BD (deben ser 4)
- [ ] ✅ Primer login
- [ ] ✅ Sidebar muestra solo opciones básicas

### Fase 2: Primer Colaborador
- [ ] ✅ Acceder a "Crear Primer Colaborador"
- [ ] ✅ Roles se cargan en dropdown
- [ ] ✅ Crear colaborador administrador
- [ ] ✅ Verificar mensaje de éxito

### Fase 3: Navegación Completa
- [ ] ✅ Recargar página
- [ ] ✅ Sidebar muestra todas las opciones
- [ ] ✅ Estado de configuración = true

### Fase 4: Configuración de Empresa
- [ ] ✅ Subir logo
- [ ] ✅ Completar datos corporativos
- [ ] ✅ Agregar dirección adicional
- [ ] ✅ Guardar cambios

### Fase 5: Preparar Inventario
- [ ] ✅ Crear 5 categorías
- [ ] ✅ Crear 5 marcas
- [ ] ✅ Registrar 1 proveedor

### Fase 6: Primera Compra (Opcional)
- [ ] ⏸️ Crear productos (si no existen)
- [ ] ⏸️ Registrar compra de prueba
- [ ] ⏸️ Verificar stock actualizado

---

## 🐛 SI ENCUENTRAS ERRORES

### Error: "Usted no tiene acceso a roles"

**Causa:** Backend no se reinició o roles no se crearon.

**Solución:**
1. Reiniciar backend
2. Verificar en BD que existen roles:
   ```sql
   SELECT * FROM Rol WHERE idEmpresa = 'TU-ID';
   ```
3. Si no hay roles, ejecutar manualmente:
   ```sql
   DECLARE @idEmpresa UNIQUEIDENTIFIER = 'TU-ID-EMPRESA';
   
   INSERT INTO Rol (idRol, idEmpresa, descripcion, estado, fCreacion) VALUES
   (NEWID(), @idEmpresa, 'Administrador', 1, GETDATE()),
   (NEWID(), @idEmpresa, 'Vendedor', 1, GETDATE()),
   (NEWID(), @idEmpresa, 'Almacenero', 1, GETDATE()),
   (NEWID(), @idEmpresa, 'Contador', 1, GETDATE());
   ```

---

### Error: Sidebar no cambia después de crear colaborador

**Causa:** Cache del navegador.

**Solución:**
1. Cerrar sesión
2. Limpiar cache (Ctrl + Shift + Del)
3. Cerrar navegador completamente
4. Abrir navegador e iniciar sesión

---

### Error: "La Empresa ya existe"

**Causa:** El RUC ya fue registrado anteriormente.

**Solución:**
- Usar otro RUC para pruebas
- O eliminar registro anterior en BD (solo para desarrollo)

---

## 📊 LOGS A VERIFICAR

### Backend (Consola de Node.js)

Al crear empresa, debes ver:
```
entro a createEmpresa { idDocumento: '6', ruc: '20603181680', ... }
✓ Empresa creada con ID: 099a0dda-d82c-47d2-8d02-1cf27e816afd
Creando roles predeterminados para empresa: 099a0dda-d82c-47d2-8d02-1cf27e816afd
Rol creado: Administrador (xxx-xxx-xxx)
Rol creado: Vendedor (xxx-xxx-xxx)
Rol creado: Almacenero (xxx-xxx-xxx)
Rol creado: Contador (xxx-xxx-xxx)
✓ 4 roles predeterminados creados
✓ Roles predeterminados creados para la empresa
```

**Si NO ves estos logs:** El backend no se reinició correctamente.

### Frontend (Consola del Navegador F12)

Al cargar sidebar:
```javascript
Estado de configuración: {
  tieneColaboradores: false,
  cantidadColaboradores: 0,
  tieneProductos: false,
  ...
}
```

Al cargar formulario de colaboradores:
```javascript
response.data: Array(4)
this.roles: [...]
```

---

## 🎓 ORDEN RECOMENDADO DE PRUEBAS

### Para Probar TODO el Sistema:

1. **✅ Reiniciar backend** (CRÍTICO)
2. **✅ Crear nueva empresa** (Prueba 1)
3. **✅ Verificar roles en BD** (SQL)
4. **✅ Primer login** (Prueba 2)
5. **✅ Verificar sidebar reducido** (Prueba 2)
6. **✅ Crear colaborador** (Prueba 3)
7. **✅ Verificar sidebar completo** (Prueba 4)
8. **✅ Configurar empresa** (Prueba 6)
9. **✅ Crear categorías y marcas** (Prueba 8)
10. **✅ Registrar proveedor** (Prueba 9)
11. **⏸️ Crear primera compra** (Prueba 10) - Opcional

**Tiempo total:** 15-20 minutos

---

## 📱 CONTACTO

Si encuentras algún error que no esté documentado:

1. **Capturar:**
   - Screenshot del error
   - Logs de la consola (F12)
   - Logs del backend

2. **Reportar:**
   - Descripción del error
   - Pasos para reproducir
   - Logs capturados

---

## ✨ RESUMEN

**Todo está listo para probar:**

- ✅ Código modificado y funcionando
- ✅ Documentación completa
- ✅ Instrucciones paso a paso
- ✅ Troubleshooting incluido

**Solo necesitas:**

1. 🔄 Reiniciar backend
2. 🧪 Seguir las pruebas
3. ✅ Verificar resultados

---

**¡Buena suerte con las pruebas! 🚀**

*Última actualización: Enero 30, 2026*
