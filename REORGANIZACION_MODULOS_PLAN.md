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

1. Menú y navegación: sidebar agrupado por dominio (sin mover carpetas aún).
2. Mapa rutas ↔ módulos SaaS: alinear `adminSPA/src/app/config/ruta-plan-modulo.map.ts`.
3. Análisis financiero: unificar KPIs home vs `/analisis`.
4. Opcional: reubicar carpetas Angular/backend por dominio.

## Fuera de alcance inicial

- Libro contable (PlanCuentas / asientos en UI).
- RRHH (planilla, asistencia).
- Marketing / CRM campañas.
