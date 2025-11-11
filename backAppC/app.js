const express = require('express');
const cors = require('cors');
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


const app = express();

// Servir archivos estáticos desde uploads
app.use('/logos', express.static(path.join(__dirname, 'uploads/configuraciones')));

// Servir archivos estáticos default
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

app.use(cookieParser());
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON y formularios
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// Middleware CORS
app.use(cors({
  origin: ['http://localhost:4200'],
  credentials: true,
  allowedHeaders: ['Authorization', 'X-API-KEY', 'Origin', 'X-Requested-With', 'Content-Type', 'Access-Control-Allow-Request-Method'],
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  
}));

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
app.use('/api', unidporcajaRoutes);
app.use('/api', preciosVRoutes);
app.use('/api', proveedoresRoutes);
app.use('/api', factilizaRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
