require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const { requireApiKey } = require('./middlewares/auth.middleware');
const sessionController = require('./controllers/session.controller');
const messageController = require('./controllers/message.controller');
const sessionManager = require('./services/sessionManager.service');

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/v1', requireApiKey);

app.post('/v1/tenants/:idEmpresa/session', sessionController.startSession);
app.get('/v1/tenants/:idEmpresa/session/status', sessionController.getStatus);
app.delete('/v1/tenants/:idEmpresa/session', sessionController.logout);
app.post('/v1/tenants/:idEmpresa/messages/text', messageController.sendText);
app.post('/v1/tenants/:idEmpresa/messages/media', messageController.sendMedia);

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.use((err, _req, res, _next) => {
  console.error('whatsapp-gateway unhandled:', err.message);
  res.status(500).json({ status: 500, success: false, message: 'Error interno del gateway' });
});

app.listen(config.port, config.host, () => {
  console.error(`whatsapp-gateway escuchando en ${config.host}:${config.port}`);
  if (!config.apiKey) {
    console.error('whatsapp-gateway: AVISO GATEWAY_API_KEY no configurada; los endpoints /v1 responderan 503.');
  }
  sessionManager.preloadSessions().catch((err) => {
    console.error('whatsapp-gateway preloadSessions:', err.message);
  });
});
