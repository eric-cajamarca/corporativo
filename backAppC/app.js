require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { assertProductionEnv } = require('./config/env.validation');
assertProductionEnv();
const express = require('express');
require('express-async-errors');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB } = require('./dbConnection');
const xss = require('xss'); // Solo si vas a usarlo
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const auth = require('./middlewares/autenticate');
const { requestContextMiddleware } = require('./middlewares/requestContext.middleware');
const { querySafeMiddleware } = require('./middlewares/tenant-query');
const { saasSuscripcionGate } = require('./middlewares/saasSuscripcionGate');
const publicSaasRoutes = require('./routes/publicSaas');
// Importaci?n de rutas
const detalleVentasRoutes = require('./routes/detalleventas');
const adminRoutes = require('./routes/admin');
const cventasRoutes = require('./routes/cventas');
const renviosRouters = require('./routes/renvios');
const empresaRouters = require('./routes/empresa');
const comprobantesRoutes = require('./routes/comprobantes');
const programacionRoutes = require('./routes/programacion');
const rolRoutes = require('./routes/rol');
const clientesRoutes = require('./routes/clientes');
const direccionClientesRoutes = require('./routes/direccionClientes');
const documentosRoutes = require('./routes/documentos');
const productosRoutes = require('./routes/productos');
const comprasRoutes = require('./routes/compras');
const dcomprasRoutes = require('./routes/dcompras');
const sucursalRoutes = require('./routes/sucursal');
const tablasSunatRoutes = require('./routes/tablasSunat');
const categoriaRoutes = require('./routes/categoria');
const presentacionRoutes = require('./routes/presentacion');
const marcaRoutes = require('./routes/marcas');
const unidporcajaRoutes = require('./routes/unidporcaja');
const preciosVRoutes = require('./routes/preciosV');
const proveedoresRoutes = require('./routes/proveedores');
const factilizaRoutes = require('./routes/factiliza');
const vehiculosRoutes = require('./routes/vehiculos');
const whatsappRoutes = require('./routes/whatsapp');
const productoCompuestoRoutes = require('./routes/productoCompuesto');
const productoVarianteRoutes = require('./routes/productoVariante');
const tranferenciaRoutes = require('./routes/transferencia');
const lotesRoutes = require('./routes/lotes');
const lotesUbicacionRoutes = require('./routes/lotesUbicacion');
const ubicacionesPrioridadRoutes = require('./routes/ubicacionesPrioridad');
const cajaRoutes = require('./routes/caja');
const creditosRoutes = require('./routes/creditos');
const despachosRoutes = require('./routes/despachos');
const enviosRoutes = require('./routes/envios');
const choferesRoutes = require('./routes/choferes');
const facturacionRoutes = require('./routes/facturacion');
const analisisRoutes = require('./routes/analisis');
const dashboardRoutes = require('./routes/dashboard');
const reportesRoutes = require('./routes/reportes');
const utilidadesRoutes = require('./routes/utilidades');
const permisosRoutes = require('./routes/permisos');
const gestoresRoutes = require('./routes/gestores');
const usuarioSucursalRoutes = require('./routes/usuarioSucursal');
const impuestosRoutes = require('./routes/impuestos');
const cotizacionesRoutes = require('./routes/cotizaciones');
const catalogosRoutes = require('./routes/catalogos');
const rubrosRoutes = require('./routes/rubros');
const auditoriaRoutes = require('./routes/auditoria');
const externalRoutes = require('./routes/external');
const inventarioRoutes = require('./routes/inventario');
const reservasRoutes = require('./routes/reservas');
const consumoHabitacionRoutes = require('./routes/consumoHabitacion');
const webhooksRoutes = require('./routes/webhooks');
const suscripcionRoutes = require('./routes/suscripcion');


const app = express();
// Tras proxy (nginx, etc.): req.ip y X-Forwarded-For coherentes para login / auditoría
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// Seguridad: Implementar headers de seguridad con helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Servir archivos est?ticos desde uploads
app.use('/logos', express.static(path.join(__dirname, 'uploads/configuraciones')));
app.use('/productos-img', express.static(path.join(__dirname, 'uploads/productos')));

// Servir archivos est?ticos default
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

app.use(cookieParser());
app.use(requestContextMiddleware);
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON y formularios
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


/**
 * Orígenes explícitos (FRONTEND_URL, localhost, CORS_EXTRA_ORIGINS coma-separada).
 */
function buildStaticAllowedOrigins() {
  const extra = (process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    process.env.FRONTEND_URL,
    ...extra
  ].filter(Boolean);
}

/**
 * Origen en red privada / local (LAN, ng serve --host, sistema.local).
 * Si CORS_ALLOW_LAN=0, no se aplica (solo lista explícita + FRONTEND_URL).
 * En NODE_ENV=production sigue activo salvo CORS_ALLOW_LAN=0 (despliegue LAN tras Nginx).
 */
