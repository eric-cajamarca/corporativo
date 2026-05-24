# Piloto A — Checklist de prueba manual

## Requisitos previos

1. Ejecutar migración `create_whatsapp_bot_log.sql` (opcional pero recomendado para logs).
2. En `backAppC/.env`: `WHATSAPP_GATEWAY_URL`, `WHATSAPP_GATEWAY_API_KEY`, `WHATSAPP_BOT_WEBHOOK_SECRET`.
3. En `whatsapp-gateway/.env`: `GATEWAY_API_KEY`, `BACKEND_WEBHOOK_URL`, `WEBHOOK_SECRET` (igual que backend).
4. Levantar `backAppC` (3000) y `whatsapp-gateway` (3010).

## Pruebas

| # | Acción | Resultado esperado |
|---|--------|-------------------|
| 1 | Empresa A: vincular QR en Configuración → WhatsApp | Sesión `conectado` |
| 2 | Desde otro celular, escribir `HOLA` al número vinculado | Menú de bienvenida piloto |
| 3 | Escribir `MENU` | Menú de prueba con opciones 1–3 |
| 4 | Escribir `PING` | `PONG - Bot activo.` |
| 5 | Escribir texto cualquiera | `Bot en prueba. Escriba MENU.` |
| 6 | Empresa B: repetir 2–5 con otra sesión | Respuestas aisladas por empresa |
| 7 | Reiniciar solo `whatsapp-gateway` | Tras reconexión, sigue respondiendo |
| 8 | Desvincular sesión (DELETE) | El bot deja de responder |
| 9 | Enviar PDF desde ventas/cotizaciones | Sigue funcionando (saliente) |

## Comandos de prueba

```text
HOLA
MENU
PING
cualquier otra cosa
```
