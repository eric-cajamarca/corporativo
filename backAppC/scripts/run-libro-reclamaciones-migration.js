require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const dbConfig = require('../dbconfig');

(async () => {
  const sqlPath = path.join(__dirname, '..', 'migraciones nuevas', '20260718_libro_reclamaciones.sql');
  const text = fs.readFileSync(sqlPath, 'utf8');
  const batches = text
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter(Boolean);

  const pool = await sql.connect(dbConfig);
  for (const batch of batches) {
    await pool.request().query(batch);
  }
  const check = await pool.request().query(
    "SELECT COUNT(*) AS n FROM sys.tables WHERE name = 'LibroReclamaciones'"
  );
  console.log('LibroReclamaciones ok:', check.recordset[0].n === 1);
  await pool.close();
})().catch((e) => {
  console.error('Migracion fallida:', e.message);
  process.exit(1);
});
