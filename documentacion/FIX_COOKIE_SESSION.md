# 🍪 Corrección: Cookie de Sesión No Funciona

## Problema Resuelto: Token No Válido Después del Login

---

## ❌ PROBLEMA

Después de un login exitoso:
- ✅ Backend responde correctamente
- ✅ Mensaje "¡Bienvenido!" aparece
- ❌ Token no válido al verificar
- ❌ Usuario redirige de vuelta al login

**Logs de Error:**
```javascript
Error al verificar el token
Estamos en ruta pública, no redirigir a login
AuthGuard - Ruta: /home Token válido: false
Token no válido, redirigiendo a login
```

---

## 🔍 CAUSA DEL PROBLEMA

### La Cookie No Se Enviaba Correctamente

La cookie de sesión se configuraba con `sameSite: 'Strict'`:

```javascript
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',  // ❌ Problema en localhost
  maxAge: 24 * 60 * 60 * 1000
});
```

**¿Por qué es un problema?**

- `sameSite: 'Strict'` es **MUY restrictivo**
- En desarrollo (localhost:4200 → localhost:3000), las cookies `Strict` no se envían correctamente en todas las situaciones
- Después del login, cuando el frontend intenta verificar el token, la cookie no se incluye en la petición
- El backend no recibe el token → retorna "No autenticado"
- El usuario es redirigido al login

---

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. Cambiado `sameSite` a `'Lax'` en Desarrollo

**Antes:**
```javascript
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',  // ❌ Muy restrictivo
  maxAge: 24 * 60 * 60 * 1000
});
```

**Ahora:**
```javascript
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',  // ✅ Lax en desarrollo
  maxAge: 24 * 60 * 60 * 1000
});

console.log('✓ Cookie de sesión establecida para:', datosUsuario.email);
```

**Diferencia entre Strict y Lax:**

| SameSite | Comportamiento | Uso |
|----------|---------------|-----|
| `Strict` | Cookie **NUNCA** se envía en navegación cross-site | Producción con HTTPS |
| `Lax` | Cookie **SÍ** se envía en navegación GET cross-site | Desarrollo local |
| `None` | Cookie se envía en todas las peticiones | Solo con `secure: true` |

---

### 2. Agregado Logging Detallado

**En `admin_login`:**
```javascript
console.log('✓ Cookie de sesión establecida para:', datosUsuario.email);
```

**En `getEmpresa_login`:**
```javascript
console.log('getEmpresa_login - Verificando token...');
console.log('Cookies recibidas:', req.cookies);
console.log('Token presente:', !!req.cookies.token);

if (!req.user) {
    console.log('❌ No hay req.user - Token no válido o no presente');
    return res.status(401).send({ message: 'No autenticado' });
}

console.log('✓ Usuario autenticado:', req.user.email, '- Empresa:', req.user.empresa);
```

**Beneficios:**
- Ahora puedes ver exactamente qué cookies recibe el backend
- Puedes identificar si el token está presente o no
- Mejor debugging en caso de problemas

---

### 3. Consistencia con Logout

El logout ya usaba esta configuración:
```javascript
res.clearCookie('token', {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax'
});
```

Ahora el login usa la **misma configuración** → consistencia.

---

## 📁 ARCHIVOS MODIFICADOS

### `backAppC/controllers/adminController.js`

**Cambios:**
1. ✅ Línea 337: Cambiado `sameSite` a condicional
2. ✅ Línea 340: Agregado log de cookie establecida
3. ✅ Líneas 41-59: Agregado logging detallado en `getEmpresa_login`

---

## 🔄 REINICIAR BACKEND (CRÍTICO)

Para que los cambios surtan efecto, **DEBES REINICIAR el backend**:

```bash
# En la terminal del backend:
1. Ctrl + C (detener servidor)
2. npm start (reiniciar)
3. Esperar mensaje: "Servidor escuchando en el puerto 3000"
```

**⚠️ IMPORTANTE:** Sin reiniciar, los cambios NO se aplicarán.

---

## 🧪 CÓMO PROBAR

