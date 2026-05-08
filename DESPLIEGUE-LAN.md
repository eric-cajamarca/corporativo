# Despliegue en red local (LAN) — Guía definitiva

## Arquitectura

```
[Navegador] --> http://sistema.local (o IP)
                        |
                     [Nginx :80]
                     /         \
            /api/*              /api/reports/*
               |                       |
        [backAppC :3000]       [pdf-backend :3002]
               |
          [SQL Server]
```

### IP del servidor en esta guía

Se documenta la IP actual de la máquina que sirve la app: **`192.168.1.47`**. Si el DHCP te asigna otra IP, actualiza `server_name` en Nginx, `FRONTEND_URL` / `API_BASE_URL` en `.env`, y las entradas `hosts` en los clientes.

---

## 0. Cambios en el repositorio (LAN + desarrollo local)

| Área | Qué hay |
|------|---------|
| **backAppC** (`app.js`) | CORS: `FRONTEND_URL`, `CORS_EXTRA_ORIGINS`, localhost:4200, y orígenes **red privada + `*.local`** salvo `CORS_ALLOW_LAN=0`. |
| **pdf-backend** | `src/utils/corsOptions.js`: misma política + `FRONTEND_URL`, `CORS_ORIGIN` / `CORS_EXTRA_ORIGINS`. |
| **adminSPA** | `API_URL` y `PDF_API_BASE: '/api/reports'` en `environment` / `environment.prod`. En desarrollo, `proxy.conf.json` envía `/api/reports` → `localhost:3002` y el resto de `/api/*` → `3000`. |
| **Build producción/LAN** | `npm run build:lan` en `adminSPA` = `ng build --production` + `scripts/patch-lan-bundle.js` (por si quedara algún `localhost` en chunks). Salida: `dist/admin-spa/browser`. |
| **PM2 + Nginx (plantillas)** | `infra/lan/ecosystem.config.cjs` y `infra/lan/nginx.conf.example` (no sustituyen tu `.env`; ver `infra/lan/README.md`). |

---

## 1. Nginx (servidor web — puerto 80)

**Plantilla en el repo:** `infra/lan/nginx.conf.example` (copiar y ajustar `root` y `server_name`).

**Ubicación típica en el servidor:** `C:\nginx\conf\nginx.conf`

```nginx
worker_processes  1;

error_log  logs/error.log;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout  65;

    server {
        listen       80;
        server_name  sistema.local 192.168.1.47;

        root   "C:/ruta/al/repo/adminSPA/dist/admin-spa/browser";
        index  index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location ^~ /api/reports/ {
            proxy_pass http://127.0.0.1:3002;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location ^~ /api/ {
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }
    }
}
```

### Puntos clave de Nginx

- `proxy_pass` **sin `/` al final**: preserva la ruta original (`/api/admin_login` llega como `/api/admin_login` al backend). Con `/` al final Nginx quita el prefijo y el backend recibe rutas incorrectas.
- `^~` en los location: prioriza el proxy sobre el `try_files` del frontend.
- `server_name` incluye tanto `sistema.local` como la IP `192.168.1.47` para aceptar ambos.

### Comandos útiles

```powershell
cd C:\nginx
.\nginx -t          # Validar config
.\nginx             # Iniciar
.\nginx -s reload   # Recargar config
taskkill /IM nginx.exe /F   # Matar todos los procesos (para reinicio limpio)
.\nginx -T          # Ver config activa
```

> **Importante:** Si `nginx -s reload` no aplica cambios, matar todos los procesos con `taskkill` y arrancar de nuevo.

---

## 2. Frontend (Angular — adminSPA)

**Document root (build actual):** `adminSPA/dist/admin-spa/browser` (copiar esa carpeta al `root` de Nginx o apuntar Nginx directamente ahí).

### URLs en el bundle

- En código fuente, `environment.prod.ts` ya usa `API_URL: '/api/'` y `PDF_API_BASE: '/api/reports'`.
- Tras compilar en el servidor de build o en el mismo host:

```powershell
cd adminSPA
npm ci
npm run build:lan
```

`build:lan` aplica además `scripts/patch-lan-bundle.js` por si algún chunk aún mencionara `localhost`.

### env.js (opcional)

