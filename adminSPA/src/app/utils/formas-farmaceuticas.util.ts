/** Formas farmacéuticas (DIGEMID / uso de botica). No son unidades SUNAT. */
export const FORMAS_FARMACEUTICAS = [
  'Tableta',
  'Cápsula',
  'Comprimido',
  'Gragea',
  'Ampolla',
  'Vial',
  'Óvulo',
  'Supositorio',
  'Parche',
  'Inhalador',
  'Jeringa',
  'Gotas',
  'Crema',
  'Pomada',
  'Ungüento',
  'Gel',
  'Solución',
  'Emulsión',
  'Suspensión',
  'Jarabe',
  'Polvo',
  'Sobre',
  'Pote'
] as const;

export function opcionesFormaFarmaceutica(valorActual?: string | null): string[] {
  const actual = String(valorActual || '').trim();
  if (actual && !FORMAS_FARMACEUTICAS.some((f) => f.toLowerCase() === actual.toLowerCase())) {
    return [actual, ...FORMAS_FARMACEUTICAS];
  }
  return [...FORMAS_FARMACEUTICAS];
}
