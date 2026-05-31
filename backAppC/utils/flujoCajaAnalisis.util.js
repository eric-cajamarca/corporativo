const CajaRepository = require('../repositories/caja.repository');

const EXCLUIR_CONCEPTOS = new Set(['APERTURA_CAJA']);

function esConceptoExcluido(concepto) {
  return EXCLUIR_CONCEPTOS.has(String(concepto || '').toUpperCase().trim());
}

function normalizarFormaPago(forma) {
  const f = String(forma || 'Sin especificar').trim();
  if (/^efectivo$/i.test(f)) return 'EFECTIVO';
  if (/transfer/i.test(f)) return 'TRANSFERENCIA';
  return f.toUpperCase();
}

/**
 * Construye resumen de flujo de caja a partir del arqueo (sin aperturas de caja).
 */
function construirResumenFlujoCaja(arqueo) {
  const movimientosRaw = (arqueo.movimientos || []).filter(
    (m) => !esConceptoExcluido(m.concepto)
  );

  const conceptosMap = new Map();
  const ingresosMap = new Map();
  const egresosMap = new Map();

  movimientosRaw.forEach((r) => {
    const concepto = String(r.concepto || 'Sin especificar');
    const tipo = String(r.tipoOperacion || 'I').toUpperCase() === 'E' ? 'E' : 'I';
    const formaPago = normalizarFormaPago(r.formaPago);
    const importe = Number(r.importe || 0);

    const keyConcepto = `${concepto}|${tipo}`;
    const prev = conceptosMap.get(keyConcepto) || { tipoOperacion: tipo, importe: 0 };
    prev.importe += importe;
    conceptosMap.set(keyConcepto, prev);

    if (tipo === 'I') {
      ingresosMap.set(formaPago, (ingresosMap.get(formaPago) || 0) + importe);
    } else {
      egresosMap.set(formaPago, (egresosMap.get(formaPago) || 0) + importe);
    }
  });

  const ventasCredito = Number(arqueo.ventasCredito?.importe || 0);
  const cobroCreditos = Number(arqueo.cobroCreditos?.importe || 0);

  const resumenConceptos = Array.from(conceptosMap.entries()).map(([key, val]) => {
    const [concepto] = key.split('|');
    return {
      concepto: concepto.replace(/_/g, ' '),
      tipoOperacion: val.tipoOperacion,
      importe: val.tipoOperacion === 'E' ? -Math.abs(val.importe) : val.importe
    };
  });

  if (ventasCredito > 0) {
    resumenConceptos.push({
      concepto: 'Venta al crédito',
      tipoOperacion: 'I',
      importe: ventasCredito,
      informativo: true
    });
  }
  if (cobroCreditos > 0) {
    resumenConceptos.push({
      concepto: 'Cobro de créditos',
      tipoOperacion: 'I',
      importe: cobroCreditos,
      informativo: true
    });
  }

  const totalIngresosCaja = resumenConceptos
    .filter((c) => c.tipoOperacion === 'I' && !c.informativo)
    .reduce((s, c) => s + Number(c.importe || 0), 0);
  const totalEgresosCaja = resumenConceptos
    .filter((c) => c.tipoOperacion === 'E')
    .reduce((s, c) => s + Math.abs(Number(c.importe || 0)), 0);

  const movimientosIngresos = Array.from(ingresosMap.entries()).map(([formaPago, importe]) => ({
    formaPago,
    importe: Number(importe)
  }));
  const movimientosEgresos = Array.from(egresosMap.entries()).map(([formaPago, importe]) => ({
    formaPago,
    importe: Number(importe)
  }));

  const ingresosEfectivo = movimientosIngresos
    .filter((m) => m.formaPago === 'EFECTIVO')
    .reduce((s, m) => s + m.importe, 0);
  const egresosEfectivo = movimientosEgresos
    .filter((m) => m.formaPago === 'EFECTIVO')
    .reduce((s, m) => s + m.importe, 0);

  const flujoNeto = totalIngresosCaja - totalEgresosCaja;
  const flujoNetoEfectivo = ingresosEfectivo - egresosEfectivo;

  return {
    resumenConceptos,
    movimientosIngresos,
    movimientosEgresos,
    ventasCredito,
    cobroCreditos,
    totalIngresos: totalIngresosCaja,
    totalEgresos: totalEgresosCaja,
    flujoNeto,
    ingresosEfectivo,
    egresosEfectivo,
    flujoNetoEfectivo
  };
}

async function obtenerFlujoCajaPeriodo(pool, idEmpresa, fechaInicio, fechaFin, opciones = {}) {
  const arqueo = await CajaRepository.obtenerArqueoDinamicoRepo(
    pool,
    [idEmpresa],
    {
      fechaInicial: fechaInicio,
      fechaFinal: fechaFin,
      idCaja: opciones.idCaja || 'TODAS'
    },
    null
  );
  return {
    fechaInicio,
    fechaFin,
    ...construirResumenFlujoCaja(arqueo)
  };
}

module.exports = {
  EXCLUIR_CONCEPTOS,
  construirResumenFlujoCaja,
  obtenerFlujoCajaPeriodo
};
