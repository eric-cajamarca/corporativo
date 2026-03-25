// Script simple para verificar que las rutas se carguen correctamente
// sin necesidad de base de datos


// Verificar que los módulos se importen correctamente
try {
  
  const cajaController = require('./controllers/cajaController');
  
  const creditosController = require('./controllers/creditosController');
  
  const despachosController = require('./controllers/despachosController');
  
  const enviosController = require('./controllers/enviosController');
  
  const facturacionController = require('./controllers/facturacionController');
  
  const analisisController = require('./controllers/analisisController');
  
  } catch (error) {
  console.error('❌ Error cargando controladores:', error.message);
  process.exit(1);
}

// Verificar que los servicios se importen correctamente
try {
  
  const cajaService = require('./services/caja.service');
  
  const creditosService = require('./services/creditos.service');
  
  const despachosService = require('./services/despachos.service');
  
  const enviosService = require('./services/envios.service');
  
  const facturacionService = require('./services/facturacion.service');
  
  const analisisService = require('./services/analisis.service');
  
  } catch (error) {
  console.error('❌ Error cargando servicios:', error.message);
  process.exit(1);
}

// Verificar que las rutas se importen correctamente
try {
  
  const cajaRoutes = require('./routes/caja');
  
  const creditosRoutes = require('./routes/creditos');
  
  const despachosRoutes = require('./routes/despachos');
  
  const enviosRoutes = require('./routes/envios');
  
  const facturacionRoutes = require('./routes/facturacion');
  
  const analisisRoutes = require('./routes/analisis');
  
  } catch (error) {
  console.error('❌ Error cargando rutas:', error.message);
  process.exit(1);
}

// Verificar middlewares
try {
  
  const tenantQuery = require('./middlewares/tenant-query');
  
  } catch (error) {
  console.error('❌ Error cargando middlewares:', error.message);
  process.exit(1);
}

// Verificar configuración
try {
  
  const dbConfig = require('./dbconfig');
  
  const dbConnection = require('./dbConnection');
  
  } catch (error) {
  console.error('❌ Error en configuración:', error.message);
  process.exit(1);
}

