const fs = require('fs');
const path = require('path');
const {
  esFragmentoCodigoUbicacion,
  limpiarCodigosSunatAlFinal
} = require('./direccionClientePdf.util');

let mapas = null;

function rutaAssets(nombre) {
  const candidatos = [
    path.join(__dirname, '..', 'data', 'ubigeo', nombre),
    path.join(__dirname, '..', '..', 'adminSPA', 'src', 'assets', nombre),
    path.join(__dirname, '..', '..', 'adminSPA', 'public', 'assets', nombre)
  ];
  for (const p of candidatos) {
    if (fs.existsSync(p)) return p;
  }
  return candidatos[1];
}

function cargarJson(nombre) {
  const raw = fs.readFileSync(rutaAssets(nombre), 'utf8');
  return JSON.parse(raw);
}

function cargarMapas() {
  if (mapas) return mapas;
  const regiones = cargarJson('regiones.json');
  const provincias = cargarJson('provincias.json');
  const distritos = cargarJson('distritos.json');
  const region = new Map();
  const provincia = new Map();
  const distrito = new Map();
  for (const r of regiones) {
    if (r?.id != null) region.set(String(r.id).padStart(2, '0'), String(r.name || '').trim());
  }
  for (const p of provincias) {
    if (p?.id != null) provincia.set(String(p.id).padStart(4, '0'), String(p.name || '').trim());
  }
  for (const d of distritos) {
    if (d?.id != null) distrito.set(String(d.id).padStart(6, '0'), String(d.name || '').trim());
  }
  mapas = { region, provincia, distrito };
  return mapas;
}

function soloDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * Si el valor es codigo ubigeo, retorna nombre; si ya es texto, lo devuelve.
 */
function resolverCampoUbicacion(valor, map, longitud) {
  const s = String(valor ?? '').trim();
  if (!s) return '';
  if (!esFragmentoCodigoUbicacion(s)) return s;
  const digits = soloDigitos(s);
  if (!digits) return '';
  const key = longitud === 2
    ? digits.slice(0, 2).padStart(2, '0')
    : longitud === 4
      ? digits.slice(0, 4).padStart(4, '0')
      : digits.slice(0, 6).padStart(6, '0');
  return map.get(key) || '';
}

/**
 * Resuelve region / provincia / distrito desde codigos INEI o ubigeo de 6 digitos.
 * @param {{ region?: string, provincia?: string, distrito?: string, ubigeo?: string }} datos
 * @returns {{ region: string, provincia: string, distrito: string }}
 */
function resolverNombresUbigeo(datos = {}) {
  const { region: mapReg, provincia: mapProv, distrito: mapDist } = cargarMapas();
  const ubi = soloDigitos(datos.ubigeo);
  let codReg = soloDigitos(datos.region);
  let codProv = soloDigitos(datos.provincia);
  let codDist = soloDigitos(datos.distrito);

  if (ubi.length === 6) {
    if (!codDist || codDist.length < 6) codDist = ubi;
    if (!codProv || codProv.length < 4) codProv = ubi.slice(0, 4);
    if (!codReg || codReg.length < 2) codReg = ubi.slice(0, 2);
  }

  const region = resolverCampoUbicacion(datos.region, mapReg, 2)
    || (codReg ? mapReg.get(codReg.slice(0, 2).padStart(2, '0')) || '' : '');
  const provincia = resolverCampoUbicacion(datos.provincia, mapProv, 4)
    || (codProv ? mapProv.get(codProv.slice(0, 4).padStart(4, '0')) || '' : '');
  const distrito = resolverCampoUbicacion(datos.distrito, mapDist, 6)
    || (codDist ? mapDist.get(codDist.slice(0, 6).padStart(6, '0')) || '' : '');

  return { region, provincia, distrito };
}

function normalizarTextoUbicacion(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Dirección legible para PDF: calle (+ urbanización) y nombres de distrito, provincia y departamento.
 * No incluye códigos ni ubigeos.
 * @param {{
 *   direccion?: string,
 *   urbanizacion?: string,
 *   region?: string,
 *   provincia?: string,
 *   distrito?: string,
 *   ubigeo?: string
 * }} datos
 * @returns {string}
 */
function componerDireccionPdf(datos = {}) {
  const partesCalle = [];
  const calle = limpiarCodigosSunatAlFinal(String(datos.direccion ?? '').trim());
  if (calle) partesCalle.push(calle);
  const urb = String(datos.urbanizacion ?? '').trim();
  if (urb && !esFragmentoCodigoUbicacion(urb)) {
    const urbNorm = normalizarTextoUbicacion(urb);
    if (!calle || !normalizarTextoUbicacion(calle).includes(urbNorm)) {
      partesCalle.push(urb);
    }
  }
  const base = partesCalle.join(', ');
  const baseNorm = normalizarTextoUbicacion(base);

  const nombres = resolverNombresUbigeo(datos);
  // Orden habitual en comprobantes: Distrito, Provincia, Departamento (siempre en mayúsculas)
  const ubicParts = [];
  for (const n of [nombres.distrito, nombres.provincia, nombres.region]) {
    if (!n) continue;
    const nNorm = normalizarTextoUbicacion(n);
    if (!nNorm) continue;
    if (baseNorm && baseNorm.includes(nNorm)) continue;
    if (ubicParts.some((p) => normalizarTextoUbicacion(p) === nNorm)) continue;
    ubicParts.push(String(n).toLocaleUpperCase('es-PE'));
  }

  if (!base) return ubicParts.join(', ');
  if (!ubicParts.length) return base;
  return `${base}, ${ubicParts.join(', ')}`;
}

module.exports = { resolverNombresUbigeo, componerDireccionPdf, cargarMapas };
