# Infraestructura — despliegue en LAN

Archivos de referencia para el servidor (Windows + Nginx + PM2). La guía paso a paso está en **`DESPLIEGUE-LAN.md`** (raíz del repo).

| Archivo | Uso |
|---------|-----|
| `nginx.conf.example` | Copiar/ajustar en `C:\nginx\conf\nginx.conf`. `root` debe apuntar a `adminSPA/dist/admin-spa/browser`. |
| `ecosystem.config.cjs` | `pm2 start infra/lan/ecosystem.config.cjs` desde la raíz del repo clonado. |

**Desarrollo local** no usa estos archivos: sigue con `ng serve` (proxy ya enruta `/api/reports` → 3002).

**Build para servidor:** en `adminSPA`:

```bash
npm run build:lan
```

Equivale a `ng build --configuration=production` más un parche defensivo sobre bundles (`scripts/patch-lan-bundle.js`).
