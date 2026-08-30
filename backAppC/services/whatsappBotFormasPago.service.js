const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '../uploads/formas-pago');
const TIPOS = ['yape', 'plin', 'transferencia'];
const EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

function assertTipo(tipo) {
  const t = String(tipo || '').trim().toLowerCase();
  if (!TIPOS.includes(t)) {
    throw new Error('Tipo de imagen no válido. Use yape, plin o transferencia.');
  }
  return t;
}

function dirEmpresa(idEmpresa) {
  return path.join(BASE_DIR, String(idEmpresa));
}

function listarArchivosTipo(idEmpresa, tipo) {
  const dir = dirEmpresa(idEmpresa);
  if (!fs.existsSync(dir)) return [];
  return EXTS.map((ext) => path.join(dir, `${tipo}${ext}`)).filter((p) => fs.existsSync(p));
}

function estadoPorEmpresa(idEmpresa) {
  const out = {};
  for (const tipo of TIPOS) {
    out[tipo] = listarArchivosTipo(idEmpresa, tipo).length > 0;
  }
  return out;
}

function rutaImagen(idEmpresa, tipo) {
  const t = assertTipo(tipo);
  const archivos = listarArchivosTipo(idEmpresa, t);
  return archivos[0] || null;
}

function mimeDeExt(ext) {
  const e = String(ext || '').toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function leerBuffer(idEmpresa, tipo) {
  const archivo = rutaImagen(idEmpresa, tipo);
  if (!archivo) return null;
  const buf = fs.readFileSync(archivo);
  return {
    buffer: buf,
    mime: mimeDeExt(path.extname(archivo)),
    filename: path.basename(archivo)
  };
}

function claveDesdeMedioPago(medioPago) {
  const t = String(medioPago || '').toLowerCase();
  if (/\byape\b/.test(t)) return 'yape';
  if (/\bplin\b/.test(t)) return 'plin';
  if (/\btransfer/.test(t) || /\bbanc/.test(t)) return 'transferencia';
  return null;
}

function captionPago(medioPago, totalTxt) {
  const clave = claveDesdeMedioPago(medioPago);
  if (clave === 'yape') {
    return `Paga ${totalTxt} con *Yape*. Escanea el QR y, cuando esté listo, un vendedor lo confirma.`;
  }
  if (clave === 'plin') {
    return `Paga ${totalTxt} con *Plin*. Escanea el QR y, cuando esté listo, un vendedor lo confirma.`;
  }
  if (clave === 'transferencia') {
    return `Paga ${totalTxt} por *transferencia*. Usa los datos de la foto; un vendedor confirmará el depósito.`;
  }
  return `Paga ${totalTxt} (${medioPago}).`;
}

function leerComoAdjunto(idEmpresa, medioPago, totalTxt) {
  const clave = claveDesdeMedioPago(medioPago);
  if (!clave) return null;
  const data = leerBuffer(idEmpresa, clave);
  if (!data) return null;
  return {
    imageBase64: data.buffer.toString('base64'),
    filename: data.filename,
    caption: captionPago(medioPago, totalTxt)
  };
}

function eliminarAnteriores(idEmpresa, tipo, excepto) {
  const t = assertTipo(tipo);
  for (const p of listarArchivosTipo(idEmpresa, t)) {
    if (excepto && path.resolve(p) === path.resolve(excepto)) continue;
    try {
      fs.unlinkSync(p);
    } catch (err) {
      console.error('whatsappBotFormasPago unlink:', err.message);
    }
  }
}

function eliminar(idEmpresa, tipo) {
  const t = assertTipo(tipo);
  eliminarAnteriores(idEmpresa, t, null);
  return estadoPorEmpresa(idEmpresa);
}

module.exports = {
  TIPOS,
  assertTipo,
  estadoPorEmpresa,
  rutaImagen,
  leerBuffer,
  leerComoAdjunto,
  claveDesdeMedioPago,
  eliminarAnteriores,
  eliminar
};
