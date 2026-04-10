const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'controllers', 'empresasController.js');
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/async function \(req, res\)/g, 'async function (req, res, next)');
s = s.replace(
  /res\.status\(500\)\.send\(\{ message: 'No Access' \}\);/g,
  "return res.status(401).send({ message: 'No autorizado' });"
);
s = s.replace(
  /res\.status\(500\)\.send\(\{ message: 'No Autorizado' \}\);/g,
  "return res.status(403).send({ message: 'No autorizado' });"
);
s = s.replace(
  /(\n\s*console\.error\([^;]+;\s*\n\s*)res\.status\(500\)\.(send|json)\([^)]*\);/g,
  '$1return next(error);'
);
fs.writeFileSync(p, s, 'utf8');
// console.log('empresasController parcheado');
