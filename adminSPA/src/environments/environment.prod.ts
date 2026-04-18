export const environment = {
  production: true,
  API_URL: 'https://tu-api-produccion.com/api/',
  deploymentMode: 'enterprise' as 'saas' | 'enterprise',
  FRONTEND_URL: 'https://tu-frontend-produccion.com',
  /** Mismo UUID que EMPRESA_PRINCIPAL_ID en el servidor (obligatorio en prod para listado plataforma). */
  empresaPrincipalId: ''
};