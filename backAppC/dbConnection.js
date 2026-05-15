// dbConnection.js
const sql = require('mssql');
const dbConfig = require('./dbconfig');

async function connectDB() {
  try {
    await sql.connect(dbConfig);
    const r = await sql.query`SELECT DB_NAME() AS dbName, @@SERVERNAME AS serverName`;
    const row = r.recordset[0] || {};
    console.error('context: conexión MSSQL activa', {
      dbName: row.dbName,
      serverName: row.serverName,
      envServer: dbConfig.server,
      envDatabase: dbConfig.database
    });
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
  }
}

module.exports = { connectDB, sql };
