const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB } = require('./dbConnection');
const xss = require('xss'); // Solo si vas a usarlo
const cookieParser = require('cookie-parser');
const path = require('path');
const { querySafeMiddleware } = require('./middlewares/tenant-query');
// Importación de rutas
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
const facturacionRoutes = require('./routes/facturacion');
const analisisRoutes = require('./routes/analisis');
const dashboardRoutes = require('./routes/dashboard');
const permisosRoutes = require('./routes/permisos');
const gestoresRoutes = require('./routes/gestores');
const usuarioSucursalRoutes = require('./routes/usuarioSucursal');
const impuestosRoutes = require('./routes/impuestos');
const cotizacionesRoutes = require('./routes/cotizaciones');
const catalogosRoutes = require('./routes/catalogos');


const app = express();

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

// Servir archivos estáticos desde uploads
app.use('/logos', express.static(path.join(__dirname, 'uploads/configuraciones')));

// Servir archivos estáticos default
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

app.use(cookieParser());
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON y formularios
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// Middleware CORS - Más restrictivo para producción
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:4200',  // Desarrollo
      'http://127.0.0.1:4200',  // Desarrollo alternativo
      process.env.FRONTEND_URL  // Variable de entorno para producción
    ].filter(Boolean); // Remover valores undefined

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400 // Cache preflight por 24 horas
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  // res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Access-Control-Allow-Request-Method');
  // res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  // res.header('Allow', 'GET, PUT, POST, DELETE, OPTIONS');
  next();
});

// Ruta de prueba para conexión a DB
app.get('/database', async (req, res) => {
  try {
    await connectDB();
    console.log('Conexión exitosa a la base de datos');
    res.send('¡Conexión exitosa a la base de datos!');
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
    res.status(500).send('¡Error al conectar a la base de datos!');
  }
});

app.use('/api',querySafeMiddleware); // Agrega req.querySafe
// Middleware XSS (opcional, descomentar si lo necesitas)
/*
app.use((req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      req.body[key] = xss(req.body[key]);
    });
  }
  next();
});
*/

// Montar rutas
app.use('/api', detalleVentasRoutes);
app.use('/api', adminRoutes);
app.use('/api', cventasRoutes);
app.use('/api', renviosRouters);
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
app.use('/api/facturacion', facturacionRoutes);
app.use('/api/analisis', analisisRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/permisos', permisosRoutes);
app.use('/api/gestores', gestoresRoutes);
app.use('/api/usuario-sucursal', usuarioSucursalRoutes);
app.use('/api/cotizaciones', cotizacionesRoutes);
app.use('/api/catalogos', catalogosRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  try {
    const envioSunatJob = require('./jobs/envioSunat.job');
    envioSunatJob.iniciar();
  } catch (e) {
    console.error('No se pudo iniciar job envío automático SUNAT:', e.message);
  }
});
