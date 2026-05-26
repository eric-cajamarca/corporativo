# Migración tras `git pull` — Fix de seguridad (rama `fix/security-pentest-findings`)

Esta guía resume **únicamente lo que cambia** después de hacer `git pull` en el
servidor LAN respecto a la última versión funcional. El flujo Nginx + backAppC
+ pdf-backend + adminSPA documentado en `DESPLIEGUE-LAN.md` se mantiene; sólo
hace falta revisar variables `.env` y hacer un nuevo `npm ci` + build del
frontend.

> Si arrancas los backends con `pm2 start infra/lan/ecosystem.config.cjs`,
> las variables clave (`CORS_ALLOW_LAN`, `PDF_BACKEND_BIND_HOST`, `HOST`) ya
> vienen con los valores correctos para LAN. Aun así revisa los `.env` para
> los secretos.

---

## 1. Pasos en el servidor (resumen)

```powershell
cd C:\ruta\al\repo
git pull origin fix/security-pentest-findings

# Dependencias
cd backAppC;            npm ci; cd ..
cd pdf-backend;         npm ci; cd ..
cd whatsapp-gateway;    npm ci; cd ..

# Frontend (build LAN con source maps deshabilitados)
cd adminSPA;            npm ci; npm run build:lan; cd ..

# Reiniciar backends
pm2 restart infra/lan/ecosystem.config.cjs --update-env
```

Verifica con `pm2 status` que `backapp-api`, `pdf-backend` y `whatsapp-gateway`
estén `online`.

---

## 2. Variables `.env` nuevas/cambios obligatorios

### 2.1 `backAppC/.env`

| Variable | Valor recomendado en LAN | Por qué |
|---|---|---|
| `NODE_ENV` | `production` | Activa cookies `Secure`, banner JSON 404, helmet completo. |
| `TRUST_PROXY` | `1` | Express toma la IP real desde `X-Forwarded-For` de Nginx (necesario para rate-limit). |
| `FRONTEND_URL` | `http://192.168.1.47` (o tu IP/host real) | Origen principal del navegador. |
| `CORS_ALLOW_LAN` | `1` | **NUEVO**: en `NODE_ENV=production` ahora la aceptación de orígenes RFC1918 / `*.local` es **opt-in**. Sin esta variable solo entrarán los listados en `FRONTEND_URL` + `CORS_EXTRA_ORIGINS`. |
| `CORS_EXTRA_ORIGINS` | (opcional) `http://sistema.local,http://otra-ip` | Si prefieres no usar `CORS_ALLOW_LAN`, lista aquí cada origen exacto. |
| `LOGIN_RATE_LIMIT_MAX` | (opcional) `5` | Default endurecido a 5 intentos / 15 min por IP+email. Sube si en LAN compartida hace falta. |
| `MFA_RATE_LIMIT_MAX` | (opcional) `10` | Nuevo rate-limit en endpoints 2FA (`/api/admin_2fa_*`). |
| `PDF_BACKEND_URL` | `http://127.0.0.1:3002` | Tal como estaba. |
| `PDF_BACKEND_TOKEN` | **vacío** si pdf-backend corre en el mismo host (loopback). Generar UUID si lo mueves a otro host. | Debe coincidir exactamente con `pdf-backend/.env`. |

### 2.2 `pdf-backend/.env`

| Variable | Valor recomendado en LAN | Por qué |
|---|---|---|
| `PORT` | `3002` | Igual que antes. |
| `PDF_BACKEND_BIND_HOST` | `127.0.0.1` | **NUEVO** y default. pdf-backend ya **no escucha en 0.0.0.0** por defecto. Si necesitas que escuche en otra interfaz, cámbialo y configura token (siguiente fila). |
| `PDF_BACKEND_TOKEN` | vacío para loopback / UUID compartido si está en otro host | Si vacío y no es loopback, **401**. Para LAN cross-host, define el mismo en backAppC. |
| `PDF_BACKEND_REQUIRE_TOKEN` | `false` (default) | Pon `true` para exigir token incluso desde loopback (defensa en profundidad). |
| `FRONTEND_URL` | igual que en backAppC | Para preflight CORS si alguien llama directo. |
| `CORS_ALLOW_LAN` | `1` (sólo si llaman al pdf-backend desde el navegador). Si toda la comunicación es backAppC → pdf-backend, puedes dejar `0`. | En `NODE_ENV=production` ahora es opt-in. |

### 2.3 `whatsapp-gateway/.env`

