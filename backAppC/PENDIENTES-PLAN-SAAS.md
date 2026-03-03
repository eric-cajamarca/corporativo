# Pendientes del plan SaaS (crear empresa, verificación, integraciones, pagos)

## Ya implementado

- **Ruta pública crear empresa:** `POST /api/empresa` sin auth; empresa con `estado = 0`.
- **Verificación por WhatsApp:** tabla `EmpresaVerificacion`, código de 6 dígitos, envío vía Twilio (variables de entorno globales).
- **Ruta pública verificar:** `POST /api/empresa/verificar` con `{ idEmpresa, codigo }`; marca empresa como verificada y `Empresas.estado = 1`.
- **Tablas:** `EmpresaVerificacion`, `EmpresaIntegraciones`, `EmpresaApiCredenciales`, `EmpresaBilleteras`, `PagosSuscripcionEmpresa`.
- **Servicio de integraciones:** `obtenerIntegracionesEmpresa`, `obtenerCredencialesProveedor`, `construirOrderNumber`, `parsearOrderNumber`.
- **Webhooks multiempresa:** `POST /api/webhooks/izipay` y `POST /api/webhooks/culqi` actualizan `PagosSuscripcionEmpresa` por `orderNumber` (patrón `idEmpresa-uuid`).
- **Frontend:** ruta `/crear-empresa` pública; formulario llama a `createEmpresa` y muestra mensaje del backend.

---

## Lo que falta implementar

### 1. Pantalla “Verificar empresa” en el frontend
- **Qué:** Página (o paso tras crear empresa) donde el usuario ingrese **idEmpresa** + **código** y llame a `POST /api/empresa/verificar`.
- **Al éxito:** redirigir al login (o mostrar mensaje “Cuenta activada, inicia sesión”).
- **Hoy:** la verificación solo se puede hacer por Postman/API (ver `PRUEBAS-SaaS-CREAR-EMPRESA-Y-VERIFICACION.md`).

---

### 2. Empresa “principal” (dueña del SaaS) y superAdmin
- **Qué:** Definir qué empresa es la “principal” (`idEmpresaPrincipal` en `PagosSuscripcionEmpresa` es quien recibe los pagos).
- **Falta:**
  - Columna en `Empresas` para marcar la empresa principal (ej. `esPrincipal BIT`) o convención (ej. primera empresa).
  - Lógica al crear la primera empresa (o por panel admin): marcar como principal y, si aplica, crear usuario superAdmin.
- **Uso:** al crear un pago de suscripción se necesita saber `idEmpresaPrincipal` para insertar en `PagosSuscripcionEmpresa`.

---

### 3. Middleware “verificarIntegracion” y uso por empresa
- **Qué:** Antes de usar Twilio / Izipay / Culqi, comprobar que la empresa tenga esa integración habilitada en `EmpresaIntegraciones` (y opcionalmente usar credenciales de `EmpresaApiCredenciales`).
- **Falta:**
  - Middleware `verificarIntegracion(proveedor)` que lea `req.user.empresa`, consulte `EmpresaIntegraciones` y, si no está habilitado, responda 403 o mensaje claro.
  - Aplicar ese middleware en las rutas que envían WhatsApp o crean cobros (cuando existan).
- **Hoy:** WhatsApp usa solo variables de entorno globales (`TWILIO_*`); no se consulta `EmpresaIntegraciones` ni credenciales por empresa.

---

### 4. Insertar EmpresaIntegraciones al crear empresa
- **Qué:** Al dar de alta una empresa nueva, crear una fila en `EmpresaIntegraciones` (todos los flags en 0 o según configuración por defecto).
- **Hoy:** La tabla existe pero no se inserta nada en `createEmpresa`; al consultar `obtenerIntegracionesEmpresa` siempre sería `null` para empresas nuevas.

---

