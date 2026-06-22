/** Utilidades de intervalos datetime para hotel (check-in/out + limpieza). */

const DEFAULT_CONFIG = {
  horaCheckIn: '14:00:00',
  horaCheckOut: '11:00:00',
  minutosLimpieza: 30
};

function normalizarHora(hora) {
  const s = String(hora || '14:00:00').trim();
  if (s.length === 5) return `${s}:00`;
  return s.slice(0, 8);
}

function combinarFechaHora(fecha, hora) {
  const d = String(fecha || '').slice(0, 10);
  if (!d || d.length < 10) return null;
  return new Date(`${d}T${normalizarHora(hora)}`);
}

/**
 * Intervalo de una reserva (booking): entrada check-in hora, salida check-out hora + buffer limpieza.
 */
function intervaloDesdeReserva(fechaEntrada, fechaSalida, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const inicio = combinarFechaHora(fechaEntrada, cfg.horaCheckIn);
  const fin = combinarFechaHora(fechaSalida, cfg.horaCheckOut);
  if (!inicio || !fin || fin <= inicio) {
    throw new Error('Rango de fechas de reserva inválido');
  }
  const finConLimpieza = new Date(fin.getTime() + (Number(cfg.minutosLimpieza) || 0) * 60000);
  return { inicio, fin, finConLimpieza };
}

/**
 * Intervalo de estancia activa (check-in real hasta salida prevista + limpieza).
 */
function intervaloDesdeEstancia(checkIn, checkOutPrevisto, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const inicio = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const fin = checkOutPrevisto instanceof Date ? checkOutPrevisto : new Date(checkOutPrevisto);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin <= inicio) {
    throw new Error('Intervalo de estancia inválido');
  }
  const finConLimpieza = new Date(fin.getTime() + (Number(cfg.minutosLimpieza) || 0) * 60000);
  return { inicio, fin, finConLimpieza };
}

/** Dos intervalos [inicio, finConLimpieza) se solapan. */
function intervalosSeSolapan(a, b) {
  return a.inicio < b.finConLimpieza && b.inicio < a.finConLimpieza;
}

function calcularNochesCalendario(fechaEntrada, fechaSalida) {
  const a = new Date(String(fechaEntrada).slice(0, 10));
  const b = new Date(String(fechaSalida).slice(0, 10));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

function checkOutPrevistoDesdeFechaSalida(fechaSalida, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return combinarFechaHora(fechaSalida, cfg.horaCheckOut);
}

/** Intervalo explícito de bloqueo (mantenimiento / fuera de servicio). */
function intervaloDesdeBloqueo(fechaDesde, fechaHasta) {
  const inicio = fechaDesde instanceof Date ? fechaDesde : new Date(fechaDesde);
  const fin = fechaHasta instanceof Date ? fechaHasta : new Date(fechaHasta);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin <= inicio) {
    throw new Error('Rango de bloqueo inválido');
  }
  return { inicio, fin, finConLimpieza: fin };
}

module.exports = {
  DEFAULT_CONFIG,
  normalizarHora,
  combinarFechaHora,
  intervaloDesdeReserva,
  intervaloDesdeEstancia,
  intervaloDesdeBloqueo,
  intervalosSeSolapan,
  calcularNochesCalendario,
  checkOutPrevistoDesdeFechaSalida
};
