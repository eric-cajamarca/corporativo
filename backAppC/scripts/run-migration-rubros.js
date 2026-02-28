/**
 * Ejecuta la migración create_rubros_config_vales_anticipo.sql
 * Uso: node scripts/run-migration-rubros.js
 */
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const dbConfig = require('../dbconfig');

const migrationPath = path.join(__dirname, '../migrations/create_rubros_config_vales_anticipo.sql');

async function run() {
  const content = fs.readFileSync(migrationPath, 'utf8');
  const batches = content
    .split(/\bGO\b/gi)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;
      try {
        await pool.request().query(batch);
        console.log('Batch', i + 1, 'OK');
      } catch (err) {
        console.error('Batch', i + 1, 'Error:', err.message);
        throw err;
      }
    }
    console.log('Migración completada.');
  } finally {
    if (pool) await pool.close();
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
