/**
 * Parchea controladores: añade `next` a handlers async y reemplaza respuestas 500 genéricas por next(error).
 * Uso: node scripts/patchControllersNextError.js
 */
const fs = require('fs');
const path = require('path');

const files = [
  'cajaController.js',
  'facturacionController.js',
  'comprasController.js',
  'empresasController.js'
];

const root = path.join(__dirname, '..', 'controllers');

for (const name of files) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) {
    console.warn('Omitido (no existe):', p);
    continue;
  }
  let s = fs.readFileSync(p, 'utf8');
  const orig = s;

  s = s.replace(/async \(req, res\) =>/g, 'async (req, res, next) =>');

  // console.error(...); seguido de res.status(500)... (una o varias líneas hasta );)
  s = s.replace(
    /(\n    console\.error\([^)]*\);)\s*\n(\s*)res\.status\(500\)\.(send|json)\(\{[\s\S]*?\}\);/g,
    '$1\n$2return next(error);'
  );

  if (s === orig) {
    console.log('Sin cambios:', name);
    continue;
  }
  fs.writeFileSync(p, s, 'utf8');
  console.log('Parcheado:', name);
}
