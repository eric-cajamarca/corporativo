# Evaluación del proyecto: Alineamiento, Escalabilidad, Seguridad, Resiliencia y Ambassador

## Resumen ejecutivo

El proyecto sigue una **arquitectura en capas** (controllers → services → repositories) con **multiempresa** y **Angular + Node/Express + SQL Server**. Hay buenas bases (JWT en cookies, tenant-query, transacciones en operaciones críticas) y **brechas importantes** en seguridad y consistencia. Abajo: estado actual y mejoras si se implementan las recomendaciones y Ambassador.

---

## 1. Alineamiento

### 1.1 Con las reglas de desarrollo definidas

| Regla | Estado | Evidencia |
|-------|--------|-----------|
| Estructura controllers/services/repositories | ✅ Cumple | `backAppC/`: controllers, services, repositories, routes, middlewares, utils |
| Sin lógica de negocio en controllers | ⚠️ Parcial | **ventas** y **dventas**: orquestación y acceso a BD movidos a [backAppC/services/ventasOrquestacion.service.js](backAppC/services/ventasOrquestacion.service.js) y [backAppC/services/dventas.service.js](backAppC/services/dventas.service.js); el controlador solo hace HTTP. Siguen otros controllers con `sql.connect` + delegación mínima. |
| Sin queries SQL en controllers | ⚠️ Parcial | **Mejorado (2026):** `ventasController` ya no importa repositorios ni arma listados/XML; `dventasController` no importa `mssql`. Pendiente: mismo patrón en `facturacionController`, `adminController`, `productosController`, etc. |
| Transacciones al tocar 2+ tablas | ✅ Cumple en varios flujos | creditos, caja, ventas, facturacion, cotizaciones, transferencia usan `transaction` + commit/rollback |
| Validación en services | ✅ Cumple | Ej. caja.service, creditos.service, ventas (parcial en service) |
| Repositories con tipos SQL correctos | ✅ Cumple | Uso de `sql.UniqueIdentifier`, `sql.Decimal`, etc. |
| Filtro idEmpresa en consultas | ❌ Incumple en puntos críticos | Ver sección Seguridad |
| Rutas RESTful + auth | ⚠️ Parcial | Muchas rutas con `auth.auth`; varias **sin autenticación** (ver Seguridad) |
| Frontend: environment para URLs | ✅ Cumple | `environment.API_URL`, `environment.prod.ts` |
| Frontend: AuthGuard en rutas | ✅ Cumple | `app.routes.ts`: canActivate [AuthGuard] en rutas de negocio |

### 1.2 Alineamiento técnico

- **Stack**: Node 20+, Express, Angular 19, SQL Server, MSSQL driver. Coherente con lo definido.
- **APIs externas**: SUNAT (SOAP), apisperu.com (DNI/RUC), pdf-backend (Puppeteer), facturador (puerto 9000). No hay una capa unificada de “gateway” ni configuración centralizada de URLs/timeouts.

**Conclusión alineamiento**: Estructura y convenciones en general alineadas; **desvíos importantes**: SQL y lógica en controllers, rutas sin auth y consultas sin filtro por empresa.

---

## 2. Escalabilidad

### 2.1 Estado actual

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Backend | Monolito único | Un proceso Node (puerto 3000); sin clustering ni balanceo |
| Base de datos | Una instancia SQL Server | Sin referencia a read replicas ni connection pooling explícito más allá de `mssql` |
| PDF/Reports | Servicio separado | pdf-backend (3002) desacoplado; bien para escalar por tipo de carga |
| Frontend | SPA estática | Angular; escalable vía CDN y múltiples instancias sin estado |
| Configuración | Hardcoded / .env | URLs de servicios (pdf, facturador, apisperu) en código o env; no hay servicio de configuración central |
| Límites de carga | No definidos | Sin rate limiting en API; sin límites por empresa o por usuario |

### 2.2 Cuellos de botella probables

