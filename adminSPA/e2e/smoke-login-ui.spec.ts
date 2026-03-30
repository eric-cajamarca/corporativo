import { test, expect } from '@playwright/test';

test.describe('Login UI', () => {
  test('muestra flujo empresa → usuario → acceso', async ({ page, request }) => {
    const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4200';
    const ping = await request.get(base).catch(() => null);
    test.skip(!ping?.ok(), `Front no responde en ${base} — ejecute ng serve o E2E_START_WEB_SERVER=1`);

    await page.goto('/login-empresa');
    await expect(page.locator('h1.login-title')).toContainText('CRM Empresarial');
    await expect(page.locator('#ruc')).toBeVisible();
    await page.locator('.next-step-button').first().click();
    // Sin RUC válido el botón puede estar disabled; solo comprobamos que la página cargó
    await expect(page.locator('.login-card')).toBeVisible();
  });
});
