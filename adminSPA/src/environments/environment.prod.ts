// Producción: antes de `ng build`, ajuste API_URL si el API no va bajo el mismo dominio vía /api/
// (p. ej. API en otro host → 'https://api.midominio.com/api/').
// Con nginx (recomendado): sirva el SPA y haga proxy de /api y /productos-img al Node (puerto 3000).
export const environment = {
  production: true,
  API_URL: '/api/',
  deploymentMode: 'enterprise' as 'saas' | 'enterprise',
  FRONTEND_URL: '',
  /** Mismo UUID que EMPRESA_PRINCIPAL_ID en el backend (obligatorio en prod si usa guard de plataforma). */
  empresaPrincipalId: ''
};
