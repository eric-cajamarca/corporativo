/**
 * Resuelve rangos de fechas para consultas de análisis financiero (APP_TIMEZONE).
 */

const { getFechaHoyApp, partesAhoraApp, partesFechaHoraEnTz, getAppTimezone } = require('./fechaDisplay.util');

function ultimoDiaMes(y, mo) {
  return new Date(y, mo, 0).getDate();
}

function fmt(d) {
  const p = partesFechaHoraEnTz(d, getAppTimezone());
  return `${p.y}-${p.m}-${p.d}`;
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

  let yN = Number(partesAhoraApp().y);
  let mN = Number(partesAhoraApp().m);

  switch (String(periodo || 'MES_ACTUAL').toUpperCase()) {
    case 'MES_ANTERIOR': {
      mN -= 1;
      if (mN < 1) {
        mN = 12;
        yN -= 1;
      }
      const ms = String(mN).padStart(2, '0');
      const p = `${yN}-${ms}`;
      return {
        fechaInicio: `${p}-01`,
        fechaFin: `${p}-${String(ultimoDiaMes(yN, mN)).padStart(2, '0')}`,
        periodoEtiqueta: p
      };
    }
    case 'TRIMESTRE': {
      const trim = Math.floor((mN - 1) / 3);
      const moIni = trim * 3 + 1;
      const moFin = moIni + 2;
      const msIni = String(moIni).padStart(2, '0');
      const msFin = String(moFin).padStart(2, '0');
      return {
        fechaInicio: `${yN}-${msIni}-01`,
        fechaFin: `${yN}-${msFin}-${String(ultimoDiaMes(yN, moFin)).padStart(2, '0')}`,
        periodoEtiqueta: `T${trim + 1}-${yN}`
      };
    }
    case 'ANO_ACTUAL':
      return {
        fechaInicio: `${yN}-01-01`,
        fechaFin: `${yN}-12-31`,
        periodoEtiqueta: String(yN)
      };
    case 'MES_ACTUAL':
    default: {
      const ms = String(mN).padStart(2, '0');
      const p = `${yN}-${ms}`;
      return {
        fechaInicio: `${p}-01`,
        fechaFin: `${p}-${String(ultimoDiaMes(yN, mN)).padStart(2, '0')}`,
        periodoEtiqueta: p
      };
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
