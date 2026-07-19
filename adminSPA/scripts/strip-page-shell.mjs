/**
 * Quita <app-sidebar>, <app-topnav> y el <main class="main-content"> envolvente
 * de las pantallas que pasan a vivir dentro de AppShellComponent.
 *
 * Uso: node scripts/strip-page-shell.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'src', 'app', 'components');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function stripHtml(html) {
  let s = html;

  // Bloque @if (!noShell) { sidebar + topnav }
  s = s.replace(
    /@if\s*\(\s*!noShell\s*\)\s*\{\s*<app-sidebar[\s\S]*?<\/app-sidebar>\s*<app-topnav[\s\S]*?<\/app-topnav>\s*\}\s*/gi,
    ''
  );

  // Sidebar standalone (varias líneas / attrs)
  s = s.replace(/<!--\s*Sidebar\s*-->\s*/gi, '');
  s = s.replace(/<app-sidebar\b[^>]*(?:\/>|>[\s\S]*?<\/app-sidebar>)\s*/gi, '');

  // Topnav standalone
  s = s.replace(/<!--\s*Topnav\s*-->\s*/gi, '');
  s = s.replace(/<!--\s*Contenido principal\s*-->\s*/gi, '');
  s = s.replace(/<app-topnav\b[^>]*(?:\/>|>[\s\S]*?<\/app-topnav>)\s*/gi, '');

  // Unwrap <main class="main-content" ...> ... </main> (último cierre típico al final)
  const mainOpen = /<main\b([^>]*)\bclass="([^"]*\bmain-content\b[^"]*)"([^>]*)>/i;
  const m = s.match(mainOpen);
  if (m) {
    const fullOpen = m[0];
    const openIdx = s.indexOf(fullOpen);
    const afterOpen = openIdx + fullOpen.length;
    // Buscar </main> de cierre del shell (último del archivo suele ser el correcto)
    const closeIdx = s.lastIndexOf('</main>');
    if (closeIdx > afterOpen) {
      const inner = s.slice(afterOpen, closeIdx);
      const rest = s.slice(closeIdx + '</main>'.length);
      // Conservar clase ventas-embedded si existía (embeds sin márgenes del shell)
      const classAttr = m[2] || '';
      const embedded = /\bventas-embedded\b/.test(classAttr);
      const wrapOpen = embedded ? '<div class="page-body ventas-embedded">' : '<div class="page-body">';
      s = s.slice(0, openIdx) + wrapOpen + inner + '</div>' + rest;
    }
  }

  return s.replace(/\n{3,}/g, '\n\n').trimStart();
}

function stripTs(ts) {
  let s = ts;
  // Quitar imports de Sidebar/Topnav
  s = s.replace(/import\s*\{\s*SidebarComponent\s*\}\s*from\s*['"][^'"]+['"];\s*\n?/g, '');
  s = s.replace(/import\s*\{\s*TopnavComponent\s*\}\s*from\s*['"][^'"]+['"];\s*\n?/g, '');
  // Quitar de arrays imports: [..., SidebarComponent, ...]
  s = s.replace(/,?\s*SidebarComponent\s*,?/g, (match, offset, str) => {
    // Evitar romper sintaxis: normalizar comas dobles después
    return match.includes(',') ? ',' : '';
  });
  s = s.replace(/,?\s*TopnavComponent\s*,?/g, (match) => (match.includes(',') ? ',' : ''));
  // Limpiar comas dobles / trailing en imports arrays
  s = s.replace(/\[\s*,/g, '[');
  s = s.replace(/,\s*,/g, ',');
  s = s.replace(/,\s*\]/g, ']');

  // Quitar onSidebarToggle vacío si solo delegaba al state (opcional, dejar si tiene más lógica)
  return s;
}

const htmlFiles = walk(root).filter((f) => {
  const t = fs.readFileSync(f, 'utf8');
  return t.includes('<app-sidebar') || t.includes('<app-topnav');
});

let nHtml = 0;
let nTs = 0;
for (const htmlPath of htmlFiles) {
  const before = fs.readFileSync(htmlPath, 'utf8');
  const after = stripHtml(before);
  if (after !== before) {
    fs.writeFileSync(htmlPath, after.endsWith('\n') ? after : after + '\n', 'utf8');
    nHtml++;
  }
  const tsPath = htmlPath.replace(/\.html$/, '.ts');
  if (fs.existsSync(tsPath)) {
    const tb = fs.readFileSync(tsPath, 'utf8');
    if (tb.includes('SidebarComponent') || tb.includes('TopnavComponent')) {
      const ta = stripTs(tb);
      if (ta !== tb) {
        fs.writeFileSync(tsPath, ta, 'utf8');
        nTs++;
      }
    }
  }
}

console.log(`HTML actualizados: ${nHtml}; TS actualizados: ${nTs}`);