1. **backAppC** como único punto de entrada: ventas, facturación, caja y consultas comparten el mismo proceso.
2. **Conexiones SQL**: Un pool por proceso; bajo alta concurrencia puede saturarse.
3. **Llamadas a SUNAT/apisperu**: Sin colas ni reintentos centralizados; picos pueden afectar tiempos de respuesta.
4. **PDF-backend**: Puppeteer es pesado; una sola instancia limita el throughput de reportes.

### 2.3 Mejoras si se implementan recomendaciones + Ambassador

- **Ambassador**: Un solo punto de entrada (API Gateway) para backAppC, pdf-backend y (opcional) facturador; permite escalar cada servicio por separado detrás del gateway.
- **Rate limiting y timeouts** en gateway reducen riesgo de saturación y abusos.
- **Health checks** en gateway permiten sacar instancias no sanas y preparar autoscaling (Kubernetes/cloud).

---

## 3. Seguridad

### 3.1 Puntos fuertes

- **JWT en cookie** (httpOnly implícito con `credentials: true`): el token no se expone en JS del frontend.
- **Helmet** con CSP y opciones de seguridad.
- **CORS** restrictivo (origins permitidos por lista).
- **Middleware tenant** (`tenant-query`): inyección de `idEmpresa` desde `req.user.empresa` para rutas que usan `req.querySafe`.
- **Controllers que usan `req.user.empresa`**: ventas, caja, clientes, compras, etc., no confían en `idEmpresa` del body en la mayoría de los casos.

### 3.2 Brechas críticas (actualización Fase 1 SaaS — revisión código)

#### A) Rutas sin autenticación — **parcialmente corregido**

- **`GET /api/ventas`** / **`DELETE /api/ventas/:id`**: ahora van con `auth` en [backAppC/routes/detalleventas.js](backAppC/routes/detalleventas.js); listado y borrado filtran por empresa del JWT vía servicio/repositorio.
- **`GET /api/ventas/:id/:idempresa`**: el segundo parámetro es numérico (`Destino` en `DetalleVentas`, no UUID de empresa). Se corrigió la fuga horizontal **uniendo `Ventas` con `idEmpresa` del token** en [backAppC/repositories/dventas.repository.js](backAppC/repositories/dventas.repository.js).
- **Factiliza / `external`**: rutas bajo [backAppC/routes/factiliza.js](backAppC/routes/factiliza.js) y [backAppC/routes/external.js](backAppC/routes/external.js) usan `auth` salvo `ruc-publico` (registro).
- **`GET /api/obtener_logo/:img`**: sigue público; valorar restricción o auth.
- **`POST /api/empresa`**: sin auth por diseño de registro; si solo admins, proteger.

#### B) Token de API externa en frontend — **mitigado**

- **`apiperu.service.ts`**: las llamadas activas usan `environment.API_URL + 'external/'` con cookies; el token apisperu en código quedó **comentado** (legacy). Mantener solo proxy backend.

#### C) Secreto JWT — **endurecido**

- **`JWT_SECRET`**: en `NODE_ENV=production` el proceso **termina al arranque** si falta o está vacío ([backAppC/config/env.validation.js](backAppC/config/env.validation.js)). En runtime, [backAppC/config/jwt.config.js](backAppC/config/jwt.config.js) + [backAppC/helpers/jwt.js](backAppC/helpers/jwt.js) y [backAppC/middlewares/autenticate.js](backAppC/middlewares/autenticate.js) centralizan el secreto; en desarrollo se conserva fallback solo para DX local.

#### D) Uso de idEmpresa desde el body

- **ventasController.eliminarDetalleVenta** (referenciado en ventasController): usa `idEmpresa` del `req.body`. Un cliente podría enviar otro `idEmpresa`. Debe usarse `req.user.empresa`.

### 3.3 Resumen seguridad

- Hay buena base (JWT, tenant, Helmet, CORS).
- **Pendiente revisión**: `req.body.idEmpresa` en controladores puntuales (p. ej. ventas), logo público, y observabilidad avanzada.
- **Añadido Fase 1**: correlación `X-Request-Id` / `req.requestId`, logs JSON en `errorHandler`, `GET /health` opcional con `HEALTH_CHECK_DB=1`, gate SaaS **fail-closed** si falla lectura de suscripción en BD ([backAppC/middlewares/saasSuscripcionGate.js](backAppC/middlewares/saasSuscripcionGate.js)).

