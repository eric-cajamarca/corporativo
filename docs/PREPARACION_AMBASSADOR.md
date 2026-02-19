# Preparación para Ambassador (Kubernetes)

Este documento describe cómo está preparado el proyecto para una futura implementación con **Ambassador** como API Gateway en Kubernetes. El proyecto no está listo aún para producción; esta guía sirve para cuando se decida desplegar con Kubernetes.

## Estado actual

- **backAppC** (Node/Express): puerto 3000, expone `/api/*` y **GET /health**.
- **pdf-backend** (Node/Express): puerto 3002, expone `/api/reports/*` y **GET /health**.
- **adminSPA** (Angular): SPA estática; en desarrollo usa proxy a backAppC.

Los endpoints **/health** no requieren autenticación y devuelven `{ status: 'ok', service: '...' }`. Sirven para que Kubernetes o Ambassador comprueben que el servicio está vivo (liveness/readiness).

## Servicios que podrían ir detrás del gateway

| Servicio      | Puerto | Ruta típica      | Health        |
|---------------|--------|------------------|---------------|
| backAppC     | 3000   | /api/*           | GET /health   |
| pdf-backend  | 3002   | /api/reports/*   | GET /health   |
| (opcional)   | 9000   | Facturador       | (definir)     |

## Variables de entorno

En **backAppC** usar **.env.example** como referencia. En producción es **obligatorio** definir:

- **JWT_SECRET**: valor fuerte y secreto (no usar el valor por defecto del código).
- **APISPERU_TOKEN**: si se usa el proxy DNI/RUC.
- Credenciales de base de datos y, si aplica, SMTP y FACTILIZA_TOKEN.

## Próximos pasos cuando se use Kubernetes

1. **Imágenes Docker**: crear Dockerfile para backAppC y para pdf-backend (y opcionalmente para el facturador).
2. **Manifiestos**: definir Deployment y Service para cada backend; opcionalmente Ingress o Ambassador Host/Mapping.
3. **Ambassador**: configurar Mappings para enrutar por path (ej. `/api` → backAppC, `/api/reports` → pdf-backend) y, si se desea, rate limiting y timeouts en el gateway.
4. **Secrets**: guardar JWT_SECRET, APISPERU_TOKEN, credenciales DB, etc. en Kubernetes Secrets y referenciarlos desde los Deployment.

No se incluyen manifiestos YAML en este repositorio hasta que el proyecto esté listo para producción.