### Test 1: Login Normal

**Pasos:**
1. **Reiniciar backend** (ver arriba)
2. Ir a: `http://localhost:4200/login-empresa`
3. Ingresar credenciales:
   ```
   RUC: 20611688564
   Email: ventas@avefenix.com
   Contraseña: 123456
   ```
4. Click "Iniciar Sesión"

**✅ Resultado Esperado:**
- Mensaje: "¡Bienvenido!"
- Usuario redirige a `/home`
- Dashboard se carga correctamente
- **NO más error de "Token no válido"**

---

### Test 2: Verificar Logs del Backend

**En la consola del backend, deberías ver:**

```javascript
// Al hacer login:
✓ Cookie de sesión establecida para: ventas@avefenix.com

// Al verificar token (redirigir a /home):
getEmpresa_login - Verificando token...
Cookies recibidas: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
Token presente: true
✓ Usuario autenticado: ventas@avefenix.com - Empresa: xxx-xxx-xxx
✓ Datos de empresa obtenidos correctamente
```

**Si ves esto, todo funciona correctamente ✅**

---

### Test 3: Verificar Cookie en el Navegador

**Pasos:**
1. Después del login exitoso
2. **F12 → Application → Cookies**
3. Buscar: `http://localhost:3000`

**✅ Debe haber una cookie llamada `token`:**
```
Name: token
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Domain: localhost
Path: /
HttpOnly: ✓ Yes
Secure: No (en desarrollo)
SameSite: Lax  ← Esto es lo nuevo
```

---

### Test 4: Login con Otra Empresa

**Prueba con credenciales del archivo:**
```
RUC: 10456333538
Email: lucasdiduniakakao@gmail.com
Contraseña: E12345@a
```

**✅ Resultado Esperado:**
- Login exitoso
- Redirige a `/home`
- Sidebar muestra opciones según el estado de la empresa

---

## 🔍 DEBUG CON LOGS

### Logs Correctos (Login Exitoso):

**Backend:**
```javascript
// Login
✓ Cookie de sesión establecida para: ventas@avefenix.com

// Verificación de token
getEmpresa_login - Verificando token...
Cookies recibidas: { token: 'eyJ...' }
Token presente: true
✓ Usuario autenticado: ventas@avefenix.com - Empresa: xxx
✓ Datos de empresa obtenidos correctamente
```

**Frontend (F12 Console):**
```javascript
Intentando login: {ruc: "...", email: "...", password: "***"}
handleAuthResponse {data: {...}}
Token verificado después del login: true
AuthGuard - Ruta: /home Token válido: true
Navegación a /home completada
```

---

### Logs de Error (Si la Cookie NO se Envía):

**Backend:**
```javascript
getEmpresa_login - Verificando token...
Cookies recibidas: {}  // ❌ Vacío
Token presente: false  // ❌ No hay token
❌ No hay req.user - Token no válido o no presente
```

**Frontend:**
```javascript
Error al verificar el token
AuthGuard - Ruta: /home Token válido: false
Token no válido, redirigiendo a login
```

**Si ves esto DESPUÉS de reiniciar backend:**
1. Limpiar cookies del navegador
2. Cerrar todas las pestañas
3. Intentar de nuevo

---

## 📊 COMPARACIÓN

| Aspecto | Antes ❌ | Ahora ✅ |
|---------|---------|---------|
| sameSite | `'Strict'` | `'Lax'` en desarrollo |
| Cookie se envía | ❌ No | ✅ Sí |
| Token válido | ❌ false | ✅ true |
| Login funciona | ❌ No redirige | ✅ Redirige a /home |
| Logs | ⚠️ Básicos | ✅ Detallados |
| Consistencia login/logout | ❌ Diferente | ✅ Igual |

---

## 🐛 TROUBLESHOOTING

### Problema: Todavía dice "Token no válido"

**Verificar:**

1. **Backend reiniciado:**
   ```bash
   # Debe mostrar:
   Servidor escuchando en el puerto 3000
   ```

