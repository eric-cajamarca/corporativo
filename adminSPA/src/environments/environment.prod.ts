// Producción: antes de `ng build`, ajuste API_URL si el API no va bajo el mismo dominio vía /api/
// (p. ej. API en otro host → 'https://api.midominio.com/api/').
// Con nginx (recomendado): sirva el SPA y haga proxy de /api y /productos-img al Node (puerto 3000).
export const environment = {
  production: true,
  API_URL: '/api/',
  APP_VERSION: '2.1.0',
  /** Mismo host que la SPA (Nginx hace proxy a pdf-backend). */
  PDF_API_BASE: '/api/reports',
  deploymentMode: 'enterprise' as 'saas' | 'enterprise',
  FRONTEND_URL: 'https://businesssoft.net',
  /** Mismo UUID que EMPRESA_PRINCIPAL_ID en el backend (obligatorio en prod si usa guard de plataforma). */
  empresaPrincipalId: ''
};
