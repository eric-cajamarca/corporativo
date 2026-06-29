// SIEMPRE usa environment para URLs (regla 2.2)
// SIEMPRE usa UPPER_SNAKE_CASE para constantes (regla 6.1)

// En desarrollo usamos URL relativa para que las peticiones vayan al mismo origen (proxy)
// y la cookie httpOnly se envíe correctamente (sin guardar token en el frontend).
export const environment = {
  production: false,
  API_URL: '/api/',
  APP_VERSION: '2.1.0',
  /** pdf-backend vía proxy (dev) o Nginx /api/reports → :3002 (LAN/prod). */
  PDF_API_BASE: '/api/reports',
  /** Valor por defecto si falla GET /public/config/deployment. En SaaS real use `saas`. */
  deploymentMode: 'enterprise' as 'saas' | 'enterprise',
  FRONTEND_URL: 'http://localhost:4200',
  /**
   * UUID de la empresa principal (mismo valor que EMPRESA_PRINCIPAL_ID en el backend).
   * Si está vacío, el guard solo exige rol superAdmin (desarrollo).
   */
  empresaPrincipalId: ''
};