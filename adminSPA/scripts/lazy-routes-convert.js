const fs = require('fs');

let src = fs.readFileSync('src/app/app.routes.ts', 'utf8');

const importRe = /^import \{ (\w+) \} from '(\.\/[^']+)';$/gm;
const componentImports = new Map();
let m;
while ((m = importRe.exec(src)) !== null) {
  const name = m[1];
  if (name === 'Routes' || name.endsWith('Guard')) continue;
  componentImports.set(name, m[2]);
}

// Remove component import lines only
src = src.replace(/^import \{ (\w+) \} from '(\.\/[^']+)';$\n/gm, (line, name) => {
  if (name === 'Routes' || name.endsWith('Guard')) return line;
  return '';
});

for (const [name, imp] of componentImports) {
  const re = new RegExp('component: ' + name + '\\b', 'g');
  src = src.replace(
    re,
    `loadComponent: () => import('${imp}').then((m) => m.${name})`
  );
}

// Collapse excessive blank lines
src = src.replace(/\n{3,}/g, '\n\n');

fs.writeFileSync('src/app/app.routes.ts', src);
console.log('Converted', componentImports.size, 'components to lazy loadComponent');
