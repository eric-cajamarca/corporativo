import { test, expect } from '@playwright/test';

const apiBase = () => (process.env.E2E_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

test.describe('Backend', () => {
  test('GET /health responde ok', async ({ request }) => {
    const res = await request.get(`${apiBase()}/health`);
    expect(res.ok()).toBeTruthy();
    const j = await res.json();
    expect(j).toMatchObject({ status: 'ok', service: 'backAppC' });
  });
});
