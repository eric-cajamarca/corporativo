# Fase 3 — Producto estándar configurable (no personalizado)

**Objetivo:** canalizar peticiones a **configuración** y **roadmap**, no a forks del código. Documento operativo para ventas, soporte e ingeniería.

**Base funcional del sistema:** [README_SISTEMA_COMPLETO.md](./README_SISTEMA_COMPLETO.md) (onboarding, módulos, autenticación).

---

## 1. Matriz oficial: configuración vs. roadmap / plan superior

| Necesidad del cliente | Resuelve con (estándar) | Va a roadmap / plan superior / custom |
|----------------------|---------------------------|----------------------------------------|
| Rubros, series de comprobantes, formas de pago, conceptos de caja | Catálogos y **Configuración** | — |
| Impuestos, tipo de documento, datos SUNAT por establecimiento | **Empresa** / facturación config | Cambios legales SUNAT fuera de alcance del producto |
| Límites de usuarios/sucursales según contrato | **Plan SaaS** (`SaasPlan`, `EmpresaSuscripcion`) | Negociación comercial fuera de catálogo |
| Módulos visibles (ventas, caja, despachos, análisis…) | **Plan → `SaasPlanModulo`** + menú API + guard de rutas (Angular) | Ocultar “a medida” sin pasar por catálogo de planes |
| Integraciones Culqi, WhatsApp, Factiliza | **Integraciones** (flags por empresa + plan Factiliza) | Nuevo proveedor de pago no estándar |
| Flujos de inventario avanzados (lotes, ubicaciones) | Módulo **Inventario** según plan | Reglas de picking de terceros |
| Reportes y utilidades administrativas | Plan **empresarial+** | Informes regulatorios sectoriales |
| Multi-empresa gestora / consolidados | **Enterprise** / módulos gestor | Desarrollo a medida por tenant |

**Regla práctica:** si cabe en pantallas existentes de **configuración**, **catálogos** o **parámetros de empresa**, es **producto estándar**. Si exige bifurcar lógica por un solo cliente o tocar núcleo contable sin volver atrás, entra en **roadmap** o **proyecto** (presupuesto).

---

## 2. Flags por plan → módulos (enforcement)

- **Fuente de verdad BD:** `SaasPlanModulo` (por `planCode`) y reglas adicionales en `saasPlanAcceso.service.js` (p. ej. submenú Caja por nivel).
- **Backend:** `GET /api/permisos/navegacion` ya filtra el menú; las APIs críticas deben seguir validando permisos y, donde aplique, plan (Factiliza, gestores, etc.).
- **Frontend (implementado):** `GET /api/permisos/usuario` incluye `deploymentMode`, `planCodeEfectivo` y `modulosPlanMenu` (`permisos.service.js`). El guard `saasPlanModuloGuard` (`adminSPA/src/app/guards/saas-plan-modulo.guard.ts`) está en `canActivate` junto a `AuthGuard` y `empresaGestoraGuard`; usa el mapa `adminSPA/src/app/config/ruta-plan-modulo.map.ts` y las mismas reglas de nivel de plan para Caja/cotizaciones que `saasPlanAcceso.service.js`.

Si `modulosPlanMenu` viene vacío (sin filas en BD para ese plan), se mantiene compatibilidad: **no se aplica tope** en el guard (mismo criterio que en backend cuando no hay módulos configurados).

---

## 3. Respuesta a las cuatro preguntas

1. **Escala:** Menos ramas por cliente al concentrar diferencias en **planes + configuración** documentados; el código común sirve a todos los tenants SaaS.
2. **Automatiza:** Menos desarrollos ad hoc al rechazar cambios que ya tienen camino en **config / catálogo / upgrade de plan**.
3. **MRR:** Planes claros (`SaasPlan`, catálogo público, checkout) favorecen **upsell estándar** (demo → emprendedor → …) sin renegociar código por cada venta.
4. **Menos dependencia:** Ventas y soporte se apoyan en esta **matriz** y en el documento de **migración** (ver `POLITICA_MIGRACION_LICENCIA_UNICA_A_SAAS.md`) en lugar de “preguntarle a desarrollo” si algo es posible sin fork.

---

## 4. Mantenimiento

- Al añadir un **módulo de menú** nuevo: actualizar migración/seeding de `SaasPlanModulo`, `permisos.service` (menú), y el mapa `adminSPA/src/app/config/ruta-plan-modulo.map.ts`.
- Al añadir una **ruta** nueva protegida por `AuthGuard` + `empresaGestoraGuard`: incluir `saasPlanModuloGuard` en `canActivate` y el prefijo en el mapa si aplica tope por plan.