| Variable | Valor recomendado en LAN | Por qué |
|---|---|---|
| `HOST` | `127.0.0.1` | Solo loopback (igual que pdf-backend). |
| `PORT` | `3010` | Sin cambios. |
| `GATEWAY_API_KEY` | UUID largo aleatorio | **OBLIGATORIO**: sin esto el gateway responde 503 en todos los endpoints `/v1/*`. Igual valor en backAppC (variable `WHATSAPP_GATEWAY_API_KEY`). |
| `BACKEND_WEBHOOK_URL` | `http://127.0.0.1:3000/api/whatsapp-bot/inbound` | Sin cambios. |
| `WEBHOOK_SECRET` | UUID largo aleatorio | Debe coincidir con `WHATSAPP_BOT_WEBHOOK_SECRET` en backAppC. |
| `GATEWAY_ALLOW_REMOTE_MEDIA` | `0` (default) | **NUEVO**: por defecto el gateway **no descarga archivos por URL** (cierra SSRF interno). Si necesitas que `sendMedia` acepte URLs públicas, ponlo a `1`. |
| `GATEWAY_MAX_MEDIA_BYTES` | `52428800` (50 MB) | Límite duro de archivo (vía base64 o URL si está habilitada). |

---

## 3. Qué debes probar después del restart

1. **Login** (un usuario de cada empresa):
   - Login con 2FA → genera token y entra al dashboard.
   - Tras 5 intentos fallidos rápidos, el 6° retorna `429`. Esperar 15 min para validar reset.
2. **Generación de PDF** desde el sistema (factura, lista de ventas, ticket).
   - Debe seguir descargando el `.pdf`. Si recibes `502/upstream` revisa que backAppC pueda alcanzar `http://127.0.0.1:3002/health` (curl en el servidor).
3. **WhatsApp** (si lo usas):
   - Estado de sesión devuelve `conectado` y envío de texto funciona.
   - Si tenías un flujo que pasa URLs externas a `sendMedia`, ahora retornará `400 "Las URLs remotas no estan permitidas"` hasta que pongas `GATEWAY_ALLOW_REMOTE_MEDIA=1`.
4. **CORS LAN** desde un PC cliente:
   - Abrir DevTools → Network. Las peticiones a `/api/*` deben devolver `200/4xx` con CORS válido. Si ves `CORS error`, falta `CORS_ALLOW_LAN=1` o el origen no está en `FRONTEND_URL/CORS_EXTRA_ORIGINS`.
5. **Source maps fuera de prod**:
   ```powershell
   Get-ChildItem adminSPA\dist\admin-spa\browser -Filter *.js.map
   ```
   No debería listar nada de los chunks de la app (puede aparecer `polyfills*.map` si Angular lo deja, pero los `main.*.js.map` ya no se generan).

---

## 4. Cambios irrenunciables (no se pueden desactivar)

Estos quedan activos siempre, no se controlan por variable:

- `GET /api/empresa` ahora requiere ser super admin de plataforma.
- `PUT /api/empresa/:id` requiere que `:id === req.user.empresa`.
- `POST /api/direccion_empresa` ignora `idEmpresa` del body; usa el del JWT.
- `GET /api/database` fue **eliminado** (antes filtraba IP y usuario de SQL).
- `GET /api/obtener_logo/:img` valida estrictamente el nombre y no expone rutas.
- Mensajes de error en login/2FA y recuperación de contraseña son genéricos (sin user enumeration).
- JWT de sesión ya no contiene `nombres/apellidos/email`; solo `sub, empresa, rol, sid`.
- JWT temporal de 2FA (`pendingToken`) viene cifrado con AES-256-GCM.
- Source maps deshabilitados en `production` y `desktop` (`angular.json`).
- Puppeteer en `pdf-backend` **bloquea toda red externa** dentro del HTML que renderiza.

---

## 5. Despliegue de internet (no LAN)

Si en algún momento mueves la instalación a un servidor con IP pública:

| Backend | Variables clave |
|---|---|
| `backAppC` | `CORS_ALLOW_LAN=0`, listar dominios en `CORS_EXTRA_ORIGINS=https://app.midominio.com`. Usar HTTPS (cookies `Secure` ya lo exigen). |
| `pdf-backend` | `PDF_BACKEND_BIND_HOST=127.0.0.1` y dejarlo así. backAppC sigue llamándolo en loopback. |
| `whatsapp-gateway` | `HOST=127.0.0.1` siempre. |
| Reverse proxy | Forzar HTTPS (HSTS), bloquear `OPTIONS` no usados, rate-limit a nivel de WAF. |

---

## 6. Soporte rápido si algo falla tras el pull

| Síntoma | Acción |
|---|---|
| `CORS error` desde un cliente LAN | `CORS_ALLOW_LAN=1` en `backAppC/.env` y reiniciar. |
| `502` al descargar PDF | `curl http://127.0.0.1:3002/health` en el servidor. Si responde 401: `PDF_BACKEND_TOKEN` no coincide; vaciar ambos si están en el mismo host. |
| Login da `429` constante | Bajar carga de tests o subir `LOGIN_RATE_LIMIT_MAX` y reiniciar. |
| WhatsApp `503 sin GATEWAY_API_KEY` | Definir `GATEWAY_API_KEY` en `whatsapp-gateway/.env` y mismo valor en `WHATSAPP_GATEWAY_API_KEY` de backAppC. |
| Subida de imagen como logo no aparece | El nombre debe ser `[a-zA-Z0-9._-]+.(jpg|jpeg|png|gif|webp|svg)`. Sin paths ni `..`. |
