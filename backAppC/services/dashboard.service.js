const DashboardRepository = require("../repositories/dashboard.repository");
const gestoresRepository = require("../repositories/gestores.repository");
const cache = require("../cache/redis.client");
const { getFechaHoyLocal } = require("../utils/fechaHoraLocal.util");

function toYmdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseFechaReferenciaLocal(fechaReferencia) {
  const raw = String(fechaReferencia || getFechaHoyLocal()).trim().slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return hoy;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

/**
 * Calcula fecha inicio y fin para el período y el período anterior (mismo tamaño).
 * @param {string} periodo - 'Hoy' | 'Esta Semana' | 'Este Mes' | 'Este Año'
 * @param {string} [fechaReferencia] - YYYY-MM-DD en zona del cliente (navegador)
 * @returns {{ fechaInicio, fechaFin, fechaInicioAnterior, fechaFinAnterior }}
 */
function obtenerRangoFechas(periodo, fechaReferencia) {
  const hoy = parseFechaReferenciaLocal(fechaReferencia);
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

  const toYMD = toYmdLocal;
  return {
    fechaInicio: toYMD(fechaInicio),
    fechaFin: toYMD(fechaFin),
    fechaInicioAnterior: toYMD(fechaInicioAnterior),
    fechaFinAnterior: toYMD(fechaFinAnterior)
  };
}

const PERIODOS_VALIDOS = ["Hoy", "Esta Semana", "Este Mes", "Este Año"];

function normalizarPeriodo(periodo) {
  const p = (periodo || "Este Mes").toString().trim();
  const match = PERIODOS_VALIDOS.find(
    (v) => v.toLowerCase() === p.toLowerCase()
  );
  return match || "Este Mes";
}

exports.obtenerResumenDashboardService = async (pool, user, periodo, fechaReferencia) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const idEmpresa = user.empresa;
  const periodoNorm = normalizarPeriodo(periodo);
  const fechaRef = String(fechaReferencia || getFechaHoyLocal()).trim().slice(0, 10);
  const cacheKey = `dashboard:resumen:${idEmpresa}:${periodoNorm}:${fechaRef}`;
  const ttlRaw = parseInt(process.env.REDIS_DASHBOARD_TTL_SECONDS || "180", 10);
  const ttlSeconds = Number.isNaN(ttlRaw) ? 180 : Math.max(60, ttlRaw);

  const fetchDashboard = async () => {
    const { fechaInicio, fechaFin, fechaInicioAnterior, fechaFinAnterior } =
      obtenerRangoFechas(periodoNorm, fechaRef);
    const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(
      pool,
      idEmpresa
    );
    const getConfig = (clave, def) =>
      configRows.find((c) => c.clave === clave)?.valor ?? def;
    const configInventario = {
      stockMinimoGeneral: Math.max(
        0,
        parseInt(getConfig("INVENTARIO_ALERTA_STOCK_MINIMO", "10"), 10) || 10
      ),
      stockMaximoGeneral: Math.max(
        0,
        parseInt(getConfig("INVENTARIO_ALERTA_STOCK_MAXIMO", "1000"), 10) ||
          1000
      ),
      controlVencimiento:
        String(getConfig("INVENTARIO_CONTROL_VENCIMIENTO", "true")).toLowerCase() ===
        "true"
    };
    return DashboardRepository.obtenerResumenDashboardRepo(
      pool,
      idEmpresa,
      fechaInicio,
      fechaFin,
      fechaInicioAnterior,
      fechaFinAnterior,
      configInventario,
      fechaRef
    );
  };

  return cache.getCached(cacheKey, fetchDashboard, ttlSeconds);
};

