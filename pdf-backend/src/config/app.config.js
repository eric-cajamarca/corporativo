const express = require('express');
const helmet = require('helmet');
const { createCorsMiddleware } = require('../utils/corsOptions');

const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(createCorsMiddleware());

  return app;
};

module.exports = { createApp };