---

## 4. Resiliencia

### 4.1 Estado actual

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Transacciones DB | ✅ | commit/rollback en ventas, caja, créditos, facturación, transferencias, etc. |
| Reintentos | ❌ | No hay reintentos en axios (SUNAT, etc.); un fallo temporal corta el flujo |
| Timeouts | ⚠️ | No se ven timeouts explícitos en llamadas HTTP externas |
| Circuit breaker | ❌ | No hay patrón circuit breaker para SUNAT u otros servicios |
| Health checks | ❌ | No hay endpoint `/health` ni uso en orquestación |
| Logging de errores | ⚠️ | Uso de `console.error`; sin formato estructurado ni correlación de requests |
| Manejo de errores en frontend | ✅ | Uso de `catchError` en servicios Angular |

### 4.2 Mejoras con Ambassador

- **Timeouts** y **retries** en el gateway para llamadas a backends (backAppC, pdf-backend).
- **Circuit breaking** (si Ambassador o la malla lo soportan) para no saturar servicios externos o backends caídos.
- Un **health check** en cada servicio y comprobación desde Ambassador mejora la resiliencia ante fallos de instancia.

---

## 5. Ambassador para interacción con los servicios API

### 5.1 Qué es Ambassador (Edge Stack / API Gateway)

Ambassador actúa como **API Gateway** delante de tus servicios: un único punto de entrada que enruta, limita, autentica y observa el tráfico hacia backAppC, pdf-backend, facturador u otros backends.

### 5.2 Cómo te ayudaría en este proyecto

| Necesidad | Sin Ambassador | Con Ambassador |
|-----------|----------------|----------------|
| **Un solo dominio/puerto** para el frontend | Frontend debe conocer varias bases (ej. `/api` → 3000, reportes → 3002, facturador → 9000) o un BFF que agregue | Frontend llama a un solo host; Ambassador enruta por path (ej. `/api/*` → backAppC, `/api/reports/*` → pdf-backend) |
| **Llamadas a APIs externas (SUNAT, apisperu)** | Cada servicio llama directo desde Node o desde el navegador (apisperu en frontend) | Puedes exponer un **Mapping** que proxy a apisperu/SUNAT; el token va en el backend y el frontend solo llama a tu dominio. Centralizas política de reintentos y timeouts |
| **Rate limiting** | No implementado | Límites por IP o por usuario/empresa en el gateway |
| **Autenticación en el borde** | Solo dentro de backAppC (middleware auth) | Opción de validar JWT en el gateway y reenviar headers/claims a backends; backAppC puede simplificar o duplicar validación |
| **Resiliencia** | Reintentos y timeouts en cada servicio | Reintentos y timeouts en el gateway para todos los backends |
| **Observabilidad** | Logs y métricas dispersos | Métricas y tracing (ej. con Prometheus/Grafana o integraciones Ambassador) en un solo lugar |
| **Escalado** | Varios procesos manuales o por script | Con Kubernetes, Ambassador enruta a múltiples pods de backAppC o pdf-backend; puedes escalar cada uno de forma independiente |

### 5.3 Esquema simplificado con Ambassador

```
[Cliente Angular]
       |
       v
[Ambassador / API Gateway]  (único host, ej. https://api.tudominio.com)
       |
       +-- /api/*           --> backAppC (Node 3000)
       +-- /api/reports/*   --> pdf-backend (3002)
       +-- /api/facturador/* --> facturador (9000)  [opcional]
       +-- /api/external/dni, /api/external/ruc --> backAppC (proxy a apisperu con token en backend)
```

- Las **APIs externas** (SUNAT, apisperu) pueden seguir siendo llamadas **desde backAppC** (recomendado: token apisperu solo en backend). Ambassador no sustituye eso; lo que hace es dar un único punto de entrada y políticas comunes (timeouts, retries, límites) para **tus** servicios.
- Si en el futuro expones un “BFF” que solo agregue llamadas a SUNAT/apisperu, ese BFF sería un servicio más detrás de Ambassador.

