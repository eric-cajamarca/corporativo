const utilidadesRepository = require('../repositories/utilidades.repository');

const TIPOS_VALIDOS = ['dia', 'mes', 'anio', 'rango'];

/**
 * Obtiene utilidades por período. Solo administrador (validado en controller).
 * @param {object} pool - Pool de conexión
 * @param {string} idEmpresa - UUID de la empresa (del token)
 * @param {string} tipo - 'dia' | 'mes' | 'anio' | 'rango'
 * @param {string} fechaInicio - YYYY-MM-DD
 * @param {string} fechaFin - YYYY-MM-DD
 */
async function obtenerUtilidades(pool, idEmpresa, tipo, fechaInicio, fechaFin) {
  if (!idEmpresa) {
    throw new Error('Empresa no identificada');
  }
  const t = (tipo || '').toLowerCase();
  if (!TIPOS_VALIDOS.includes(t)) {
    throw new Error('Tipo de período no válido. Use: dia, mes, anio o rango');
  }
  if (!fechaInicio || !fechaFin) {
    throw new Error('fechaInicio y fechaFin son requeridos');
  }
  const fIni = new Date(fechaInicio);
  const fFin = new Date(fechaFin);
  if (isNaN(fIni.getTime()) || isNaN(fFin.getTime())) {
    throw new Error('Fechas inválidas');
  }
  if (fIni > fFin) {
    throw new Error('fechaInicio no puede ser mayor que fechaFin');
  }

  return utilidadesRepository.obtenerUtilidades(pool, idEmpresa, t, fechaInicio, fechaFin);
}

/**
 * Obtiene utilidades a nivel detalle (una fila por línea de venta). Solo administrador.
 */
async function obtenerUtilidadesDetalle(pool, idEmpresa, fechaInicio, fechaFin) {
  if (!idEmpresa) {
    throw new Error('Empresa no identificada');
  }
  if (!fechaInicio || !fechaFin) {
    throw new Error('fechaInicio y fechaFin son requeridos');
  }
  const fIni = new Date(fechaInicio);
  const fFin = new Date(fechaFin);
  if (isNaN(fIni.getTime()) || isNaN(fFin.getTime())) {
    throw new Error('Fechas inválidas');
  }
  if (fIni > fFin) {
    throw new Error('fechaInicio no puede ser mayor que fechaFin');
  }
  return utilidadesRepository.obtenerUtilidadesDetalle(pool, idEmpresa, fechaInicio, fechaFin);
}

module.exports = {
  obtenerUtilidades,
  obtenerUtilidadesDetalle,
};
