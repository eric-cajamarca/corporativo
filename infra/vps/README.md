# Despliegue en VPS (internet) — Hostinger u otro

Plantillas para producción **pública** (dominio + HTTPS). La guía LAN sigue en `DESPLIEGUE-LAN.md`.

## ¿Qué es la “capa de servidor”?

Son controles **fuera del código Node/Angular**, en el sistema operativo y la red:

| Pieza | Qué hace | Si no la configuras |
|-------|----------|---------------------|
| **HTTPS** | Cifra tráfico navegador ↔ Nginx (certificado Let's Encrypt) | Contraseñas y JWT viajan legibles; cookies `Secure` no sirven bien |
| **Firewall** (`ufw`) | Solo abre puertos 22, 80, 443 al mundo | Cualquiera puede intentar entrar a SQL (1433), Node (3000), gateway (3010) |
| **Secretos** (`.env`) | Claves largas aleatorias, distintas por servicio | Un leak de Git o backup expone todo el sistema |
| **BD no expuesta** | SQL Server escucha solo `127.0.0.1` o red privada | Ataques de fuerza bruta directos a `sa` desde internet |

La app ya trae helmet, CORS estricto, rate-limit, etc. La capa de servidor **complementa** eso; no la sustituye.

## Pasos rápidos en el VPS (Ubuntu/Debian)

```bash
# 1. Clonar repo y dependencias
cd /var/www/efaf   # tu ruta
git pull
cd backAppC && npm ci && cd ..
cd pdf-backend && npm ci && cd ..
cd whatsapp-gateway && npm ci && cd ..
cd adminSPA && npm ci && npm run build -- --configuration=production && cd ..

# 2. Copiar .env (editar valores reales; NUNCA commitear)
cp infra/vps/backAppC.env.example backAppC/.env
cp infra/vps/pdf-backend.env.example pdf-backend/.env
cp infra/vps/whatsapp-gateway.env.example whatsapp-gateway/.env
nano backAppC/.env   # JWT, BD, dominio, secretos UUID

# 3. Generar secretos (ejemplo)
openssl rand -hex 32   # repetir para JWT_SECRET, GATEWAY_API_KEY, etc.

# 4. Nginx
sudo cp infra/vps/nginx.conf.example /etc/nginx/sites-available/efaf
sudo ln -sf /etc/nginx/sites-available/efaf /etc/nginx/sites-enabled/
# Editar server_name, root, rutas SSL
sudo nginx -t && sudo systemctl reload nginx

# 5. Certificado SSL (tras apuntar DNS al VPS)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# 6. Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
# NO: ufw allow 3000 / 1433 / 3010

# 7. PM2
npm install -g pm2
pm2 start infra/vps/ecosystem.config.cjs
pm2 save && pm2 startup
```

## Archivos de esta carpeta

| Archivo | Uso |
|---------|-----|
| `backAppC.env.example` | Copiar a `backAppC/.env` |
| `pdf-backend.env.example` | Copiar a `pdf-backend/.env` |
| `whatsapp-gateway.env.example` | Copiar a `whatsapp-gateway/.env` |
| `nginx.conf.example` | Sitio Nginx + SSL |
| `ecosystem.config.cjs` | PM2 (`CORS_ALLOW_LAN=0` para internet) |

Reemplaza en todos los archivos:

- `tudominio.com` → tu dominio real
- `TU_IP_VPS` → IP del servidor (solo si la usas en `server_name`)
- Valores `GENERAR_CON_openssl_rand_hex_32` → salida de `openssl rand -hex 32`
