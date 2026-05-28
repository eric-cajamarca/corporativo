/**
 * Diagnostico rapido: config del bot y conversaciones escaladas/bloqueadas.
 * Uso: node scripts/diagnostico-whatsapp-bot.js <idEmpresa> [telefonoCliente]
 */
require('dotenv').config();
const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');

async function main() {
  const idEmpresa = process.argv[2];
  const tel = (process.argv[3] || '').replace(/\D/g, '');
  if (!idEmpresa) {
    console.error('Uso: node scripts/diagnostico-whatsapp-bot.js <idEmpresa> [telefonoCliente]');
    process.exit(1);
  }

  await withPool(async (pool) => {

  const cfg = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT activoBot, humanizar, escalamientoActivo, numeroEscalamiento,
             escalamientoTimeoutMin, umbralNoEntiendoEscalar,
             CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion
      FROM WhatsAppBotConfig WHERE idEmpresa = @idEmpresa
    `);
  console.log('\n--- WhatsAppBotConfig ---');
  console.log(cfg.recordset[0] || '(sin fila)');

  const wa = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT activo, proveedor, estadoSesion, telefonoVinculado
      FROM EmpresaWhatsApp WHERE idEmpresa = @idEmpresa
    `);
  console.log('\n--- EmpresaWhatsApp ---');
  console.log(wa.recordset[0] || '(sin fila)');

  const escaladas = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT telefonoCliente, estado, slotsJson,
             CONVERT(VARCHAR(19), fExpira, 120) AS fExpira
      FROM WhatsAppBotConversacion
      WHERE idEmpresa = @idEmpresa
        AND (estado = 'escalada' OR estado = 'ofreciendo_agente' OR slotsJson LIKE '%escalada%')
      ORDER BY fActualizacion DESC
    `);
  console.log('\n--- Conversaciones escaladas / ofreciendo agente ---');
  if (!escaladas.recordset.length) {
    console.log('(ninguna)');
  } else {
    for (const r of escaladas.recordset) {
      console.log({
        telefonoCliente: r.telefonoCliente,
        estado: r.estado,
        fExpira: r.fExpira,
        slotsJson: r.slotsJson?.slice(0, 200)
      });
    }
  }

  if (tel) {
    const conv = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('tel', sql.VarChar(20), tel)
      .query(`
        SELECT estado, slotsJson, CONVERT(VARCHAR(19), fExpira, 120) AS fExpira
        FROM WhatsAppBotConversacion
        WHERE idEmpresa = @idEmpresa AND telefonoCliente = @tel
      `);
    console.log(`\n--- Conversacion ${tel} ---`);
    console.log(conv.recordset[0] || '(sin fila activa)');
  }

  console.log('\nListo.\n');
  });
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
