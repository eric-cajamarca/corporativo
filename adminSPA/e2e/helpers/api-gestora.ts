import type { APIRequestContext } from '@playwright/test';

export function apiBase(): string {
  return (process.env.E2E_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
}

export async function postJson(ctx: APIRequestContext, path: string, body: unknown) {
  return ctx.post(`${apiBase()}${path}`, {
    data: body,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getJson(ctx: APIRequestContext, path: string) {
  return ctx.get(`${apiBase()}${path}`);
}

/** Login gestor; lanza si 2FA o error. Las cookies quedan en el contexto `request`. */
export async function loginGestora(ctx: APIRequestContext): Promise<{ idEmpresa: string }> {
  const ruc = process.env.E2E_GESTORA_RUC?.trim();
  const email = process.env.E2E_GESTORA_EMAIL?.trim();
  const password = process.env.E2E_GESTORA_PASSWORD?.trim();
  if (!ruc || !email || !password) {
    throw new Error('Defina E2E_GESTORA_RUC, E2E_GESTORA_EMAIL y E2E_GESTORA_PASSWORD (e2e/.env)');
  }

  const res = await postJson(ctx, '/api/admin_login', { ruc, email, password });
  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Login no JSON: ${res.status()} ${text.slice(0, 200)}`);
  }

  const data = json.data as Record<string, unknown> | undefined;
  if (data?.requiresTwoFactor || data?.requiresTwoFactorSetup) {
    throw new Error(
      'La cuenta tiene 2FA activo o pendiente de configuración. Use un usuario de prueba sin 2FA para E2E.'
    );
  }

  if (!res.ok()) {
    throw new Error(`Login falló: ${res.status()} ${JSON.stringify(json)}`);
  }

  if (!data?.idEmpresa) {
    throw new Error('Login OK pero sin idEmpresa en respuesta');
  }

  return { idEmpresa: String(data.idEmpresa) };
}

export function hoyRangoFechasLima(): { desde: string; hasta: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return {
    desde: `${y}-${m}-${day}T00:00:00`,
    hasta: `${y}-${m}-${day}T23:59:59`,
  };
}

export function esCobroVaConcepto(concepto: unknown): boolean {
  const s = concepto != null ? String(concepto) : '';
  return s.includes('Cobro VA');
}
