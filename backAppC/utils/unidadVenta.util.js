/**
 * Convierte cantidad comercial (1/4, 1/32) a cantidad de lote (unidad de compra).
 */
function cantidadStockDesdeFactores(cantidadComercial, factorAInterna, factorCompraAInterna) {
  const cant = Number(cantidadComercial) || 0;
  const fV = Number(factorAInterna);
  const fC = Number(factorCompraAInterna);
  if (!Number.isFinite(cant) || cant <= 0) return 0;
  if (!Number.isFinite(fV) || !Number.isFinite(fC) || fV <= 0 || fC <= 0) {
    return cant;
  }
  return Math.round((cant * (fV / fC)) * 1e6) / 1e6;
}

function esNombreGramo(nombre) {
  return /gramo/i.test(String(nombre || ''));
}

/**
 * Gramos (o unidades internas) que tiene 1 envase de compra.
 * Si el tinte tiene filas «28gramos» + «1 gramo» pero el factor del envase quedó en 1,
 * usa el mayor factor de esas filas (el pote completo).
 */
function resolverFactorEnvase(factorCompraAInterna, unidades) {
  const fC = Number(factorCompraAInterna);
  const facts = (unidades || [])
    .map((u) => Number(u.factorAInterna))
    .filter((n) => Number.isFinite(n) && n > 0);
  const maxF = facts.length ? Math.max(...facts) : 0;
  const hayGramo = (unidades || []).some((u) => esNombreGramo(u.nombre));
  if (hayGramo && Number.isFinite(fC) && fC <= 1 && maxF > 1) {
    return maxF;
  }
  if (Number.isFinite(fC) && fC > 0) return fC;
  return maxF > 0 ? maxF : 0;
}

function factorDeUnGramo(unidades) {
  const uno = (unidades || []).find((u) => /^1\s*gramos?$/i.test(String(u.nombre || '').trim()));
  if (uno) {
    const f = Number(uno.factorAInterna);
    return Number.isFinite(f) && f > 0 ? f : 1;
  }
  return 1;
}

function cantidadStockDesdeGramos(gramos, factorCompraAInterna, unidades) {
  const g = Number(gramos) || 0;
  if (g <= 0) return 0;
  const porEnvase = resolverFactorEnvase(factorCompraAInterna, unidades);
  if (!porEnvase) return 0;
  const fGramo = factorDeUnGramo(unidades);
  return Math.round(((g * fGramo) / porEnvase) * 1e6) / 1e6;
}

function formatearCantidad(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return String(valor);
  const r = Math.round(n * 1e4) / 1e4;
  return String(r);
}

module.exports = {
  cantidadStockDesdeFactores,
  resolverFactorEnvase,
  cantidadStockDesdeGramos,
  formatearCantidad
};
