// Validación simple de imports sin ejecutar funciones

const modulesToTest = [
  // Controladores
  './controllers/cajaController',
  './controllers/creditosController',
  './controllers/despachosController',
  './controllers/enviosController',
  './controllers/facturacionController',
  './controllers/analisisController',

  // Servicios
  './services/caja.service',
  './services/creditos.service',
  './services/despachos.service',
  './services/envios.service',
  './services/facturacion.service',
  './services/analisis.service',

  // Repositorios
  './repositories/caja.repository',
  './repositories/creditos.repository',
  './repositories/despachos.repository',
  './repositories/envios.repository',
  './repositories/facturacion.repository',
  './repositories/analisis.repository',

  // Rutas
  './routes/caja',
  './routes/creditos',
  './routes/despachos',
  './routes/envios',
  './routes/facturacion',
  './routes/analisis',

  // Middlewares
  './middlewares/tenant-query'
];

let successCount = 0;
let errorCount = 0;

for (const modulePath of modulesToTest) {
  try {
    require.resolve(modulePath);
    successCount++;
  } catch {
    errorCount++;
  }
}

if (errorCount === 0) {
  process.exit(0);
} else {
  process.exit(1);
}
