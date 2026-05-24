# Fase B — Checklist

## Migracion SQL

Ejecutar en orden:

1. `create_whatsapp_bot_log.sql` (si no existe)
2. `create_whatsapp_bot_fase_b.sql`

## Configuracion

1. Reiniciar `backAppC` y `whatsapp-gateway`.
2. En ERP: **Configuracion → Bot WhatsApp**.
3. Activar bot, revisar mensajes, **Sincronizar catalogo**.
4. (Opcional) Agregar sinonimos, ej. `latex` → `latex`.

## Pruebas WhatsApp

| Mensaje | Resultado esperado |
|---------|-------------------|
| `HOLA` / `MENU` | Menu 1 Pedidos, 2 Deuda, 3 Buscar |
| `pintura latex` | Hasta 5 productos con precio y stock |
| `cuanto cuesta esmalte` | Productos esmalte con precio |
| `1` (tras lista) | Detalle del producto 1 |
| `mis pedidos` | Pedidos del cliente (celular registrado) |
| `DEUDA` | Saldo pendiente |
| Cliente no registrado + pedido | Mensaje configurable |

## NLU sin IA

- Stopwords + regex de intencion + sinonimos por empresa
- Fuzzy: **fuse.js** si SQL OR no encuentra nada
- Futuro: `WHATSAPP_BOT_LLM_ENABLED` (no implementado)