function mergeGraficoVista(a, b) {
  if (!a && !b) return { etiquetas: [], datos: [], leyenda: "" };
  const left = a || { etiquetas: [], datos: [], leyenda: "" };
  const right = b || { etiquetas: [], datos: [], leyenda: "" };
  const len = Math.max((left.datos || []).length, (right.datos || []).length);
  const datos = [];
  for (let i = 0; i < len; i++) {
    datos.push(Number(left.datos[i] || 0) + Number(right.datos[i] || 0));
  }
  return {
    etiquetas: (left.etiquetas && left.etiquetas.length >= (right.etiquetas || []).length)
      ? [...left.etiquetas]
      : [...(right.etiquetas || [])],
    datos,
    leyenda: left.leyenda || right.leyenda || ""
  };
}

function mergeGraficoVentas(g1, g2) {
  if (!g1) return g2 ? JSON.parse(JSON.stringify(g2)) : null;
  if (!g2) return JSON.parse(JSON.stringify(g1));
  return {
    porDiaHora: mergeGraficoVista(g1.porDiaHora, g2.porDiaHora),
    mesPorDia: mergeGraficoVista(g1.mesPorDia, g2.mesPorDia),
    seisMeses: mergeGraficoVista(g1.seisMeses, g2.seisMeses),
    doceMeses: mergeGraficoVista(g1.doceMeses, g2.doceMeses)
  };
}

function mergeResumenDashboard(acumulado, siguiente) {
  if (!siguiente) return acumulado;
  if (!acumulado) return JSON.parse(JSON.stringify(siguiente));
  const wA = Number(acumulado.ventasTotales || 0);
  const wB = Number(siguiente.ventasTotales || 0);
  const w = wA + wB;
  const combVar = (key) => {
    const va = Number(acumulado[key] || 0);
    const vb = Number(siguiente[key] || 0);
    if (w <= 0) return 0;
    return (va * wA + vb * wB) / w;
  };

  const m = { ...acumulado };
  m.ventasTotales = wA + wB;
  m.ingresos = Number(m.ingresos || 0) + Number(siguiente.ingresos || 0);
  m.costos = Number(m.costos || 0) + Number(siguiente.costos || 0);
  m.utilidadBruta = Number(m.utilidadBruta || 0) + Number(siguiente.utilidadBruta || 0);
  m.gastosOperativos = Number(m.gastosOperativos || 0) + Number(siguiente.gastosOperativos || 0);
  m.utilidadNeta = Number(m.utilidadNeta || 0) + Number(siguiente.utilidadNeta || 0);
  m.clientesActivos = Number(m.clientesActivos || 0) + Number(siguiente.clientesActivos || 0);

  m.ventasVariacion = combVar("ventasVariacion");
  m.utilidadVariacion = combVar("utilidadVariacion");
  m.clientesVariacion = combVar("clientesVariacion");

  const vt = Number(m.ventasTotales || 0);
  m.roi = vt > 0 ? (Number(m.utilidadNeta || 0) / vt) * 100 : 0;

  const mapProd = new Map();
  for (const p of m.productosMasVendidos || []) {
    const k = `${p.nombre}||${p.categoria}`;
    mapProd.set(k, { ...p });
  }
  for (const p of siguiente.productosMasVendidos || []) {
    const k = `${p.nombre}||${p.categoria}`;
    const prev = mapProd.get(k) || { nombre: p.nombre, categoria: p.categoria, ventas: 0, monto: 0 };
    prev.ventas = Number(prev.ventas || 0) + Number(p.ventas || 0);
    prev.monto = Number(prev.monto || 0) + Number(p.monto || 0);
    mapProd.set(k, prev);
  }
  m.productosMasVendidos = Array.from(mapProd.values())
    .sort((a, b) => Number(b.monto || 0) - Number(a.monto || 0))
    .slice(0, 5);

  const vmA = m.ventasMensuales || [];
  const vmB = siguiente.ventasMensuales || [];
  const vmLen = Math.max(vmA.length, vmB.length);
  m.ventasMensuales = Array.from({ length: vmLen }, (_, i) =>
    Number(vmA[i] || 0) + Number(vmB[i] || 0)
  );
  m.ventasMensualesLabels = (m.ventasMensualesLabels && m.ventasMensualesLabels.length >= (siguiente.ventasMensualesLabels || []).length)
    ? m.ventasMensualesLabels
    : siguiente.ventasMensualesLabels || m.ventasMensualesLabels;

  m.graficoVentas = mergeGraficoVentas(m.graficoVentas, siguiente.graficoVentas);

  const alertasA = m.alertas || [];
  const alertasB = siguiente.alertas || [];
  m.alertas = [...alertasA, ...alertasB].slice(0, 25);

  return m;
}

