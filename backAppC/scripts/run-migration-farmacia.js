/**
 * Ejecuta la migración create_rubro_farmacia.sql
 * Uso: node scripts/run-migration-farmacia.js
 */
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const dbConfig = require('../dbconfig');

const migrationPath = path.join(__dirname, '../migrations/create_rubro_farmacia.sql');

async function run() {
  const content = fs.readFileSync(migrationPath, 'utf8');
  const batches = content
    .split(/\bGO\b/gi)
    .map((s) => s.trim())
    .map((s) => s.replace(/^(?:\s*--[^\n]*\n)+/, '').trim())
    .filter((s) => s.length > 0);
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;
      try {
        await pool.request().query(batch);
      } catch (err) {
        console.error('contexto: migración farmacia batch', i + 1, err);
        throw err;
      }
    }
  } finally {
    if (pool) await pool.close();
  }
}

run().catch((e) => {
  console.error('contexto: run-migration-farmacia', e);
  process.exit(1);
});
