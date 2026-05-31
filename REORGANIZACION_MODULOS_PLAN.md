# Plan de reorganización por dominios (rama experimental)

Rama: `feat/reorganizacion-modulos-dominios`

## Objetivo

Agrupar capacidades existentes en dominios claros sin duplicar ERPs (RRHH, contabilidad completa, marketing).

## Dominios propuestos

| Dominio | Incluye (rutas/módulos actuales) | Código SaaS |
|---------|----------------------------------|-------------|
| Núcleo comercial | Productos, clientes, ventas, cotizaciones | PRODUCTOS, CLIENTES, VENTAS |
| Abastecimiento | Compras, proveedores, inventario | COMPRAS, INVENTARIO |
| Tesorería | Caja, créditos, gastos, análisis, reportes financieros | CAJA, ANALISIS, REPORTES |
| Distribución | Despachos, envíos, programación, vales, guías | DESPACHOS |
| Fiscal Perú | Facturación electrónica SUNAT | FACTURACION |
| Plataforma | Configuración, roles, auditoría, SaaS | CONFIGURACION, EMPRESA |

## Fases (esta rama)

1. **Hecho:** Menú y navegación por dominios (`backAppC/utils/navegacionDominios.util.js`, etiquetas `tipo: 'grupo'` en sidebar).
2. **Hecho:** Mapa rutas ↔ módulos SaaS (`ruta-plan-modulo.map.ts` + `ruta-plan-modulo.map.spec.ts`).
3. **Hecho:** Análisis financiero unificado — KPIs compartidos; flujo de caja en pestaña `/analisis` (sin aperturas); patrimonio según período consultado (inventario + CxC + flujo caja − CxP); balance anual por mes.
4. Opcional: reubicar carpetas Angular/backend por dominio.

## Fuera de alcance inicial

- Libro contable (PlanCuentas / asientos en UI).
- RRHH (planilla, asistencia).
- Marketing / CRM campañas.
