const fs = require('fs');

let src = fs.readFileSync('src/app/app.routes.ts', 'utf8');

src = src.replace(/^import \{ (\w+) \} from '(\.\/[^']+)';$\n/gm, (line, name) => {
  if (name === 'Routes' || name.endsWith('Guard')) return line;
  return '';
});

src = src.replace(/\n{3,}/g, '\n\n');

fs.writeFileSync('src/app/app.routes.ts', src);
console.log('Removed unused component imports');
