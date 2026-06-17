export interface PasoOnboarding {
  id: string;
  orden: number;
  titulo: string;
  descripcion: string;
  completo: boolean;
  ruta: string;
  icono: string;
}

export interface EstadoOnboarding {
  pasosOnboarding?: PasoOnboarding[];
  onboardingProgreso?: number;
  onboardingCompleto?: boolean;
  mostrarOnboarding?: boolean;
  tieneCajas?: boolean;
  tieneCajaAbierta?: boolean;
  tieneVentas?: boolean;
  empresaCompleta?: boolean;
  esGestora?: boolean;
}