### 5.4 Resumen Ambassador

- **Centraliza** el acceso a backAppC, pdf-backend y (opcional) facturador.
- **No reemplaza** la lógica de negocio ni la autenticación JWT de backAppC; puede complementarla (validar JWT en el borde).
- **Ayuda** a seguridad (rate limit, un solo punto de entrada), escalabilidad (escalar backends por detrás del gateway) y resiliencia (timeouts, retries, health).
- **Requerimiento**: Despliegue en Kubernetes (o compatible) donde Ambassador suele desplegarse; si hoy todo es on-premise o un solo servidor, primero tiene más impacto corregir seguridad y luego valorar Ambassador cuando el despliegue sea más “cloud-native”.

---

## 6. Estado actual vs mejoras si se implementa lo anterior

### 6.1 Tabla comparativa

| Dimensión | Estado actual | Si implementas correcciones + Ambassador |
|-----------|----------------|----------------------------------------|
| **Alineamiento** | Estructura correcta; SQL y lógica en controllers; rutas sin auth y consultas sin idEmpresa | Controllers sin SQL; lógica en services; todas las rutas sensibles con auth y filtro por empresa |
| **Escalabilidad** | Monolito único; sin rate limit; URLs repartidas | Un punto de entrada; escalado independiente de backends; rate limiting; health checks |
| **Seguridad** | JWT y tenant bien; fugas en /api/ventas y DELETE; token apisperu en frontend; JWT_SECRET por defecto | Sin rutas sensibles sin auth; token apisperu solo en backend; JWT_SECRET obligatorio; idEmpresa siempre del token |
| **Resiliencia** | Transacciones OK; sin reintentos/timeouts/circuit breaker; sin health | Reintentos y timeouts en gateway; opción de circuit breaker; health para orquestación |
| **APIs externas** | Llamadas directas desde backend/frontend; sin política común | Proxy y políticas (timeouts, retries) centralizadas; APIs externas consumidas solo desde backend con credenciales en servidor |

### 6.2 Orden sugerido de implementación

1. **Seguridad (inmediato)**  
   - Añadir `auth.auth` a `GET /api/ventas` y `DELETE /api/ventas/:id`; en ambos, filtrar o validar por `req.user.empresa`.  
   - Proteger rutas factiliza (auth o al menos rate limit).  
   - Mover token apisperu al backend y exponer endpoints proxy con auth.  
   - Asegurar `JWT_SECRET` en producción; no usar `idEmpresa` del body para autorización.

2. **Alineamiento con reglas**  
   - Mover queries SQL de controllers a repositories; dejar en controllers solo llamadas a services.  
   - Unificar uso de `req.user.empresa` en todos los flujos multi-tenant.

3. **Resiliencia básica**  
   - Health endpoint en backAppC y pdf-backend.  
   - Reintentos y timeouts en llamadas a SUNAT y apisperu (axios o módulo dedicado).

4. **Ambassador**  
   - Cuando el despliegue lo permita (p. ej. Kubernetes), introducir Ambassador como gateway, mapear `/api` y `/api/reports`, y añadir rate limiting y timeouts en el gateway.

---

## 7. Archivos y referencias útiles

- Rutas sin auth: `backAppC/routes/detalleventas.js`, `backAppC/routes/factiliza.js`.  
- Controller con consulta sin filtro: `backAppC/controllers/dventasController.js` (`obtenerDetalleVentas`, `eliminarDetalleVenta`).  
- Token apisperu en frontend: `adminSPA/src/app/services/apiperu.service.ts`.  
- JWT: `backAppC/middlewares/autenticate.js`.  
- Tenant: `backAppC/middlewares/tenant-query.js`.  
- Proxy dev: `adminSPA/proxy.conf.json` (target 3000).

---

*Documento generado a partir de la revisión del código del proyecto (backAppC, adminSPA, pdf-backend).*
