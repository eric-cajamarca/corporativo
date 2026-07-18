const { randomUUID } = require('crypto');
const libroReclamacionesRepository = require('../repositories/libroReclamaciones.repository');
const emailService = require('./email.service');

const PROVEEDOR = {
  razonSocial: 'BUSINESS SOFT COMPANY S.A.C.',
  ruc: '20614636930',
  domicilio: 'PJ. LOS OLIVOS NRO. S/N URB. LOS OLIVOS, CAJAMARCA - JAÉN - JAÉN, Perú',
  telefono: '+51 993 289 440',
  email: 'businesssoftperu@gmail.com'
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIPOS = new Set(['QUEJA', 'RECLAMO']);
const BIEN_TIPOS = new Set(['PRODUCTO', 'SERVICIO']);
const DOC_TIPOS = new Set(['DNI', 'CE', 'PASAPORTE', 'RUC', 'OTRO']);
const ESTADOS_RESPUESTA = new Set(['RESPONDIDO', 'CERRADO', 'EN_PROCESO']);

function trimStr(v, max) {
  const s = String(v == null ? '' : v).trim();
  return max ? s.slice(0, max) : s;
}

function emailNotificacionInterna() {
  return (
    trimStr(process.env.RECLAMACIONES_EMAIL_NOTIFICACION) ||
    PROVEEDOR.email
  );
}

function validarRegistro(body) {
  const tipo = trimStr(body?.tipo).toUpperCase();
  const consumidorNombre = trimStr(body?.consumidorNombre, 200);
  const consumidorDocumentoTipo = trimStr(body?.consumidorDocumentoTipo, 20).toUpperCase() || 'DNI';
  const consumidorDocumentoNumero = trimStr(body?.consumidorDocumentoNumero, 30);
  const consumidorDomicilio = trimStr(body?.consumidorDomicilio, 300);
  const consumidorTelefono = trimStr(body?.consumidorTelefono, 30) || null;
  const consumidorEmail = trimStr(body?.consumidorEmail, 200).toLowerCase();
  const esMenor = body?.esMenor === true || body?.esMenor === 1 || body?.esMenor === '1';
  const tutorNombre = trimStr(body?.tutorNombre, 200) || null;
  const bienTipo = trimStr(body?.bienTipo).toUpperCase();
  const bienDescripcion = trimStr(body?.bienDescripcion, 500);
  const detalle = trimStr(body?.detalle, 2000);
  const pedidoConsumidor = trimStr(body?.pedidoConsumidor, 1000) || null;
  const honeypot = trimStr(body?.website);

  if (honeypot) {
    throw new Error('SPAM_DETECTADO');
  }
  if (!TIPOS.has(tipo)) throw new Error('TIPO_INVALIDO');
  if (!consumidorNombre || consumidorNombre.length < 3) throw new Error('NOMBRE_INVALIDO');
  if (!DOC_TIPOS.has(consumidorDocumentoTipo)) throw new Error('DOCUMENTO_TIPO_INVALIDO');
  if (!consumidorDocumentoNumero || consumidorDocumentoNumero.length < 5) {
    throw new Error('DOCUMENTO_NUMERO_INVALIDO');
  }
  if (!consumidorDomicilio || consumidorDomicilio.length < 5) throw new Error('DOMICILIO_INVALIDO');
  if (!EMAIL_RE.test(consumidorEmail)) throw new Error('EMAIL_INVALIDO');
  if (esMenor && !tutorNombre) throw new Error('TUTOR_REQUERIDO');
  if (!BIEN_TIPOS.has(bienTipo)) throw new Error('BIEN_TIPO_INVALIDO');
  if (!bienDescripcion || bienDescripcion.length < 3) throw new Error('BIEN_DESCRIPCION_INVALIDA');
  if (!detalle || detalle.length < 10) throw new Error('DETALLE_INVALIDO');

  let bienMonto = null;
  if (body?.bienMonto != null && String(body.bienMonto).trim() !== '') {
    const n = Number(body.bienMonto);
    if (Number.isNaN(n) || n < 0) throw new Error('MONTO_INVALIDO');
    bienMonto = n;
  }

  return {
    tipo,
    consumidorNombre,
    consumidorDocumentoTipo,
    consumidorDocumentoNumero,
    consumidorDomicilio,
    consumidorTelefono,
    consumidorEmail,
    esMenor,
    tutorNombre,
    bienTipo,
    bienDescripcion,
    bienMonto,
    detalle,
    pedidoConsumidor
  };
}

function htmlConstancia(registro, fechaRegistro) {
  const frontend = trimStr(process.env.FRONTEND_URL) || 'https://efaferp.com';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #1f3b73;">Constancia de ${registro.tipo === 'QUEJA' ? 'Queja' : 'Reclamo'}</h2>
      <p>Se registró su hoja en el Libro de Reclamaciones de <strong>${PROVEEDOR.razonSocial}</strong>.</p>
      <table style="width:100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding:6px 0;"><strong>Código:</strong></td><td>${registro.codigo}</td></tr>
        <tr><td style="padding:6px 0;"><strong>Fecha:</strong></td><td>${fechaRegistro}</td></tr>
        <tr><td style="padding:6px 0;"><strong>Tipo:</strong></td><td>${registro.tipo}</td></tr>
        <tr><td style="padding:6px 0;"><strong>Consumidor:</strong></td><td>${registro.consumidorNombre}</td></tr>
        <tr><td style="padding:6px 0;"><strong>Documento:</strong></td><td>${registro.consumidorDocumentoTipo} ${registro.consumidorDocumentoNumero}</td></tr>
        <tr><td style="padding:6px 0;"><strong>Bien/Servicio:</strong></td><td>${registro.bienTipo} — ${registro.bienDescripcion}</td></tr>
        <tr><td style="padding:6px 0; vertical-align:top;"><strong>Detalle:</strong></td><td>${registro.detalle}</td></tr>
      </table>
      <p style="margin-top:16px;">El proveedor responderá en un plazo máximo de <strong>15 días hábiles</strong>.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
      <p style="font-size:13px;color:#64748b;">
        ${PROVEEDOR.razonSocial}<br/>
        RUC ${PROVEEDOR.ruc}<br/>
        ${PROVEEDOR.domicilio}<br/>
        ${PROVEEDOR.telefono} · ${PROVEEDOR.email}<br/>
        <a href="${frontend}/politicas/libro-reclamaciones">${frontend}/politicas/libro-reclamaciones</a>
      </p>
    </div>
  `;
}

async function enviarEmails(registro) {
  const fechaRegistro = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const subjectConsumidor = `Constancia Libro de Reclamaciones ${registro.codigo}`;
  const textConsumidor =
    `Su ${registro.tipo.toLowerCase()} fue registrada con código ${registro.codigo}. ` +
    `Responderemos en un máximo de 15 días hábiles.`;

  try {
    await emailService.enviarNotificacionOperativa({
      to: registro.consumidorEmail,
      subject: subjectConsumidor,
      text: textConsumidor,
      html: htmlConstancia(registro, fechaRegistro)
    });
  } catch (err) {
    console.error('libroReclamaciones.service email consumidor:', err);
  }

  const toInterno = emailNotificacionInterna();
  try {
    await emailService.enviarNotificacionOperativa({
      to: toInterno,
      subject: `[Libro reclamaciones] ${registro.codigo} — ${registro.tipo}`,
      text:
        `Nueva hoja ${registro.codigo}\n` +
        `Tipo: ${registro.tipo}\n` +
        `Consumidor: ${registro.consumidorNombre} (${registro.consumidorEmail})\n` +
        `Detalle: ${registro.detalle}`
    });
  } catch (err) {
    console.error('libroReclamaciones.service email interno:', err);
  }
}

exports.obtenerInfoProveedor = () => ({ ...PROVEEDOR });

exports.registrar = async (pool, body, meta = {}) => {
  const datos = validarRegistro(body);
  const idReclamacion = randomUUID();
  const { codigo } = await libroReclamacionesRepository.insertar(pool, {
    idReclamacion,
    ...datos,
    ipOrigen: trimStr(meta.ip, 45) || null,
    userAgent: trimStr(meta.userAgent, 400) || null
  });

  const registro = { idReclamacion, codigo, ...datos };
  await enviarEmails(registro);

  return {
    idReclamacion,
    codigo,
    tipo: datos.tipo,
    mensaje:
      'Su hoja fue registrada. Enviaremos la constancia a su correo y responderemos en un máximo de 15 días hábiles.',
    proveedor: PROVEEDOR
  };
};

exports.listar = async (pool, query = {}) => {
  const estado = trimStr(query.estado).toUpperCase() || null;
  return libroReclamacionesRepository.listar(pool, {
    estado: estado || undefined,
    limit: query.limit,
    offset: query.offset
  });
};

exports.obtener = async (pool, idReclamacion) => {
  const row = await libroReclamacionesRepository.obtenerPorId(pool, idReclamacion);
  if (!row) throw new Error('NO_ENCONTRADO');
  return row;
};

exports.responder = async (pool, idReclamacion, body, user) => {
  const existente = await libroReclamacionesRepository.obtenerPorId(pool, idReclamacion);
  if (!existente) throw new Error('NO_ENCONTRADO');

  const respuestaProveedor = trimStr(body?.respuestaProveedor, 2000);
  if (!respuestaProveedor || respuestaProveedor.length < 5) {
    throw new Error('RESPUESTA_INVALIDA');
  }

  let estado = trimStr(body?.estado).toUpperCase() || 'RESPONDIDO';
  if (!ESTADOS_RESPUESTA.has(estado)) estado = 'RESPONDIDO';

  const respondidoPor =
    trimStr(user?.email || user?.correo || user?.razonSocial, 200) || 'plataforma';

  const ok = await libroReclamacionesRepository.responder(pool, {
    idReclamacion,
    respuestaProveedor,
    respondidoPor,
    estado
  });
  if (!ok) throw new Error('NO_ENCONTRADO');

  try {
    await emailService.enviarNotificacionOperativa({
      to: existente.consumidorEmail,
      subject: `Respuesta a su ${existente.tipo.toLowerCase()} ${existente.codigo}`,
      text:
        `Estimado/a ${existente.consumidorNombre},\n\n` +
        `Respecto a su ${existente.tipo.toLowerCase()} ${existente.codigo}, nuestra respuesta es:\n\n` +
        `${respuestaProveedor}\n\n` +
        `${PROVEEDOR.razonSocial}`
    });
  } catch (err) {
    console.error('libroReclamaciones.service email respuesta:', err);
  }

  return libroReclamacionesRepository.obtenerPorId(pool, idReclamacion);
};
