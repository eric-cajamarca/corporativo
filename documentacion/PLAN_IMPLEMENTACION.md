# Plan de implementación – Seguridad, alineamiento y preparación Ambassador

## Objetivo
Aplicar el orden sugerido de la evaluación (puntos 6.2 y 7 de EVALUACION_PROYECTO.md): seguridad inmediata, evitar `idEmpresa` desde body, corregir rutas sin autenticación (excepto crear empresa y obtener logo), y preparar el proyecto para una futura implementación con Ambassador/Kubernetes.

---

## 1. Uso de Tenant (querySafe)
- **Evaluación**: El middleware `tenant-query` se usa en `app.js` (todas las rutas `/api`) y en las rutas de creditos, caja, facturacion, dashboard, analisis, envios y despachos. **Se mantiene** tal cual.
- **Acción**: No se elimina ni se cambia el uso de tenant.

---

## 2. Rutas sin autenticación (corregir)

### 2.1 Ventas (detalleventas)
- **`GET /api/ventas`** (`dventasController.obtenerDetalleVentas`): Actualmente sin auth y devuelve todas las filas.
  - Añadir **auth** y filtrar por **empresa del usuario** (`req.user.empresa`): consulta que una a DetalleVenta con Ventas y `WHERE v.idEmpresa = @idEmpresa`.
- **`DELETE /api/ventas/:id`** (`dventasController.eliminarDetalleVenta`): Actualmente sin auth y borra por id.
  - Añadir **auth** y validar que el detalle pertenezca a una venta de la empresa del usuario antes de borrar; luego eliminar.

### 2.2 Factiliza
- Todas las rutas de factiliza quedan **protegidas con auth**:
  - `GET /api/ruc/anexo/:ruc`, `GET /api/dni/:dni`, `GET /api/cextranjeria/:cee`, `GET /api/ruc/:ruc`, `GET /api/tipocambio/:fecha`, `GET /api/placa/:placa`, `GET /api/soat/:placa`, `GET /api/licencia/:dni`, `POST /api/xml`.
- **Excepciones que se mantienen sin auth** (según tu indicación): **crear empresa** (`POST /api/empresa`) y **obtener logo** (`GET /api/obtener_logo/:img`).

---

## 3. Evitar idEmpresa desde el body
- **Regla**: El `idEmpresa` se obtiene siempre del backend a partir de la empresa del usuario logueado (`req.user.empresa`). No confiar en `req.body.idEmpresa` para autorización.

### 3.1 Backend
- **empresasController.js**  
  - `createDireccionEmpresa` y `createSucursalEmpresa`: usar `req.user?.empresa` cuando el usuario esté autenticado; si la ruta se llama sin auth (ej. registro), se puede mantener `req.body.idEmpresa` solo en ese flujo. Se prioriza `req.user.empresa` cuando exista.
- **ventasController.js**  
  - `eliminarDetalleVenta`: actualmente usa `idEmpresa` del body; cambiarlo a **`req.user.empresa`** (esta ruta solo debe usarse con auth; si la ruta expuesta es la de dventasController, el fix principal es en dventasController; ventasController se alinea por consistencia).

---

## 4. Proxy backend para ApisPeru (DNI/RUC)
- **Problema**: El token de apisperu.com está hardcodeado en el frontend (`apiperu.service.ts`).
- **Solución**:
  - **Backend**: Crear rutas con auth, por ejemplo:
    - `GET /api/external/dni/:dni`
    - `GET /api/external/ruc/:ruc`
  - El backend llama a apisperu.com con el token guardado en variable de entorno (ej. `APISPERU_TOKEN`).
  - **Frontend**: El servicio Angular deja de llamar a apisperu directamente y usa estas rutas del backend (con cookie de sesión / credenciales).

---

## 5. Health endpoints (preparación Ambassador / Kubernetes)
- **backAppC**: Añadir `GET /health` que responda 200 y opcionalmente estado de DB (sin datos sensibles).
- **pdf-backend**: Añadir `GET /health` que responda 200 (y opcionalmente que Puppeteer esté disponible).
- Sirven para que Ambassador/Kubernetes comprueben que el servicio está vivo.

---

