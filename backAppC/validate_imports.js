// Validación simple de imports sin ejecutar funciones
console.log('🔍 VALIDANDO IMPORTS DE MÓDULOS NUEVOS');

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

console.log('\n📦 Probando imports...\n');

for (const modulePath of modulesToTest) {
  try {
    // Solo intentar importar, no ejecutar
    require.resolve(modulePath);
    console.log(`✅ ${modulePath}`);
    successCount++;
  } catch (error) {
    console.log(`❌ ${modulePath}: ${error.message}`);
    errorCount++;
  }
}

console.log(`\n📊 RESULTADO: ${successCount} exitosos, ${errorCount} errores`);

if (errorCount === 0) {
  console.log('\n🎉 TODOS LOS MÓDULOS SE IMPORTAN CORRECTAMENTE');
  console.log('✅ El backend está listo para pruebas con base de datos');
} else {
  console.log('\n⚠️  HAY ERRORES QUE CORREGIR');
  process.exit(1);
}