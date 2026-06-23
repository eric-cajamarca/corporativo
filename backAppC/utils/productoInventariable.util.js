/** Unidad SUNAT ZZ = servicio (no controla inventario físico). */
const CODIGO_PRESENTACION_SERVICIO = 'ZZ';

function esCodigoPresentacionServicio(codigo) {
  return String(codigo || '')
    .trim()
    .toUpperCase() === CODIGO_PRESENTACION_SERVICIO;
}

module.exports = {
  CODIGO_PRESENTACION_SERVICIO,
  esCodigoPresentacionServicio
};