## 6. JWT_SECRET y preparación para producción
- Añadir o actualizar **`.env.example`** en backAppC con:
  - `JWT_SECRET` (obligatorio en producción, sin valor por defecto en ejemplo).
  - `APISPERU_TOKEN` para el proxy DNI/RUC.
- Documentar en el plan (o README) que en producción **JWT_SECRET** debe estar definido y ser fuerte.

---

## 7. Preparación para Ambassador / Kubernetes
- El proyecto **no se considera listo para producción**; por tanto no se generan manifiestos Kubernetes completos.
- **Acciones**:
  - Añadir **`.env.example`** con las variables necesarias (JWT, DB, APISPERU, etc.) y un comentario sobre uso en producción.
  - En **EVALUACION_PROYECTO.md** o en un **README** corto (ej. `docs/PREPARACION_AMBASSADOR.md`): describir que para Ambassador se asume despliegue en Kubernetes; listar servicios (backAppC, pdf-backend, opcional facturador) y que los health checks (`/health`) ya estarán disponibles para el gateway.
- Opcional: añadir un **Dockerfile** mínimo para backAppC y otro para pdf-backend (solo preparación; no desplegar aún).

---

## 8. Velocidad para el cliente final (sugerencias)
- **Mantener** el proxy en desarrollo (`proxy.conf.json`) para evitar CORS y una sola origen.
- **Proxy ApisPeru**: Una sola llamada desde el frontend al backend; el backend hace la llamada a apisperu. Añadir un **timeout** razonable (ej. 5 s) en el backend para no colgar al usuario.
- **Factiliza**: Al estar protegido con auth, no se añade por ahora rate limit agresivo que pueda frenar uso normal; si más adelante se implementa Ambassador, el rate limit puede hacerse en el gateway.
- **Health**: Respuesta ligera (solo 200 y poco payload) para no impactar rendimiento.

---

## 9. Archivos a tocar (resumen)
| Archivo | Cambios |
|---------|--------|
| `backAppC/routes/detalleventas.js` | Auth en GET /ventas y DELETE /ventas/:id |
| `backAppC/controllers/dventasController.js` | Filtrar por idEmpresa en obtenerDetalleVentas (join DetalleVenta + Ventas); en eliminarDetalleVenta validar que el detalle pertenezca a la empresa y luego borrar. Si tu BD usa tabla `DetalleVentas` con columna `id` en lugar de `DetalleVenta`/`idDetalle`, ajustar nombres en el controller. |
| `backAppC/routes/factiliza.js` | Añadir auth a todas las rutas GET/POST (excepto las que ya lo tienen) |
| `backAppC/controllers/empresasController.js` | Usar req.user.empresa en createDireccionEmpresa y createSucursalEmpresa cuando haya usuario |
| `backAppC/controllers/ventasController.js` | eliminarDetalleVenta: idEmpresa desde req.user.empresa (si se usa esta ruta) |
| `backAppC/routes/*` | Nueva ruta para proxy external (ej. `/api/external`) o integrar en una existente |
| `backAppC/controllers/externalController.js` (nuevo) | Endpoints proxy DNI/RUC con auth |
| `backAppC/app.js` | Registrar rutas external y GET /health |
| `backAppC/.env.example` | JWT_SECRET, APISPERU_TOKEN, etc. |
| `adminSPA/src/app/services/apiperu.service.ts` | Llamar al backend (ej. /api/external/dni, /api/external/ruc) en lugar de apisperu.com |
| `pdf-backend/index.js` (o punto de entrada) | GET /health |
| `docs/PREPARACION_AMBASSADOR.md` (nuevo) | Breve guía para cuando se use Kubernetes/Ambassador |

---

## 10. Orden de ejecución
1. Crear este plan (PLAN_IMPLEMENTACION.md).
2. Seguridad ventas: auth + filtro por empresa en GET y DELETE.
3. Proteger rutas factiliza con auth.
4. Proxy backend apisperu + cambio en frontend.
5. idEmpresa desde req.user.empresa en empresas y ventas.
6. Health en backAppC y pdf-backend.
7. .env.example y documentación Ambassador.

Si algo de lo anterior no coincide con lo que quieres (por ejemplo, más excepciones de auth o no tocar factiliza), indícalo y se ajusta el plan antes de codificar.