### 5. Flujo de creación de pago de suscripción (backend + frontend)
- **Qué:** Endpoint(s) que:
  - Reciban datos del plan (monto, periodo, idEmpresaCliente = empresa que paga).
  - Obtengan `idEmpresaPrincipal` (empresa dueña del SaaS).
  - Generen `orderNumber` con `construirOrderNumber(idEmpresaCliente)`.
  - Inserten en `PagosSuscripcionEmpresa` (idEmpresaPrincipal, idEmpresaCliente, orderNumber, monto, periodo, origen = 'izipay' o 'culqi').
  - Devuelvan al frontend el `orderNumber` y la URL o datos necesarios para redirigir a Izipay/Culqi.
- **Hoy:** Solo están los webhooks que **actualizan** el estado del pago cuando la pasarela notifica; no hay endpoint que **cree** el registro de pago ni que devuelva la URL de pago.

---

### 6. Credenciales por empresa para WhatsApp (opcional)
- **Qué:** Que el envío del código de verificación use, si existen, las credenciales de Twilio guardadas en `EmpresaApiCredenciales` para esa empresa; si no, fallback a variables de entorno globales.
- **Requiere:** Insertar/gestión de credenciales por empresa y que `enviarCodigoVerificacionWhatsApp` (o el controller) use `obtenerCredencialesProveedor(pool, idEmpresa, 'twilio')` antes de enviar.

---

### 7. Ajuste de payloads de webhooks a documentación real
- **Qué:** Revisar la documentación de Izipay y Culqi y ajustar en `routes/webhooks.js` los nombres de campos (ej. `status`, `transactionStatus`, `transactionId`, `event.type`, `data.object`) para que coincidan con lo que realmente envían las pasarelas.
- **Hoy:** Los webhooks están implementados con nombres genéricos; pueden fallar o no mapear bien si las APIs envían otros nombres.

---

## Resumen de prioridad sugerida

| Prioridad | Item | Esfuerzo |
|-----------|------|----------|
| Alta      | Pantalla “Verificar empresa” en Angular | Bajo |
| Alta      | Insertar `EmpresaIntegraciones` al crear empresa | Bajo |
| Media     | Empresa principal (esPrincipal / primera empresa) y uso en pagos | Medio |
| Media     | Endpoint crear pago de suscripción + orderNumber + URL pasarela | Medio |
| Baja      | Middleware `verificarIntegracion` en rutas de integraciones | Bajo |
| Baja      | Credenciales Twilio por empresa | Medio |
| Baja      | Ajuste payloads webhooks Izipay/Culqi | Bajo |

---

## Implementación completada (todos los puntos)

1. **Pantalla Verificar empresa:** Componente `verificar-empresa`, ruta `/verificar-empresa`, `EmpresaService.verificarEmpresa()`. Tras crear empresa, botón "Activar con código" lleva a verificar con idEmpresa en query; al éxito redirige al login.
2. **Empresa principal:** Migración `add_esPrincipal_empresas.sql`; `marcarEmpresaPrincipalSiEsPrimera()` en createEmpresa; endpoint de pago usa `Empresas WHERE esPrincipal = 1`.
3. **Middleware verificarIntegracion:** `middlewares/verificarIntegracion.js`; aplicado en `POST /api/suscripcion/crear-pago`.
4. **Insertar EmpresaIntegraciones:** `insertarEmpresaIntegraciones(pool, idEmpresa)` en createEmpresa.
5. **Endpoint crear pago:** `POST /api/suscripcion/crear-pago` (auth + verificarIntegracion). Body: `{ monto, periodo, origen }`. Devuelve `orderNumber`, `idPago`.
6. **Credenciales Twilio por empresa:** `obtenerCredencialesProveedor(pool, idEmpresa, 'twilio')` en createEmpresa; `enviarCodigoVerificacionWhatsApp(..., creds)` con fallback a env.
7. **Webhooks:** Más variantes de campos en `routes/webhooks.js` (order_number, status, transactionId, etc.).