Si en el futuro necesitas overrides sin recompilar, puedes añadir `env.js` y cargarlo en `index.html`; hoy el flujo estándar es solo `environment` + Nginx.

---

## 3. Backend principal (backAppC — puerto 3000)

**Ubicación:** `C:\proyecto\prod05\backAppC`

### .env

```env
PORT=3000
DB_USER=sa
DB_PASSWORD=123456
DB_SERVER=DESKTOP-K41FUTR\SQLEXPRESS
DB_NAME=EfafSistema
DB_ENCRYPT=false
DB_TRUST_CERTIFICATE=true
JWT_SECRET=<clave_segura>
# Origen real del navegador (misma URL que usan los clientes, sin puerto si es Nginx :80)
FRONTEND_URL=http://192.168.1.47
# Opcional: lista explícita extra (coma). Si no pones CORS_ALLOW_LAN=0, la LAN privada y *.local entran.
# CORS_EXTRA_ORIGINS=http://sistema.local
# CORS_ALLOW_LAN=0
NODE_ENV=production
# Enlaces públicos (emails, PDFs): mejor la URL que ven los usuarios (Nginx), no :3000
API_BASE_URL=http://192.168.1.47
# Tras Nginx: IP del cliente real (también lo pone ecosystem PM2)
TRUST_PROXY=1
```

### CORS (app.js)

- Lista fija: `localhost:4200`, `FRONTEND_URL` y lo que pongas en **`CORS_EXTRA_ORIGINS`** (orígenes separados por coma en `.env`).
- Por defecto también se permiten orígenes **HTTP/HTTPS cuyo host sea red privada** (192.168.x.x, 10.x.x.x, 172.16–31.x.x, `*.local`, `localhost`, `127.x`) para que cualquier PC de la LAN funcione sin listar cada IP.
- Para desactivar eso (solo lista explícita): en `.env` pon `CORS_ALLOW_LAN=0`.

> **No** debe haber headers CORS manuales que sobrescriban el middleware `cors()`.

### Iniciar

```bash
cd C:\proyecto\prod05\backAppC
PORT=3000 node app.js
```

> Si la variable de entorno `PORT` ya existe en el sistema con otro valor (ej. 3002), el `.env` no la sobreescribe. Usar `PORT=3000 node app.js` o limpiar la variable con `unset PORT` (Git Bash) / `Remove-Item Env:PORT` (PowerShell).

---

## 4. Backend de PDF (pdf-backend — puerto 3002)

**Ubicación:** `C:\proyecto\prod05\pdf-backend`

### CORS

- Por código: `localhost:4200`, `127.0.0.1:4200`, variable **`CORS_ORIGIN`** (varios orígenes separados por coma), **`FRONTEND_URL`**, y la misma lógica de **red privada** que el API principal (salvo que pongas `CORS_ALLOW_LAN=0`).
- Si el navegador llama al PDF **solo a través de Nginx** (`/api/reports/...` en el mismo host que la SPA), muchas peticiones son mismo origen y no dependen de CORS; la configuración anterior cubre llamadas directas o herramientas que envían `Origin`.

### Iniciar

```bash
cd C:\proyecto\prod05\pdf-backend
node index.js
```

---

## 5. PM2 (backends en segundo plano)

**Archivo en el repo:** `infra/lan/ecosystem.config.cjs` (rutas relativas al clon).

```powershell
cd C:\ruta\al\repo
pm2 start infra/lan/ecosystem.config.cjs
pm2 status
pm2 logs
pm2 save
pm2 startup
```

- Variables de **base de datos y JWT** siguen en `backAppC\.env` (la app las carga con `dotenv` al arrancar).
- El ecosistema define `TRUST_PROXY=1` y `NODE_ENV=production` para `backAppC`; ajusta si necesitas otro entorno.

---

## 6. Firewall del servidor

Abrir estos puertos en PowerShell como administrador:

```powershell
netsh advfirewall firewall add rule name="Nginx HTTP" dir=in action=allow protocol=tcp localport=80
netsh advfirewall firewall add rule name="Backend 3000" dir=in action=allow protocol=tcp localport=3000
netsh advfirewall firewall add rule name="PDF Backend 3002" dir=in action=allow protocol=tcp localport=3002
```

