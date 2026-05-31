/**
 * Prueba unitaria (sin BD) de fórmulas KPI financiero operativo.
 * Ejecutar: node backAppC/scripts/test-kpis-financieros-operativo.js
 */
const {
  calcularMargenesYVariaciones,
  periodoARango
} = require('../utils/kpisFinancierosOperativo.util');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const r = calcularMargenesYVariaciones({
  ventasTotales: 10000,
  costoVentas: 6000,
  gastosOperativos: 1500,
  ventasTotalesAnterior: 8000,
  utilidadNetaAnterior: 1000
});

assert(r.ingresos === 10000, 'ingresos');
assert(r.utilidadBruta === 4000, 'utilidadBruta');
assert(r.utilidadNeta === 2500, 'utilidadNeta');
assert(r.gastosOperativos === 1500, 'gastos');
assert(Math.abs(r.margenNeto - 0.25) < 0.0001, 'margenNeto');
assert(Math.abs(r.roiPctVentas - 25) < 0.0001, 'roiPctVentas');
assert(Math.abs(r.ventasVariacion - 25) < 0.0001, 'ventasVariacion');
assert(Math.abs(r.utilidadVariacion - 150) < 0.0001, 'utilidadVariacion');

const { fechaInicio, fechaFin } = periodoARango('2026-05');
assert(fechaInicio === '2026-05-01', 'inicio mayo');
assert(fechaFin === '2026-05-31', 'fin mayo');

console.log('OK test-kpis-financieros-operativo');
