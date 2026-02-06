// SIEMPRE usa environment para URLs (regla 2.2)
// SIEMPRE usa UPPER_SNAKE_CASE para constantes (regla 6.1)

// En desarrollo usamos URL relativa para que las peticiones vayan al mismo origen (proxy)
// y la cookie httpOnly se envíe correctamente (sin guardar token en el frontend).
export const environment = {
  production: false,
  API_URL: '/api/',
  FRONTEND_URL: 'http://localhost:4200'
};