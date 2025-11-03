// dbConfig.js
require('dotenv').config(); // Cargar variables de entorno desde el archivo .env

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
    },

    
  };
  
  module.exports = config;
  