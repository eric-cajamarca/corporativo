/**
 * Una sola máquina (sin Nginx): el navegador abre http://localhost:3000
 * backAppC sirve la SPA (SERVE_SPA_ROOT) y la API en el mismo origen.
 * PDF en 3002 con CORS hacia localhost:3000 (FRONTEND_URL en pdf-backend/.env).
 */
export const environment = {
  production: true,
  API_URL: '/api/',
  APP_VERSION: '2.1.0',
  PDF_API_BASE: 'http://127.0.0.1:3002/api/reports',
  deploymentMode: 'enterprise' as 'saas' | 'enterprise',
  FRONTEND_URL: 'http://localhost:3000',
  empresaPrincipalId: ''
};