function isPrivateLanOrigin(origin) {
  if (process.env.CORS_ALLOW_LAN === '0') return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (h.endsWith('.local')) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

// Middleware CORS: lista explícita + LAN (ver .env.example, DESPLIEGUE-LAN.md)
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = buildStaticAllowedOrigins();
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (isPrivateLanOrigin(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400
};

app.use(cors(corsOptions));

// Ruta de prueba para conexi?n a DB
app.get('/database', async (req, res) => {
  try {
    await connectDB();
    res.send('?Conexi?n exitosa a la base de datos!');
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
    res.status(500).send('?Error al conectar a la base de datos!');
  }
});

app.use('/api', auth.optionalAuth);
app.use('/api', querySafeMiddleware); // Agrega req.querySafe
app.use('/api', saasSuscripcionGate);
// Rutas públicas SaaS (planes, checkout) y resto
app.use('/api', publicSaasRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/empresa', require('./routes/empresaPublic'));
app.use('/api/activacion', require('./routes/activacionPublic')); // Solo activación por código WhatsApp
// Montar rutas
app.use('/api', detalleVentasRoutes);
app.use('/api', adminRoutes);
app.use('/api', cventasRoutes);
app.use('/api', empresaRouters);
app.use('/api', comprobantesRoutes);
app.use('/api', programacionRoutes);
app.use('/api', rolRoutes);
app.use('/api', clientesRoutes);
app.use('/api', direccionClientesRoutes);
app.use('/api', documentosRoutes);
app.use('/api', productosRoutes);
app.use('/api', comprasRoutes);
app.use('/api', dcomprasRoutes);
app.use('/api', sucursalRoutes);
app.use('/api', tablasSunatRoutes);
app.use('/api', categoriaRoutes);
app.use('/api', presentacionRoutes);
app.use('/api', marcaRoutes);
app.use('/api', impuestosRoutes);
app.use('/api', unidporcajaRoutes);
app.use('/api', preciosVRoutes);
app.use('/api', proveedoresRoutes);
app.use('/api', factilizaRoutes);
app.use('/api', vehiculosRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api', productoCompuestoRoutes);
app.use('/api', productoVarianteRoutes);
app.use('/api', tranferenciaRoutes);
app.use('/api', lotesRoutes);
app.use('/api', lotesUbicacionRoutes);
app.use('/api', ubicacionesPrioridadRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/creditos', creditosRoutes);
app.use('/api/despachos', despachosRoutes);
app.use('/api/envios', enviosRoutes);
// Nota: renviosRouters contiene rutas legacy con /envios/:id y puede interceptar /api/envios/*
// si se monta antes que enviosRoutes.
app.use('/api', renviosRouters);
app.use('/api/choferes', choferesRoutes);
app.use('/api/facturacion', facturacionRoutes);
app.use('/api/analisis', analisisRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/utilidades', utilidadesRoutes);
app.use('/api/permisos', permisosRoutes);
app.use('/api/avisos', require('./routes/avisos'));
app.use('/api/gestores', gestoresRoutes);
app.use('/api/usuario-sucursal', usuarioSucursalRoutes);
app.use('/api/cotizaciones', cotizacionesRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api', rubrosRoutes);
app.use('/api', require('./routes/valesDespacho'));
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api', reservasRoutes);
app.use('/api', consumoHabitacionRoutes);
// Webhooks de pasarelas de pago (públicos, identifican empresa por orderNumber = idEmpresa-uuid)
app.use('/api', webhooksRoutes);
app.use('/api', suscripcionRoutes);
const grifoRoutes = require('./routes/grifo');
app.use('/api', grifoRoutes);

// Modo una sola máquina (sin Nginx): sirve el build Angular desde SERVE_SPA_ROOT (p. ej. C:\EFAF\app\www)
if (process.env.SERVE_SPA_ROOT) {
  const spaRoot = path.resolve(process.env.SERVE_SPA_ROOT);
  if (fs.existsSync(spaRoot)) {
    app.use(express.static(spaRoot, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') {
        return next();
      }
      res.sendFile(path.join(spaRoot, 'index.html'), (err) => (err ? next(err) : undefined));
    });
    console.error('context:', JSON.stringify({ level: 'info', message: 'desktop_spa_enabled', spaRoot }));
  } else {
    console.error('context:', JSON.stringify({ level: 'error', message: 'SERVE_SPA_ROOT_missing', spaRoot }));
  }
}

// Errores: 5xx → WhatsApp al desarrollador (throttle en seguridadAlertas); 4xx sin alerta
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

// Health para Kubernetes/Ambassador (sin auth). Con HEALTH_CHECK_DB=1 valida SELECT 1.
app.get('/health', async (req, res) => {
  const body = { status: 'ok', service: 'backAppC', requestId: req.requestId };
  if (process.env.HEALTH_CHECK_DB === '1') {
    try {
      const { withPool } = require('./utils/dbPool.util');
      await withPool(async (pool) => {
        await pool.request().query('SELECT 1 AS ok');
      });
      body.db = 'ok';
    } catch (error) {
      console.error('context:', JSON.stringify({ level: 'error', message: 'health_db_failed', requestId: req.requestId, detail: error.message }));
      return res.status(503).json({ ...body, status: 'degraded', db: 'error' });
    }
  }
  res.status(200).json(body);
});

// Iniciar servidor
app.listen(PORT, () => {
  try {
    const envioSunatJob = require('./jobs/envioSunat.job');
    envioSunatJob.iniciar();
  } catch (e) {
    console.error('No se pudo iniciar job envío automático SUNAT:', e.message);
  }
  /*//try {
    const guiasTicketJob = require('./jobs/guiasTicket.job');
    guiasTicketJob.iniciar();
  } catch (e) {
    console.error('No se pudo iniciar job guiasTicket:', e.message);
  }*/
  try {
    const suscripcionVencimientoJob = require('./jobs/suscripcionVencimiento.job');
    suscripcionVencimientoJob.iniciar();
  } catch (e) {
    console.error('No se pudo iniciar job suscripción vencimiento:', e.message);
  }
  try {
    const onboardingAutomationJob = require('./jobs/onboardingAutomation.job');
    onboardingAutomationJob.iniciar();
  } catch (e) {
    console.error('No se pudo iniciar job onboarding automation:', e.message);
  }
});
