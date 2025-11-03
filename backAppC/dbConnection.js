// dbConnection.js
const sql = require('mssql');
const dbConfig = require('./dbconfig');

async function connectDB() {
  try {
    await sql.connect(dbConfig);
    console.log('Conexión exitosa a la base de datos');
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
  }
}

module.exports = { connectDB, sql };
