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