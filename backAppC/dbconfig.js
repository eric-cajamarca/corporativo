// dbConfig.js
require('dotenv').config(); // Cargar variables de entorno desde el archivo .env

/** Tedious: tiempo máximo por request SQL (ms). Default 45s; antes 15s causaba ETIMEOUT en consultas pesadas o red lenta. */
const DB_REQUEST_TIMEOUT_MS = Math.min(
  Math.max(parseInt(process.env.DB_REQUEST_TIMEOUT_MS, 10) || 45000, 5000),
  600000
);

const config = {
    // user: 'fenix',
    // password: '1234',
    // server: '192.168.2.105',
    // database: 'grupoSJB',
    // options: {
    //   encrypt: true, // Si estás usando Azure, debes establecer esto en true
    //   trustServerCertificate: true, // Cambia esto según tus necesidades
    // },
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERTIFICATE === 'true',
      requestTimeout: DB_REQUEST_TIMEOUT_MS,
      connectTimeout: Math.min(
        Math.max(parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 30000, 5000),
        120000
      ),
    },
  };
  
  module.exports = config;
  