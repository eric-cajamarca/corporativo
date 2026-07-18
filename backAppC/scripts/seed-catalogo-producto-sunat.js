/**
 * Seed CatProductoSunatAnexo desde CSV.
 * Uso: node scripts/seed-catalogo-producto-sunat.js
 * Requiere .env con conexión SQL (igual que la app).
 */
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function parseCsv(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(/^([^,]+),([^,]+),"(.*)","(.*)"$/);
    if (m) {
      rows.push({
        anexo: m[1].trim(),
        codigo: m[2].trim(),
        descripcion: m[3].replace(/""/g, '"').trim(),
        partida: m[4].replace(/""/g, '"').trim()
      });
      continue;
    }
    const parts = [];
    let cur = '';
    let inQ = false;
    for (let c = 0; c < lines[i].length; c++) {
      const ch = lines[i][c];
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === ',' && !inQ) {
        parts.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    parts.push(cur);
    if (parts.length >= 3) {
      rows.push({
        anexo: String(parts[0] || '').trim(),
        codigo: String(parts[1] || '').trim(),
        descripcion: String(parts[2] || '').trim(),
        partida: String(parts[3] || '').trim()
      });
    }
  }
  return rows;
}

async function main() {
  const csvPath = path.join(__dirname, '..', 'data', 'catalogo_producto_sunat_anexos.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error('No existe ' + csvPath);
  }
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  if (!rows.length) throw new Error('CSV vacío');

  const dbConfig = require('../dbconfig');
  const pool = await sql.connect(dbConfig);
  let upserts = 0;
  for (const r of rows) {
    if (!/^\d{8}$/.test(r.codigo) || !['25.1', '25.2', '25.3'].includes(r.anexo)) {
      console.error('Fila inválida omitida:', r);
      continue;
    }
    await pool
      .request()
      .input('codigo', sql.Char(8), r.codigo)
      .input('anexo', sql.VarChar(5), r.anexo)
      .input('descripcion', sql.VarChar(500), r.descripcion.slice(0, 500))
      .input('partida', sql.VarChar(300), r.partida ? r.partida.slice(0, 300) : null)
      .query(`
        MERGE CatProductoSunatAnexo AS t
        USING (SELECT @codigo AS codigo, @anexo AS anexo) AS s
          ON t.codigo = s.codigo AND t.anexo = s.anexo
        WHEN MATCHED THEN
          UPDATE SET descripcion = @descripcion, partidaArancelaria = @partida, activo = 1
        WHEN NOT MATCHED THEN
          INSERT (codigo, anexo, descripcion, partidaArancelaria, activo)
          VALUES (@codigo, @anexo, @descripcion, @partida, 1);
      `);
    upserts += 1;
  }
  console.error(`Seed OK: ${upserts} filas en CatProductoSunatAnexo`);
  await pool.close();
}

main().catch((e) => {
  console.error('seed-catalogo-producto-sunat:', e.message || e);
  process.exit(1);
});
