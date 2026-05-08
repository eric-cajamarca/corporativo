const express = require('express');
const { createCorsMiddleware } = require('../utils/corsOptions');

const createApp = () => {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(createCorsMiddleware());

  return app;
};

module.exports = { createApp };