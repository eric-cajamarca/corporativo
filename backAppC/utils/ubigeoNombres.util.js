const fs = require('fs');
const path = require('path');
const { esFragmentoCodigoUbicacion } = require('./direccionClientePdf.util');

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

module.exports = { resolverNombresUbigeo, cargarMapas };
