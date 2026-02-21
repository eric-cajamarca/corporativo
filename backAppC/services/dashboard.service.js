const DashboardRepository = require("../repositories/dashboard.repository");
const gestoresRepository = require("../repositories/gestores.repository");

/**
 * Calcula fecha inicio y fin para el período y el período anterior (mismo tamaño).
 * @param {string} periodo - 'Hoy' | 'Esta Semana' | 'Este Mes' | 'Este Año'
 * @returns {{ fechaInicio, fechaFin, fechaInicioAnterior, fechaFinAnterior }}
 */
function obtenerRangoFechas(periodo) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let fechaInicio, fechaFin;

  switch (periodo) {
    case "Hoy":
      fechaInicio = new Date(hoy);
      fechaFin = new Date(hoy);
      fechaFin.setHours(23, 59, 59, 999);
      break;
    case "Esta Semana": {
      const dia = hoy.getDay();
      const diffLunes = dia === 0 ? -6 : 1 - dia;
      fechaInicio = new Date(hoy);
      fechaInicio.setDate(hoy.getDate() + diffLunes);
      fechaFin = new Date(fechaInicio);
      fechaFin.setDate(fechaInicio.getDate() + 6);
      fechaFin.setHours(23, 59, 59, 999);
      break;
    }
    case "Este Mes":
      fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      fechaFin.setHours(23, 59, 59, 999);
      break;
    case "Este Año":
      fechaInicio = new Date(hoy.getFullYear(), 0, 1);
      fechaFin = new Date(hoy.getFullYear(), 11, 31);
      fechaFin.setHours(23, 59, 59, 999);
      break;
    default:
      // Default: Este Mes
      fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      fechaFin.setHours(23, 59, 59, 999);
  }

  const dias = Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1;
  const fechaFinAnterior = new Date(fechaInicio);
  fechaFinAnterior.setDate(fechaFinAnterior.getDate() - 1);
  fechaFinAnterior.setHours(23, 59, 59, 999);
  const fechaInicioAnterior = new Date(fechaFinAnterior);
  fechaInicioAnterior.setDate(fechaInicioAnterior.getDate() - dias + 1);
  fechaInicioAnterior.setHours(0, 0, 0, 0);

  const toYMD = (d) => d.toISOString().split("T")[0];
  return {
    fechaInicio: toYMD(fechaInicio),
    fechaFin: toYMD(fechaFin),
    fechaInicioAnterior: toYMD(fechaInicioAnterior),
    fechaFinAnterior: toYMD(fechaFinAnterior)
  };
}

exports.obtenerResumenDashboardService = async (pool, user, periodo) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const idEmpresa = user.empresa;
  const { fechaInicio, fechaFin, fechaInicioAnterior, fechaFinAnterior } =
    obtenerRangoFechas(periodo || "Este Mes");
  const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa);
  const getConfig = (clave, def) => (configRows.find(c => c.clave === clave)?.valor ?? def);
  const configInventario = {
    stockMinimoGeneral: Math.max(0, parseInt(getConfig("INVENTARIO_ALERTA_STOCK_MINIMO", "10"), 10) || 10),
    stockMaximoGeneral: Math.max(0, parseInt(getConfig("INVENTARIO_ALERTA_STOCK_MAXIMO", "1000"), 10) || 1000),
    controlVencimiento: String(getConfig("INVENTARIO_CONTROL_VENCIMIENTO", "true")).toLowerCase() === "true"
  };
  return DashboardRepository.obtenerResumenDashboardRepo(
    pool,
    idEmpresa,
    fechaInicio,
    fechaFin,
    fechaInicioAnterior,
    fechaFinAnterior,
    configInventario
  );
};
