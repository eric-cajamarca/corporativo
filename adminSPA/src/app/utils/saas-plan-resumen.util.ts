import { PlanCatalogoItem } from '../models/saas-public.model';

/** Formato de límites numéricos (ej. 3 000). */
export function formatLimitePlan(val: number | undefined | null): string {
  const n = Math.floor(Number(val));
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

/** Resumen por límites operativos del plan (catálogo SaaS). */
export function resumirLimitesPlan(plan: PlanCatalogoItem): string[] {
  const lineas: string[] = [];

  const usuarios = formatLimitePlan(plan.maxUsuarios);
  if (usuarios !== '—') {
    lineas.push(`Hasta ${usuarios} usuarios`);
  }

  const sucursales = formatLimitePlan(plan.maxSucursales);
  if (sucursales !== '—') {
    const n = Math.floor(Number(plan.maxSucursales));
    lineas.push(`${sucursales} sucursal${n === 1 ? '' : 'es'}`);
  }

  const comprobantes = formatLimitePlan(plan.maxComprobantesSunatAceptados);
  if (comprobantes !== '—') {
    lineas.push(`${comprobantes} comprobantes SUNAT al mes`);
  }

  const productos = formatLimitePlan(plan.maxProductosActivos);
  if (productos !== '—') {
    lineas.push(`${productos} productos en catálogo`);
  }

  const bot = plan.maxBotConversacionesSimultaneas ?? 0;
  if (bot > 0) {
    lineas.push(`Bot WhatsApp (${formatLimitePlan(bot)} conv. simultáneas)`);
  } else {
    lineas.push('WhatsApp manual ilimitado (sin bot de pedidos)');
  }

  return lineas;
}

/** Una línea compacta para tarjetas pequeñas. */
export function resumenCompactoPlan(plan: PlanCatalogoItem): string {
  return resumirLimitesPlan(plan).slice(0, 3).join(' · ');
}
