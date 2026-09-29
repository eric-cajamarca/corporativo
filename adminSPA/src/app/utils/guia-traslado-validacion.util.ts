import { getFechaHoyLocal, getHoraLocalAhora } from './fecha-local.util';

/** Placa SUNAT: mayúsculas, sin espacios ni guion (ABC123, no ABC-123). */
export function normalizarPlacaGuia(valor: unknown): string {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function placaGuiaTieneGuion(valor: unknown): boolean {
  return String(valor || '').includes('-');
}

function horaHmm(valor: unknown): string {
  const s = String(valor || '').trim();
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return '';
}

export function validarFechaHoraPlacaTraslado(input: {
  fechaInicioTraslado: string;
  horaInicioTraslado: string;
  placaVehiculo: string;
  placaSecundaria?: string;
}): string | null {
  const hoy = getFechaHoyLocal();
  const fecha = String(input.fechaInicioTraslado || '').trim().slice(0, 10);
  if (!fecha) {
    return 'Indique la fecha de inicio de traslado.';
  }
  if (fecha < hoy) {
    return 'La fecha de inicio de traslado no puede ser anterior al día de emisión.';
  }
  const hora = horaHmm(input.horaInicioTraslado);
  if (fecha === hoy && hora) {
    const ahora = getHoraLocalAhora().slice(0, 5);
    if (hora > ahora) {
      return 'La hora de traslado no puede ser posterior a la hora de emisión.';
    }
  }
  if (placaGuiaTieneGuion(input.placaVehiculo) || placaGuiaTieneGuion(input.placaSecundaria)) {
    return 'La placa no debe incluir guion. Use formato ABC123.';
  }
  const placa = normalizarPlacaGuia(input.placaVehiculo);
  if (!placa) {
    return 'Ingrese la placa del vehículo principal (sin guion).';
  }
  if (placa.length < 5) {
    return 'La placa del vehículo principal es inválida (mínimo 5 caracteres, sin guion).';
  }
  const sec = normalizarPlacaGuia(input.placaSecundaria);
  if (String(input.placaSecundaria || '').trim() && sec.length < 5) {
    return 'La placa secundaria es inválida (sin guion, mínimo 5 caracteres).';
  }
  return null;
}
