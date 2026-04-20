# Política de migración: licencia única (on‑premise / enterprise) → SaaS

Documento **comercial + técnico** para alinear expectativas entre cliente, ventas, soporte e implementación.

---

## 1. Comercial

### 1.1 Qué ofrece el SaaS

- Suscripción por **planes** publicados (demo, emprendedor, profesional, empresarial, enterprise según catálogo).
- Límites contractuales típicos: **usuarios**, **sucursales**, módulos según plan (ver `SaasPlanModulo` y página pública de planes).
- Facturación recurrente (Culqi / flujos acordados) y **renovación / upgrade** por checkout estándar.

### 1.2 Qué no se garantiza “igual que antes” sin análisis

- Integraciones o **EXE** locales no contemplados en el stack estándar (Node + Angular + SQL Server + servicios documentados).
- Personalizaciones de informes o pantallas que no existan en el producto actual.
- Esquemas de **multi‑BD** o despliegues fragmentados no alineados al modelo multiempresa del SaaS.

### 1.3 Propuesta de valor al migrar

- Menos coste de **infra y mantenimiento** del servidor del cliente.
- Actualizaciones y **seguridad** centralizadas.
- Camino claro de **upgrade de plan** sin forks.

---

## 2. Técnico

### 2.1 Prerrequisitos

- Base **SQL Server** accesible para migración de datos (export/import o ETL acordado).
- Listado de **empresas**, usuarios, RUCs y volumetría (documentos, años de historia).
- Inventario de **integraciones** (SUNAT, pasarelas, Factiliza, etc.) y tokens/credenciales según política de secretos.

### 2.2 Modelo de datos

- El tenant SaaS usa **`EmpresaSuscripcion`** + `SuscripcionCheckoutPendiente` para el contrato y pagos **CHK-***.
- Los **módulos por plan** se controlan con `SaasPlanModulo` (no enviar `planCode` desde el cliente; se toma del token y suscripción).

### 2.3 Pasos típicos de migración

1. **Congelar** versión origen y tomar backup completo.
2. **Mapear** maestros y transacciones a tablas destino (scripts revisados en entorno de prueba).
3. **Carga** en ambiente SaaS de staging; validación de balances y muestras de comprobantes.
4. **Corte:** alta de suscripción (plan contratado), usuarios y permisos; desactivación gradual del sistema legacy si aplica.
5. **Soporte post‑go‑live** según SLA contractual.

### 2.4 Demo y pruebas

- Cuenta **demo** con caducidad y módulos acotados; para probar **upgrade**, usar checkout del plan objetivo con sesión iniciada (vinculación automática según implementación vigente).

### 2.5 Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| Pérdida de histórico | Plan de migración por lotes + reconciliación |
| Downtime largo | Ventana acotada + rollback documentado |
| Expectativas de módulos no incluidos en plan | Matriz Fase 3 + demo con módulos reales del plan vendido |

---

## 3. Responsabilidades

| Rol | Responsabilidad |
|-----|-----------------|
| Comercial | Plan vendido = módulos y límites acordados; sin prometer custom sin hoja de ruta |
| Soporte | Derivar a configuración o upgrade según matriz Fase 3 |
| Ingeniería | Mantener `SaasPlanModulo`, guards y APIs alineados al catálogo |

---

## 4. Referencias en código

- Migración módulos / Factiliza: `backAppC/migraciones nuevas/saas_plan_modulos_y_factiliza.sql`
- Filtro menú backend: `backAppC/services/saasPlanAcceso.service.js` (`filtrarNavegacionPorPlan`)
- Matriz producto: [FASE3_PRODUCTO_ESTANDAR_MATRIZ.md](./FASE3_PRODUCTO_ESTANDAR_MATRIZ.md)