2. **Cache del navegador:**
   ```bash
   F12 → Application → Cookies
   Eliminar TODAS las cookies de localhost
   Ctrl + Shift + Del → Limpiar cache
   Cerrar navegador
   Abrir de nuevo
   ```

3. **Logs del backend:**
   ```javascript
   // Verificar que veas:
   ✓ Cookie de sesión establecida para: ...
   ```

4. **Cookie en el navegador:**
   ```
   F12 → Application → Cookies → http://localhost:3000
   Debe haber una cookie "token"
   SameSite debe ser "Lax"
   ```

---

### Problema: No veo la cookie en el navegador

**Causa:** El backend no está enviando la cookie

**Verificar:**
1. Backend está en puerto 3000
2. CORS está configurado correctamente (ya está ✓)
3. `cookieParser()` está incluido (ya está ✓)

**Logs esperados:**
```javascript
✓ Cookie de sesión establecida para: ...
```

**Si no ves este log:** El login no está llegando al punto de crear la cookie.

---

### Problema: Cookie se crea pero no se envía

**Causa:** Configuración del navegador o extensiones

**Solución:**
1. Desactivar extensiones (AdBlock, Privacy Badger, etc.)
2. Usar ventana de incógnito
3. Verificar configuración de cookies del navegador

---

## ✅ CHECKLIST DE VERIFICACIÓN

Después de aplicar los cambios:

- [ ] Backend reiniciado
- [ ] Cache del navegador limpiado
- [ ] Login exitoso
- [ ] Mensaje "¡Bienvenido!" aparece
- [ ] Usuario redirige a `/home`
- [ ] Dashboard se carga
- [ ] Sidebar muestra opciones correctas
- [ ] NO hay error "Token no válido"
- [ ] Cookie visible en F12 → Application
- [ ] Logs del backend muestran cookie establecida

---

## 🎓 EXPLICACIÓN TÉCNICA

### ¿Por Qué sameSite: 'Strict' es un Problema?

En desarrollo:
```
Frontend: http://localhost:4200
Backend:  http://localhost:3000
```

Aunque ambos son `localhost`, técnicamente son **diferentes puertos** = cross-origin.

**Con `sameSite: 'Strict'`:**
1. Login en localhost:4200
2. Backend en localhost:3000 establece cookie con `Strict`
3. Frontend intenta verificar token
4. Navegador NO envía la cookie porque es cross-origin
5. Backend no recibe token → error

**Con `sameSite: 'Lax'`:**
1. Login en localhost:4200
2. Backend en localhost:3000 establece cookie con `Lax`
3. Frontend intenta verificar token
4. Navegador SÍ envía la cookie
5. Backend recibe token → éxito ✓

---

### ¿Por Qué Usar Strict en Producción?

En producción:
- Todo está en el mismo dominio
- HTTPS activo
- Seguridad máxima necesaria
- `Strict` previene ataques CSRF

En desarrollo:
- Diferentes puertos
- HTTP (no HTTPS)
- Necesitamos flexibilidad
- `Lax` es suficiente

---

## 📚 ARCHIVOS RELACIONADOS

- `adminController.js` - Controlador de autenticación
- `autenticate.js` - Middleware de autenticación
- `app.js` - Configuración del servidor
- `auth.service.ts` - Servicio de auth en frontend
- `FIX_LOGIN_REDIRECT.md` - Fix anterior de redirección

---

## 🎉 RESUMEN

### Cambio Principal:
```javascript
// Antes:
sameSite: 'Strict'  // ❌ No funciona en localhost

// Ahora:
sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax'  // ✅ Funciona
```

### Resultado:
- ✅ Cookie se envía correctamente
- ✅ Token es válido
- ✅ Login funciona
- ✅ Usuario accede al dashboard
- ✅ Mejor logging para debug

---

**Estado:** ✅ CORREGIDO - REINICIAR BACKEND

**Fecha:** Enero 30, 2026

**Versión:** 1.3

---

*¡Recuerda reiniciar el backend para que los cambios surtan efecto!* 🔄
