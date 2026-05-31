const AnalisisRepository = require('../repositories/analisis.repository');

exports.obtenerDashboardEjecutivoService = async (pool, user, filtros = {}) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const recordset = await AnalisisRepository.obtenerDashboardEjecutivoRepo(pool, user.empresa, filtros);
  return recordset && recordset.length > 0 ? recordset[0] : null;
};

exports.obtenerBalanceGeneralService = async (pool, user, filtros = {}) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  return AnalisisRepository.obtenerBalanceGeneralRepo(pool, user.empresa, filtros);
};

exports.obtenerEstadoResultadosService = async (pool, user, filtros) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const estadoResultados = await AnalisisRepository.obtenerEstadoResultadosRepo(pool, user.empresa, filtros);
  return estadoResultados;
};

exports.obtenerRatiosFinancierosService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const ratios = await AnalisisRepository.obtenerRatiosFinancierosRepo(pool, user.empresa);
  return ratios;
};

exports.obtenerAnalisisRentabilidadService = async (pool, user, tipo) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const rentabilidad = await AnalisisRepository.obtenerAnalisisRentabilidadRepo(pool, user.empresa, tipo);
  return rentabilidad;
};

exports.obtenerFlujoCajaService = async (pool, user, filtros = {}) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  return AnalisisRepository.obtenerFlujoCajaRepo(pool, user.empresa, filtros);
};

exports.obtenerFlujoCajaSerieService = async (pool, user, filtros = {}) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  return AnalisisRepository.obtenerFlujoCajaSerieRepo(pool, user.empresa, filtros);
};

exports.obtenerEficienciaOperativaService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const eficiencia = await AnalisisRepository.obtenerEficienciaOperativaRepo(pool, user.empresa);
  return eficiencia;
};

exports.obtenerProyeccionVentasService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const proyeccion = await AnalisisRepository.obtenerProyeccionVentasRepo(pool, user.empresa);
  return proyeccion;
};

exports.obtenerPuntoEquilibrioService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const puntoEquilibrio = await AnalisisRepository.obtenerPuntoEquilibrioRepo(pool, user.empresa);
  return puntoEquilibrio;
};

exports.obtenerDiagnosticoFinancieroService = async (pool, user) => {
  if (!user) {
    throw new Error("NO_ACCESS");
  }

  const diagnostico = await AnalisisRepository.obtenerDiagnosticoFinancieroRepo(pool, user.empresa);
  return diagnostico;
};