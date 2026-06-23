/** Unidad SUNAT ZZ = servicio (sin control de stock). */
export const CODIGO_PRESENTACION_SERVICIO = 'ZZ';

export function esProductoServicio(codigoPresentacion: string | null | undefined): boolean {
  return (
    String(codigoPresentacion || '')
      .trim()
      .toUpperCase() === CODIGO_PRESENTACION_SERVICIO
  );
}
