const express = require('express');
const cors = require('cors');

const createApp = () => {
  const app = express();
  
  app.use(express.json({ limit: '10mb' }));
  app.use(cors({
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  return app;
};

module.exports = { createApp };