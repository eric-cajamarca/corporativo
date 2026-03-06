const reportesRepository = require('../repositories/reportes.repository');

function validarRangoFechas(fechaInicio, fechaFin) {
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
}

async function obtenerComprasPorProveedor(pool, idEmpresa, fechaInicio, fechaFin) {
  if (!idEmpresa) {
    throw new Error('Empresa no identificada');
  }
  validarRangoFechas(fechaInicio, fechaFin);
  return reportesRepository.obtenerComprasPorProveedor(pool, idEmpresa, fechaInicio, fechaFin);
}

async function obtenerInventarioResumen(pool, idEmpresa) {
  if (!idEmpresa) {
    throw new Error('Empresa no identificada');
  }
  return reportesRepository.obtenerInventarioResumen(pool, idEmpresa);
}

async function obtenerClientesRentabilidad(pool, idEmpresa, fechaInicio, fechaFin) {
  if (!idEmpresa) {
    throw new Error('Empresa no identificada');
  }
  validarRangoFechas(fechaInicio, fechaFin);
  return reportesRepository.obtenerClientesRentabilidad(pool, idEmpresa, fechaInicio, fechaFin);
}

async function obtenerCarteraCreditos(pool, idEmpresa) {
  if (!idEmpresa) {
    throw new Error('Empresa no identificada');
  }
  return reportesRepository.obtenerCarteraCreditos(pool, idEmpresa);
}

module.exports = {
  obtenerComprasPorProveedor,
  obtenerInventarioResumen,
  obtenerClientesRentabilidad,
  obtenerCarteraCreditos,
};

