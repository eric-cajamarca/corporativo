/**
 * Envuelve rutas con AuthGuard dentro de AppShellComponent.
 * Uso: node scripts/wrap-routes-shell.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesPath = path.join(__dirname, '..', 'src', 'app', 'app.routes.ts');
let src = fs.readFileSync(routesPath, 'utf8');

if (src.includes('AppShellComponent') || src.includes('layouts/app-shell')) {
  console.log('Ya envuelto; no se modifica.');
  process.exit(0);
}

const marker = 'export const routes: Routes = [';
const start = src.indexOf(marker);
if (start < 0) throw new Error('No se encontró export const routes');
const arrStart = start + marker.length;

// Encontrar el cierre del array de rutas (último ]; del archivo a nivel export)
let i = arrStart;
let depth = 1;
let inStr = null;
let inLineComment = false;
let inBlockComment = false;
for (; i < src.length; i++) {
  const c = src[i];
  const n = src[i + 1];
  if (inLineComment) {
    if (c === '\n') inLineComment = false;
    continue;
  }
  if (inBlockComment) {
    if (c === '*' && n === '/') {
      inBlockComment = false;
      i++;
    }
    continue;
  }
  if (inStr) {
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === inStr) inStr = null;
    continue;
  }
  if (c === '/' && n === '/') {
    inLineComment = true;
    i++;
    continue;
  }
  if (c === '/' && n === '*') {
    inBlockComment = true;
    i++;
    continue;
  }
  if (c === "'" || c === '"' || c === '`') {
    inStr = c;
    continue;
  }
  if (c === '[') depth++;
  if (c === ']') {
    depth--;
    if (depth === 0) break;
  }
}

const before = src.slice(0, arrStart);
const body = src.slice(arrStart, i);
const after = src.slice(i); // starts with ]

// Separar rutas públicas vs autenticadas por presencia de AuthGuard en el bloque
// Parseo simple: split por objetos top-level { ... },
const items = [];
let buf = '';
depth = 0;
inStr = null;
inLineComment = false;
inBlockComment = false;
for (let j = 0; j < body.length; j++) {
  const c = body[j];
  const n = body[j + 1];
  buf += c;
  if (inLineComment) {
    if (c === '\n') inLineComment = false;
    continue;
  }
  if (inBlockComment) {
    if (c === '*' && n === '/') {
      inBlockComment = false;
      buf += n;
      j++;
    }
    continue;
  }
  if (inStr) {
    if (c === '\\') {
      buf += n;
      j++;
      continue;
    }
    if (c === inStr) inStr = null;
    continue;
  }
  if (c === '/' && n === '/') {
    inLineComment = true;
    buf += n;
    j++;
    continue;
  }
  if (c === '/' && n === '*') {
    inBlockComment = true;
    buf += n;
    j++;
    continue;
  }
  if (c === "'" || c === '"' || c === '`') {
    inStr = c;
    continue;
  }
  if (c === '{' || c === '[') depth++;
  if (c === '}' || c === ']') depth--;
  if (c === ',' && depth === 0) {
    items.push(buf.slice(0, -1));
    buf = '';
  }
}
if (buf.trim()) items.push(buf);

const publicPaths = new Set([
  'publico',
  '',
  'politicas/terminos',
  'politicas/privacidad',
  'politicas/devoluciones',
  'politicas/libro-reclamaciones',
  'login-empresa',
  'planes',
  'suscribirse/:planCode',
  'recuperar-password',
  'crear-empresa',
  'verificar-empresa',
  'sidebar'
]);

function pathOf(item) {
  const m = item.match(/path:\s*'([^']*)'/);
  return m ? m[1] : null;
}

const publicItems = [];
const authItems = [];
for (const item of items) {
  const p = pathOf(item);
  const hasAuth = /AuthGuard/.test(item);
  if (p !== null && (publicPaths.has(p) || (!hasAuth && publicPaths.has(p)))) {
    // crear-empresa / verificar / login no tienen AuthGuard
    if (!hasAuth || publicPaths.has(p)) {
      if (hasAuth && !publicPaths.has(p)) {
        authItems.push(item);
      } else {
        publicItems.push(item);
      }
      continue;
    }
  }
  if (hasAuth || (p && !publicPaths.has(p) && p !== 'sidebar')) {
    // Quitar AuthGuard del child (queda en el shell padre); conservar otros guards
    let child = item.replace(/canActivate:\s*\[([^\]]*)\]/, (_, inner) => {
      const parts = inner
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== 'AuthGuard');
      if (!parts.length) return '/* AuthGuard en shell */';
      return `canActivate: [${parts.join(', ')}]`;
    });
    authItems.push(child);
  } else {
    publicItems.push(item);
  }
}

const shellBlock = `
  {
    path: '',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./layouts/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
${authItems.map((x) => x.replace(/^\n+/, '').replace(/\n+$/, '')).join(',\n')}
    ]
  }
`;

const newBody =
  '\n' +
  publicItems.map((x) => x.replace(/^\n+/, '').replace(/\n+$/, '')).join(',\n') +
  ',\n' +
  shellBlock +
  '\n';

const out = before + newBody + after;
fs.writeFileSync(routesPath, out, 'utf8');
console.log(`Públicas: ${publicItems.length}; Auth (shell children): ${authItems.length}`);