async function obtenerResumenUnaEmpresa(pool, idEmpresa, periodoNorm, fechaReferencia) {
  const fechaRef = String(fechaReferencia || getFechaHoyLocal()).trim().slice(0, 10);
  const { fechaInicio, fechaFin, fechaInicioAnterior, fechaFinAnterior } =
    obtenerRangoFechas(periodoNorm, fechaRef);
  const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa);
  const getConfig = (clave, def) => configRows.find((c) => c.clave === clave)?.valor ?? def;
  const configInventario = {
    stockMinimoGeneral: Math.max(
      0,
      parseInt(getConfig("INVENTARIO_ALERTA_STOCK_MINIMO", "10"), 10) || 10
    ),
    stockMaximoGeneral: Math.max(
      0,
      parseInt(getConfig("INVENTARIO_ALERTA_STOCK_MAXIMO", "1000"), 10) || 1000
    ),
    controlVencimiento:
      String(getConfig("INVENTARIO_CONTROL_VENCIMIENTO", "true")).toLowerCase() === "true"
  };
  return DashboardRepository.obtenerResumenDashboardRepo(
    pool,
    idEmpresa,
    fechaInicio,
    fechaFin,
    fechaInicioAnterior,
    fechaFinAnterior,
    configInventario,
    fechaRef
  );
}

/**
 * Dashboard agregado: empresa gestora + cada gestionada. Solo si es gestora activa.
 */
exports.obtenerResumenConsolidadoGestoraService = async (pool, user, periodo, fechaReferencia) => {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
  if (!esGestora) throw new Error("NO_ES_GESTORA");

  const periodoNorm = normalizarPeriodo(periodo);
  const fechaRef = String(fechaReferencia || getFechaHoyLocal()).trim().slice(0, 10);
  const cacheKey = `dashboard:consolidado:${user.empresa}:${periodoNorm}:${fechaRef}`;
  const ttlRaw = parseInt(process.env.REDIS_DASHBOARD_TTL_SECONDS || "180", 10);
  const ttlSeconds = Number.isNaN(ttlRaw) ? 180 : Math.max(60, ttlRaw);

  const fetchConsolidado = async () => {
    const sql = require("mssql");
    const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
    const nombreGestoraRs = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .query(`SELECT razon_Social FROM Empresas WHERE idEmpresa = @idEmpresa`);
    const nombreGestora = nombreGestoraRs.recordset[0]?.razon_Social || "Empresa gestora";

    const filas = [
      { idEmpresa: user.empresa, razonSocial: nombreGestora },
      ...gestionadas.map((g) => ({
        idEmpresa: g.idEmpresa,
        razonSocial: g.razon_Social || g.razonSocial || ""
      }))
    ];

    const porEmpresa = [];
    let consolidado = null;
    for (const row of filas) {
      const resumen = await obtenerResumenUnaEmpresa(pool, row.idEmpresa, periodoNorm, fechaRef);
      porEmpresa.push({
        idEmpresa: row.idEmpresa,
        razonSocial: row.razonSocial,
        resumen
      });
      consolidado = mergeResumenDashboard(consolidado, resumen);
    }
    return { consolidado, porEmpresa };
  };

  return cache.getCached(cacheKey, fetchConsolidado, ttlSeconds);
};
