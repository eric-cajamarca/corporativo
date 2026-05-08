/**
 * Tras `ng build --configuration=production`, sustituye URLs absolutas localhost
 * que pudieran quedar en chunks (código legacy / dependencias).
 * Salida: dist/admin-spa/browser (ver angular.json).
 *
 * Uso: node scripts/patch-lan-bundle.js
 * O: npm run build:lan
 */
const fs = require('fs');
const path = require('path');

const browserDir = path.join(__dirname, '..', 'dist', 'admin-spa', 'browser');

const REPLACEMENTS = [
  [/http:\/\/localhost:3002\/api\/reports/g, '/api/reports'],
  [/http:\/\/127\.0\.0\.1:3002\/api\/reports/g, '/api/reports'],
  [/http:\/\/localhost:3000\/api\//g, '/api/'],
  [/http:\/\/127\.0\.0\.1:3000\/api\//g, '/api/'],
  [/http:\/\/localhost:9000/g, ''],
  [/http:\/\/127\.0\.0\.1:9000/g, '']
];

function patchFile(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  const before = s;
  for (const [re, to] of REPLACEMENTS) {
    s = s.replace(re, to);
  }
  if (s !== before) {
    fs.writeFileSync(filePath, s, 'utf8');
    console.error('patch-lan-bundle:', path.relative(browserDir, filePath));
  }
}

function main() {
  if (!fs.existsSync(browserDir)) {
    console.error('context:', `No existe ${browserDir}. Ejecute primero: ng build --configuration=production`);
    process.exit(1);
  }
  const files = fs.readdirSync(browserDir);
  for (const name of files) {
    if (!name.endsWith('.js')) continue;
    patchFile(path.join(browserDir, name));
  }
  console.error('patch-lan-bundle: listo.');
}

main();