Si **solo** vas a exponer la aplicación por **Nginx (puerto 80)** y los backends escuchan en `127.0.0.1` (no en `0.0.0.0`), en la práctica basta con abrir el **80** hacia la LAN; los puertos 3000 y 3002 serían accesibles solo en localhost. Con la configuración por defecto de Node (`app.listen(PORT)`), los puertos quedan en todas las interfaces: las reglas de arriba evitan bloqueos si algo llama al API por IP:3000.

---

## 7. DNS / Archivo hosts (opcional)

Para usar `http://sistema.local` en vez de la IP, en cada PC cliente editar:

**Archivo:** `C:\Windows\System32\drivers\etc\hosts` (abrir como administrador)

```
192.168.1.47  sistema.local
```

Sin esto, los clientes usan `http://192.168.1.47` directamente (funciona igual).

---

## 8. Orden de arranque

1. **Nginx** → `cd C:\nginx; .\nginx`
2. **Backends** → `cd C:\ruta\al\repo; pm2 start infra/lan/ecosystem.config.cjs`  
   (o manual: `node app.js` en `backAppC` y `node index.js` en `pdf-backend`)

### Verificar que todo está levantado

```powershell
netstat -ano | findstr ":80 :3000 :3002"
```

Debe mostrar LISTENING en los tres puertos.

---

## 9. Acceso desde clientes

| Desde             | URL                        |
|-------------------|----------------------------|
| Servidor local    | `http://sistema.local`     |
| Otra PC (con hosts) | `http://sistema.local`  |
| Otra PC (sin hosts) | `http://192.168.1.47`   |
| Celular en WiFi   | `http://192.168.1.47`     |

---

## 10. Problemas comunes y soluciones

| Problema | Causa | Solución |
|----------|-------|----------|
| 405 Not Allowed (Nginx) | `proxy_pass` con `/` al final quita el prefijo `/api` | Quitar el `/` final: `proxy_pass http://127.0.0.1:3000;` |
| Nginx no recarga config | Procesos viejos siguen activos | `taskkill /IM nginx.exe /F` y arrancar de nuevo |
| EADDRINUSE puerto 3002 | Variable `PORT=3002` en el entorno del sistema | `PORT=3000 node app.js` o limpiar variable |
| Not allowed by CORS | Origen no permitido | Revisar `FRONTEND_URL`, `CORS_EXTRA_ORIGINS` o no poner `CORS_ALLOW_LAN=0` si debe aceptar LAN |
| localhost:3002 en errores | URL hardcodeada en JS compilado del frontend | Reemplazar en `main-*.js` o recompilar Angular |
| No carga desde otra PC | Firewall bloquea puertos 80/3000/3002 | Abrir puertos con `netsh` |
| sistema.local no resuelve | Falta entrada en archivo hosts | Agregar `192.168.1.47  sistema.local` o usar la IP |

---

## 11. Checklist tras un nuevo build de Angular

En el servidor (o máquina de build), desde `adminSPA`:

```powershell
npm run build:lan
```

Luego desplegar el contenido de `dist/admin-spa/browser` al `root` de Nginx.

| Qué revisar | Por qué |
|-------------|---------|
| **`dist/admin-spa/browser/index.html`** referencia los `main-*.js` generados | Confirmar que Nginx `root` apunta a esta carpeta. |
| **Buscar `localhost:3000` / `localhost:3002` en los `.js` del browser** | Si aparecen tras `build:lan`, abrir issue / ampliar `patch-lan-bundle.js`. |

```powershell
Select-String -Path "C:\ruta\al\repo\adminSPA\dist\admin-spa\browser\*.js" -Pattern "localhost:300"
```

### Verificación rápida (servidor)

1. `curl -i -X POST http://sistema.local/api/admin_login -H "Content-Type: application/json" -d "{}"` → debe responder JSON del backend (ej. 400 con mensaje), no HTML 405 de Nginx.  
2. Desde otra PC: login + generar PDF sin error `localhost:3002`.

### Migraciones SQL

Ejecutar los scripts en `backAppC/migrations` y `backAppC/migraciones nuevas` según el procedimiento de tu equipo (SSMS / `sqlcmd` / scripts PowerShell del proyecto).