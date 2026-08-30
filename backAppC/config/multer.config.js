// config/multer.config.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear directorio si no existe
const uploadDir = path.join(__dirname, '../uploads/configuraciones/');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración para logos de empresas
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `logo-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo imágenes JPEG, PNG, GIF o WEBP'), false);
  }
};

const limits = {
  fileSize: 4 * 1024 * 1024 // 4MB
};

// Exportar configuración específica
exports.uploadLogo = multer({
  storage: logoStorage,
  fileFilter,
  limits
}).single('logo'); // 'logo' es el nombre del campo del formulario

// Opcional: Otras configuraciones para diferentes tipos de uploads
exports.uploadDocumentos = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../uploads/documentos/'));
    },
    filename: (req, file, cb) => {
      cb(null, `doc-${Date.now()}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB para documentos
  }
}).single('documento');

// Certificado digital PFX para firma de XML (facturación electrónica). Se guarda en memoria para enviar a BD.
const certFileFilter = (req, file, cb) => {
  const ext = (path.extname(file.originalname) || '').toLowerCase();
  const ok = ext === '.pfx' || file.mimetype === 'application/x-pkcs12' || file.mimetype === 'application/pkcs12';
  if (ok) cb(null, true);
  else cb(new Error('Solo se permiten archivos .pfx (certificado digital)'), false);
};

exports.uploadCertificadoFacturacion = multer({
  storage: multer.memoryStorage(),
  fileFilter: certFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
}).single('certificado');

// Imágenes de producto: uploads/productos/{idEmpresa}/{idProducto}/
const productosBaseDir = path.join(__dirname, '../uploads/productos');
if (!fs.existsSync(productosBaseDir)) {
  fs.mkdirSync(productosBaseDir, { recursive: true });
}

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Solo imágenes JPEG, PNG, GIF o WEBP'), false);
};

exports.uploadImagenesProducto = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const idEmpresa = req.user && req.user.empresa;
      const idProducto = req.params && req.params.idProducto;
      if (!idEmpresa || !idProducto) {
        return cb(new Error('Falta idEmpresa o idProducto'));
      }
      const dir = path.join(productosBaseDir, idEmpresa, idProducto);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase() || '.jpg';
      const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
      const name = `img-${Date.now()}-${Math.round(Math.random() * 1E9)}${safeExt}`;
      cb(null, name);
    }
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB por archivo
}).array('imagenes', 5);

const excelProductosFilter = (req, file, cb) => {
  const ext = (path.extname(file.originalname) || '').toLowerCase();
  const ok =
    ext === '.xlsx' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/octet-stream';
  if (ok) cb(null, true);
  else cb(new Error('Solo se permiten archivos .xlsx'), false);
};

/** Importación masiva de productos (memoria, máx. 8 MB). Campo formulario: archivo */
exports.uploadProductosExcel = multer({
  storage: multer.memoryStorage(),
  fileFilter: excelProductosFilter,
  limits: { fileSize: 8 * 1024 * 1024 }
}).single('archivo');

const formasPagoBaseDir = path.join(__dirname, '../uploads/formas-pago');

/** QR / datos de Yape, Plin o transferencia. Campo: imagen. */
exports.uploadFormaPagoBot = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const idEmpresa = req.user && req.user.empresa;
      if (!idEmpresa) return cb(new Error('Falta idEmpresa'));
      const dir = path.join(formasPagoBaseDir, String(idEmpresa));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const tipo = String(req.params && req.params.tipo ? req.params.tipo : '').toLowerCase();
      const ext = (path.extname(file.originalname) || '').toLowerCase() || '.jpg';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
      cb(null, `${tipo}${safeExt}`);
    }
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('imagen');