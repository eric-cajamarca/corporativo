# Cómo probar: Crear empresa (público) y verificación por WhatsApp

## 1. Requisitos previos

### 1.1 Base de datos
Ejecuta las migraciones en este orden:

1. **Tablas de integraciones y pagos:** `backAppC/migrations/create_empresa_integraciones_y_pagos.sql`  
   (EmpresaVerificacion, EmpresaIntegraciones, EmpresaApiCredenciales, EmpresaBilleteras, PagosSuscripcionEmpresa.)
2. **Columna empresa principal:** `backAppC/migrations/add_esPrincipal_empresas.sql`  
   (Añade `esPrincipal` a `Empresas` para el flujo de pagos SaaS.)

### 1.2 Variables de entorno (backAppC)
En `backAppC/.env` (opcional para envío real por WhatsApp):

```env
TWILIO_ACCOUNT_SID=ACxxxx...
TWILIO_AUTH_TOKEN=xxxx...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Si no configuras Twilio, la empresa se crea igual y el código se guarda en `EmpresaVerificacion`; puedes leerlo en la BD para las pruebas.

### 1.3 Servicios en ejecución
- **Backend:** en `backAppC` ejecuta `node app.js` o `npm run start` (puerto 3000).
- **Frontend:** en `adminSPA` ejecuta `ng serve` o `npm start`.

---

## 2. Flujo de prueba

### Paso A: Crear empresa (sin estar logueado)

1. Abre el navegador y ve a la ruta de **crear empresa** (debe ser pública, sin login):
   - Ejemplo: `http://localhost:4200/crear-empresa`
2. Completa el formulario:
   - RUC válido (11 dígitos).
   - Datos de empresa, **celular** (formato que acepte Twilio, ej. +51987654321).
   - Usuario y contraseña para el primer usuario de la empresa.
3. Envía el formulario.
4. Debes ver un mensaje de éxito indicando que se envió un código por WhatsApp (o que la empresa fue creada). La respuesta del backend incluye `data: idEmpresa`.

**Si falla:** revisa que la migración esté aplicada y que el backend esté levantado. Si Twilio no está configurado, el backend puede devolver error en el envío; en ese caso revisa que solo falle el envío y no la creación de la empresa (el registro en `EmpresaVerificacion` debe crearse).

---

### Paso B: Obtener el código de verificación

- **Con Twilio configurado:** revisa el WhatsApp del número que pusiste en el formulario.
- **Sin Twilio (pruebas):** consulta el código en la base de datos:

```sql
SELECT TOP 1 idEmpresa, codigo, estado, fCreacion
FROM EmpresaVerificacion
WHERE idEmpresa = 'TU-ID-EMPRESA-AQUI'
ORDER BY fCreacion DESC;
```

Usa el mismo `idEmpresa` que devolvió el backend al crear la empresa (o el que ves en la tabla `Empresas`).

---

### Paso C: Verificar la empresa (activar cuenta)

**Opción 1 – Pantalla en el frontend (recomendado)**

1. Tras crear la empresa, en la pantalla de éxito haz clic en **"Activar con código"** (te lleva a `/verificar-empresa?idEmpresa=...`).
2. Ingresa el código de 6 dígitos que recibiste por WhatsApp (o el que consultaste en la BD).
3. Clic en **"Activar cuenta"**. Si es correcto, verás mensaje de éxito y serás redirigido al login.

**Opción 2 – Postman o similar**

- **URL:** `POST http://localhost:3000/api/empresa/verificar`
- **Headers:** `Content-Type: application/json`
- **Body (raw JSON):**

```json
{
  "idEmpresa": "uuid-de-la-empresa-creada",
  "codigo": "123456"
}
```

Sustituye `uuid-de-la-empresa-creada` por el `idEmpresa` del paso A y `123456` por el código obtenido en el paso B.

**Opción 3 – PowerShell**

```powershell
$body = @{ idEmpresa = "uuid-aqui"; codigo = "123456" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/empresa/verificar" -Method Post -Body $body -ContentType "application/json"
```

**Respuesta esperada:** `200` con `data: { ok: true }` y mensaje de empresa verificada y habilitada.

Tras esto, en la BD la empresa debe tener `estado = 1` y el registro en `EmpresaVerificacion` debe estar marcado como verificado.

---

### Paso D: Iniciar sesión con la nueva empresa

1. Ve a la pantalla de login de la app (ej. `http://localhost:4200/login-empresa`).
2. Ingresa el **usuario** y **contraseña** que definiste al crear la empresa.
3. El login debe ser correcto y debes entrar al panel (la empresa ya está con `estado = 1`).

Si el login falla con “empresa deshabilitada” o similar, confirma en la BD que `Empresas.estado = 1` para esa empresa.

---

## 3. Resumen de rutas usadas

| Acción              | Ruta / método              | Auth   |
|---------------------|----------------------------|--------|
| Crear empresa       | `POST /api/empresa`        | No     |
| Verificar empresa   | `POST /api/empresa/verificar` | No  |
| Login               | Según tu app (ej. `POST /api/getEmpresa_login`) | No (login) |

---

## 4. Errores frecuentes

- **Backend no arranca:** revisa que no haya errores de sintaxis en `empresasController.js` y que la conexión a SQL Server esté bien en `.env`.
- **Tabla EmpresaVerificacion no existe:** ejecuta la migración `create_empresa_integraciones_y_pagos.sql`.
- **“Empresa deshabilitada” al hacer login:** la empresa está con `estado = 0`; ejecuta el paso C (verificar) y comprueba `Empresas.estado = 1`.
- **ECONNREFUSED en login:** el frontend está llamando al backend en un puerto/host equivocado; revisa `environment` (ej. `apiUrl`) y que el backend esté corriendo en ese puerto (3000).

Cuando todo esté correcto: crear empresa (público) → obtener código (WhatsApp o BD) → verificar con `POST /api/empresa/verificar` → login con ese usuario/contraseña.
