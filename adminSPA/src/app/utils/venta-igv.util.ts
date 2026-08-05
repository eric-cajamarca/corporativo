/** Redondeo a 2 decimales (montos fiscales). */
export function redondear2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function esImpuestoIgv(descripcion: string | null | undefined): boolean {
  return (descripcion || '').toUpperCase().includes('IGV');
}

/**
 * Calcula monto IGV sobre el neto de la venta.
 * - precioIncluyeIgv=false: neto es base → IGV = neto × pct/100
 * - precioIncluyeIgv=true: neto es precio final → IGV = neto × pct/(100+pct)
 */
export function calcularMontoIgv(
  neto: number,
  porcentaje: number,
  precioIncluyeIgv: boolean
): number {
  const n = Number(neto) || 0;
  const pct = Number(porcentaje) || 0;
  if (n <= 0 || pct <= 0) return 0;
  if (precioIncluyeIgv) {
    return redondear2((n * pct) / (100 + pct));
  }
  return redondear2(n * (pct / 100));
}

export interface LineaCarritoIgv {
  cantidad: number;
  pVenta: number;
}

export interface DetalleMontosIgv {
  subtotal: number;
  total: number;
  igv: boolean;
}

/**
 * Arma subtotal/total/flag IGV por línea para cabecera, XML y BD (igv = BIT afecta).
 */
export function armarDetallesConIgv(
  lineas: LineaCarritoIgv[],
  porcentaje: number,
  precioIncluyeIgv: boolean,
  tieneIgvActivo: boolean
): DetalleMontosIgv[] {
  const pct = Number(porcentaje) || 0;

  if (!tieneIgvActivo || pct <= 0) {
    return lineas.map((l) => {
      const bruto = redondear2((Number(l.cantidad) || 0) * (Number(l.pVenta) || 0));
      return { subtotal: bruto, total: bruto, igv: false };
    });
  }

  if (precioIncluyeIgv) {
    const brutos = lineas.map((l) =>
      redondear2((Number(l.cantidad) || 0) * (Number(l.pVenta) || 0))
    );
    const sumBrutos = redondear2(brutos.reduce((a, b) => a + b, 0));
    const igvEsperado = calcularMontoIgv(sumBrutos, pct, true);
    const baseEsperada = redondear2(sumBrutos - igvEsperado);
    const bases = brutos.map((b) => redondear2((b * 100) / (100 + pct)));
    const sumBases = redondear2(bases.reduce((a, b) => a + b, 0));
    const diff = redondear2(baseEsperada - sumBases);
    if (bases.length && Math.abs(diff) >= 0.005) {
      bases[bases.length - 1] = redondear2(bases[bases.length - 1] + diff);
    }
    return brutos.map((bruto, i) => ({
      subtotal: bases[i],
      total: bruto,
      igv: true
    }));
  }

  const bases = lineas.map((l) =>
    redondear2((Number(l.cantidad) || 0) * (Number(l.pVenta) || 0))
  );
  const sumBases = redondear2(bases.reduce((a, b) => a + b, 0));
  const igvCab = calcularMontoIgv(sumBases, pct, false);
  const igvLines = bases.map((b) => redondear2(b * (pct / 100)));
  const sumIgv = redondear2(igvLines.reduce((a, b) => a + b, 0));
  const diff = redondear2(igvCab - sumIgv);
  if (igvLines.length && Math.abs(diff) >= 0.005) {
    igvLines[igvLines.length - 1] = redondear2(igvLines[igvLines.length - 1] + diff);
  }
  return bases.map((base, i) => ({
    subtotal: base,
    total: redondear2(base + igvLines[i]),
    igv: true
  }));
}
