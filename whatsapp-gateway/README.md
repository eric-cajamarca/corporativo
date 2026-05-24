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

## Bot entrante (Piloto A)

Al conectar una sesión, el gateway escucha `messages.upsert` y reenvía al backend:

- `BACKEND_WEBHOOK_URL` — ej. `http://127.0.0.1:3000/api/whatsapp-bot/inbound`
- `WEBHOOK_SECRET` — misma clave que `WHATSAPP_BOT_WEBHOOK_SECRET` en backAppC
- Header `X-Webhook-Secret` en cada POST
- Reintento 2 veces si el backend no responde en `WEBHOOK_TIMEOUT_MS` (default 5s)

Al arrancar, precarga sesiones existentes en `SESSIONS_DIR` (reconexión tras reinicio).

Solo reenvía mensajes de texto de chats individuales (no grupos, no `fromMe`).
