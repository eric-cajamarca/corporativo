require('dotenv').config();
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

(async () => {
  const pool = await sql.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERTIFICATE !== 'false'
    },
    requestTimeout: 60000
  });

  const sqlPath = path.join(__dirname, '..', 'migrations', 'seed_motivos_nota_credito_debito.sql');
  const fullSql = fs.readFileSync(sqlPath, 'utf8');
  // Ejecuta el script completo (idempotente) batch por batch
  const batches = fullSql.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
  for (const batch of batches) {
    await pool.request().batch(batch);
  }

  const r = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM MotivoNotaCredito) AS motivosNc,
      (SELECT COUNT(*) FROM MotivoNotaDebito) AS motivosNd,
      (SELECT COUNT(*) FROM Ventas WHERE idMotivoNotaCredito IS NOT NULL) AS ventasNcVinculadas,
      (SELECT COUNT(*) FROM Ventas WHERE idMotivoNotaDebito IS NOT NULL) AS ventasNdVinculadas
  `);
  console.log(r.recordset[0]);
  await pool.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
