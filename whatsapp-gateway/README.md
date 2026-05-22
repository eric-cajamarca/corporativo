# whatsapp-gateway

Microservicio WhatsApp multi-tenant (Baileys) para EFAF y otros proyectos.

## Arranque

```bash
cd whatsapp-gateway
cp .env.example .env
# Editar GATEWAY_API_KEY
npm install
npm start
```

Puerto por defecto: **3010**.

## API (header `Authorization: Bearer <GATEWAY_API_KEY>`)

| Metodo | Ruta |
|--------|------|
| POST | `/v1/tenants/:idEmpresa/session` |
| GET | `/v1/tenants/:idEmpresa/session/status` |
| DELETE | `/v1/tenants/:idEmpresa/session` |
| POST | `/v1/tenants/:idEmpresa/messages/text` |
| POST | `/v1/tenants/:idEmpresa/messages/media` |

Sesiones en carpeta `sessions/{idEmpresa}/`.
