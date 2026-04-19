/**
 * Migra un controlador: const|let pool = await sql.connect(dbConfig) → await withPool(async (pool) => …)
 * Conserva líneas entre connect y el primer await del servicio.
 * Uso: node tools/wrapControllerPools.mjs controllers/empresasController.js
 *
 * IMPORTANTE: solo es seguro si cada `const pool = await sql.connect` va seguido de
 * exactamente UNA llamada async que usa ese pool antes de cualquier otro uso de `pool`
 * (p. ej. facturacionController). Si en el mismo try hay varios `await …(pool, …)` con
 * un solo connect, este script rompe el archivo (admin_login, empresas, etc.).
 * Comprueba con pruebas manuales o refactoriza a un único withPool por try.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatchingClose(str, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    const c = str[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function wrapAwaitServiceCall(stmt, callee, poolVar) {
  const reAwaitCallee = new RegExp(`await\\s+${escapeRegExp(callee)}\\(`);
  const am = reAwaitCallee.exec(stmt);
  if (!am) {
    throw new Error(`await ${callee}( not found in statement`);
  }
  const openParenIdx = am.index + am[0].length - 1;
  const closeParenIdx = findMatchingClose(stmt, openParenIdx);
  if (closeParenIdx < 0) throw new Error('unbalanced parens in statement');
  const insertAt = am.index + 'await '.length;
  const inner = stmt.slice(openParenIdx + 1, closeParenIdx);
  const head = stmt.slice(0, insertAt);
  const tail = stmt.slice(closeParenIdx + 1);
  return `${head}withPool(async (${poolVar}) => ${callee}(${inner}))${tail}`;
}

function ensureWithPoolImport(s) {
  if (s.includes("require('../utils/dbPool.util')") || s.includes('require("../utils/dbPool.util")')) {
    return s;
  }
  const line = "const { withPool } = require('../utils/dbPool.util');\n";
  const a = /^const sql = require\('mssql'\);\r?\nconst dbConfig = require\('\.\.\/dbconfig'\);\r?\n/m;
  const b = /^const dbConfig = require\('\.\.\/dbconfig'\);\r?\nconst sql = require\('mssql'\);\r?\n/m;
  if (a.test(s)) return s.replace(a, line);
  if (b.test(s)) return s.replace(b, line);
  const c = /^const sql = require\('mssql'\);\r?\n/m;
  if (c.test(s)) return s.replace(c, line);
  const d = /^const dbConfig = require\('\.\.\/dbconfig'\);\r?\n/m;
  if (d.test(s)) return s.replace(d, line);
  return line + s;
}

function cleanupMssqlImport(s) {
  s = s.replace(/^const dbConfig = require\('\.\.\/dbconfig'\);\r?\n/m, '');
  const needsSqlModule = /\bsql\.(?!connect\b)/.test(s);
  if (!needsSqlModule) {
    s = s.replace(/^const sql = require\('mssql'\);\r?\n/m, '');
  }
  return s;
}

function migrateControllerSource(s) {
  let out = ensureWithPoolImport(s);

  const poolLineRe = /[ \t]*(?:const|let)\s+(pool\w*)\s*=\s*await\s+sql\.connect\(dbConfig\);\s*\r?\n/;

  let guard = 0;
  while (poolLineRe.test(out)) {
    if (++guard > 500) throw new Error('demasiadas iteraciones');
    const pm = out.match(poolLineRe);
    if (!pm) break;
    const poolVar = pm[1];
    const a = pm.index;
    const b = a + pm[0].length;
    const rest = out.slice(b);
    const callRe = new RegExp(
      `(\\s*)((?:(?:const|let)\\s+(?:\\{[^}]+\\}|\\w+)\\s*=\\s*)?)await\\s+([\\w.]+)\\(\\s*(?:\\r?\\n\\s*)?${escapeRegExp(
        poolVar
      )}\\s*(,|\\))`,
      'm'
    );
    const m = callRe.exec(rest);
    if (!m) {
      throw new Error(
        `No await con ${poolVar} tras connect, offset ${b}: ${rest.slice(0, 220).replace(/\r/g, '')}`
      );
    }
    const callee = m[3];
    const stmtStart = m.index;
    const reAwaitCallee = new RegExp(`await\\s+${escapeRegExp(callee)}\\(`);
    const am = reAwaitCallee.exec(rest.slice(stmtStart));
    if (!am) throw new Error('internal: callee await');
    const openParenIdx = stmtStart + am.index + am[0].length - 1;
    const closeParenIdx = findMatchingClose(rest, openParenIdx);
    if (closeParenIdx < 0) throw new Error('unbalanced parens');
    let stmtEnd = closeParenIdx + 1;
    if (rest[stmtEnd] === ';') stmtEnd++;
    const stmt = rest.slice(stmtStart, stmtEnd);
    const stmtNew = wrapAwaitServiceCall(stmt, callee, poolVar);
    const betweenPoolAndAwait = rest.slice(0, stmtStart);
    out = out.slice(0, a) + betweenPoolAndAwait + stmtNew + out.slice(b + stmtEnd);
  }

  if (/sql\.connect\(dbConfig\)/.test(out)) {
    throw new Error('Quedaron sql.connect(dbConfig) sin migrar (revisar bloques multi-await o nombres de pool)');
  }
  return cleanupMssqlImport(out);
}

const rel = process.argv[2];
if (!rel) {
  console.error('Uso: node tools/wrapControllerPools.mjs controllers/MiController.js');
  process.exit(1);
}
const filePath = path.isAbsolute(rel) ? rel : path.join(__dirname, '..', rel);
const raw = fs.readFileSync(filePath, 'utf8');
const next = migrateControllerSource(raw);
fs.writeFileSync(filePath, next, 'utf8');
console.log('OK:', rel);
