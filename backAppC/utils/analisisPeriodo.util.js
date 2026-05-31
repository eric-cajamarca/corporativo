/**
 * Resuelve rangos de fechas para consultas de análisis financiero.
 */

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function resolverRangoConsultaAnalisis(opciones = {}) {
  const { periodo, fechaDesde, fechaHasta } = opciones;
  if (fechaDesde && fechaHasta) {
    return {
      fechaInicio: String(fechaDesde).slice(0, 10),
      fechaFin: String(fechaHasta).slice(0, 10),
      periodoEtiqueta: `${fechaDesde} — ${fechaHasta}`
    };
  }

  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();

  switch (String(periodo || 'MES_ACTUAL').toUpperCase()) {
    case 'MES_ANTERIOR': {
      const ini = new Date(y, m - 1, 1);
      const fin = new Date(y, m, 0);
      const p = `${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, '0')}`;
      return { fechaInicio: fmt(ini), fechaFin: fmt(fin), periodoEtiqueta: p };
    }
    case 'TRIMESTRE': {
      const trim = Math.floor(m / 3);
      const ini = new Date(y, trim * 3, 1);
      const fin = new Date(y, trim * 3 + 3, 0);
      return {
        fechaInicio: fmt(ini),
        fechaFin: fmt(fin),
        periodoEtiqueta: `T${trim + 1}-${y}`
      };
    }
    case 'ANO_ACTUAL': {
      const ini = new Date(y, 0, 1);
      const fin = new Date(y, 11, 31);
      return {
        fechaInicio: fmt(ini),
        fechaFin: fmt(fin),
        periodoEtiqueta: String(y)
      };
    }
    case 'MES_ACTUAL':
    default: {
      const ini = new Date(y, m, 1);
      const fin = new Date(y, m + 1, 0);
      const p = `${y}-${String(m + 1).padStart(2, '0')}`;
      return { fechaInicio: fmt(ini), fechaFin: fmt(fin), periodoEtiqueta: p };
    }
  }
}

/** Lista períodos YYYY-MM entre dos fechas (inclusive). */
function listarPeriodosMensuales(fechaInicio, fechaFin) {
  const [yi, mi] = fechaInicio.split('-').map(Number);
  const [yf, mf] = fechaFin.split('-').map(Number);
  const periodos = [];
  let y = yi;
  let mo = mi;
  while (y < yf || (y === yf && mo <= mf)) {
    periodos.push(`${y}-${String(mo).padStart(2, '0')}`);
    mo += 1;
    if (mo > 12) {
      mo = 1;
      y += 1;
    }
  }
  return periodos;
}

function rangoPeriodoAnterior(fechaInicio, fechaFin) {
  const ini = new Date(`${fechaInicio}T12:00:00`);
  const fin = new Date(`${fechaFin}T12:00:00`);
  const dias = Math.max(1, Math.round((fin - ini) / 86400000) + 1);
  const finAnt = new Date(ini);
  finAnt.setDate(finAnt.getDate() - 1);
  const iniAnt = new Date(finAnt);
  iniAnt.setDate(iniAnt.getDate() - dias + 1);
  return { fechaInicioAnterior: fmt(iniAnt), fechaFinAnterior: fmt(finAnt) };
}

module.exports = {
  resolverRangoConsultaAnalisis,
  listarPeriodosMensuales,
  rangoPeriodoAnterior
};
