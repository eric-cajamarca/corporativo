const { withPool } = require('../utils/dbPool.util');
const libroReclamacionesService = require('../services/libroReclamaciones.service');
const { puedeAccesoListadoPlataformaEmpresas } = require('../utils/plataformaEmpresa.util');

const MENSAJES_VALIDACION = {
  TIPO_INVALIDO: 'Indique si es Queja o Reclamo.',
  NOMBRE_INVALIDO: 'Ingrese su nombre completo.',
  DOCUMENTO_TIPO_INVALIDO: 'Tipo de documento no válido.',
  DOCUMENTO_NUMERO_INVALIDO: 'Ingrese un número de documento válido.',
  DOMICILIO_INVALIDO: 'Ingrese su domicilio.',
  EMAIL_INVALIDO: 'Ingrese un correo electrónico válido.',
  TUTOR_REQUERIDO: 'Si es menor de edad, indique el nombre del tutor o representante.',
  BIEN_TIPO_INVALIDO: 'Indique si el bien es Producto o Servicio.',
  BIEN_DESCRIPCION_INVALIDA: 'Describa el producto o servicio contratado.',
  DETALLE_INVALIDO: 'Detalle su queja o reclamo (mínimo 10 caracteres).',
  MONTO_INVALIDO: 'El monto indicado no es válido.',
  RESPUESTA_INVALIDA: 'La respuesta del proveedor es obligatoria.',
  SPAM_DETECTADO: 'Solicitud rechazada.',
  NO_ENCONTRADO: 'Reclamación no encontrada.'
};

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

exports.infoProveedor = async (_req, res) => {
  return res.status(200).json({ data: libroReclamacionesService.obtenerInfoProveedor() });
};

exports.registrar = async (req, res) => {
  try {
    const data = await withPool((pool) =>
      libroReclamacionesService.registrar(pool, req.body || {}, {
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] || ''
      })
    );
    return res.status(201).json({ data, message: data.mensaje });
  } catch (error) {
    const code = error.message;
    if (MENSAJES_VALIDACION[code]) {
      return res.status(400).json({ message: MENSAJES_VALIDACION[code], code });
    }
    console.error('libroReclamacionesController.registrar:', error);
    return res.status(500).json({ message: 'No se pudo registrar la hoja de reclamación.' });
  }
};

exports.listar = async (req, res) => {
  try {
    if (!puedeAccesoListadoPlataformaEmpresas(req)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    const data = await withPool((pool) => libroReclamacionesService.listar(pool, req.query || {}));
    return res.status(200).json({ data });
  } catch (error) {
    console.error('libroReclamacionesController.listar:', error);
    return res.status(500).json({ message: 'Error al listar reclamaciones.' });
  }
};

exports.obtener = async (req, res) => {
  try {
    if (!puedeAccesoListadoPlataformaEmpresas(req)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    const data = await withPool((pool) =>
      libroReclamacionesService.obtener(pool, req.params.idReclamacion)
    );
    return res.status(200).json({ data });
  } catch (error) {
    if (error.message === 'NO_ENCONTRADO') {
      return res.status(404).json({ message: MENSAJES_VALIDACION.NO_ENCONTRADO });
    }
    console.error('libroReclamacionesController.obtener:', error);
    return res.status(500).json({ message: 'Error al obtener la reclamación.' });
  }
};

exports.responder = async (req, res) => {
  try {
    if (!puedeAccesoListadoPlataformaEmpresas(req)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    const data = await withPool((pool) =>
      libroReclamacionesService.responder(pool, req.params.idReclamacion, req.body || {}, req.user)
    );
    return res.status(200).json({ data, message: 'Respuesta registrada.' });
  } catch (error) {
    const code = error.message;
    if (MENSAJES_VALIDACION[code]) {
      const status = code === 'NO_ENCONTRADO' ? 404 : 400;
      return res.status(status).json({ message: MENSAJES_VALIDACION[code], code });
    }
    console.error('libroReclamacionesController.responder:', error);
    return res.status(500).json({ message: 'Error al registrar la respuesta.' });
  }
};
