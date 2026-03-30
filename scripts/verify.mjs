/**
 * Verificación local/CI: build + unit tests Angular + health del backend (opcional).
 * Uso: node scripts/verify.mjs
 * VERIFY_SKIP_HEALTH=1 — no llama a /health
 * VERIFY_API_URL=http://127.0.0.1:3000 — URL del backAppC
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const adminSPA = path.join(root, 'adminSPA');

function run(title, cmd, args, cwd) {
  console.log(`\n── ${title} ──`);
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env },
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

run('Angular build', 'npx', ['ng', 'build', '--configuration=development'], adminSPA);
run('Angular unit tests (Jest)', 'npx', ['ng', 'test', '--watch=false'], adminSPA);

if (process.env.VERIFY_SKIP_HEALTH === '1') {
  console.log('\nVERIFY_SKIP_HEALTH=1 — se omite GET /health.');
  console.log('verify: OK (build + unit tests)\n');
  process.exit(0);
}

const base = (process.env.VERIFY_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
try {
  const res = await fetch(`${base}/health`);
  if (!res.ok) {
    console.error(`Health falló: HTTP ${res.status}`);
    process.exit(1);
  }
  const j = await res.json();
  console.log('\n── Backend health ──');
  console.log(JSON.stringify(j));
} catch (e) {
  console.error('No se pudo conectar al backend en', base, '-', e.message);
  console.error('Levante backAppC o use VERIFY_SKIP_HEALTH=1');
  process.exit(1);
}

console.log('\nverify: OK\n');
