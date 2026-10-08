const express = require('express');
const { mountFrontend } = require('./frontend');
const { createHealthRouter } = require('./health/router');
const { createV1Router } = require('./http/router');
const { correlationId, errorHandler } = require('./http/errors');
const { noStore, requestLogger } = require('./http/logging');
const { NotificationSender } = require('./notifications/sender');
const { securityHeaders, cors } = require('./http/security');

function createApp(healthService, { logger = console, pool, authConfig, mailbox, evidenceStore, notificationSender = new NotificationSender(), httpConfig = {} } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  // CORS governs API access, not public HTML, scripts or stylesheets.
  app.use('/api', cors(httpConfig.corsOrigins));
  app.use('/api/health', createHealthRouter(healthService, logger));
  app.use('/api/v1', correlationId, noStore, requestLogger(logger), express.json({ limit: '256kb' }), createV1Router({ pool, authConfig, mailbox, evidenceStore, notificationSender }));
  app.use('/api', (req, res) => res.status(404).json({ message: 'Ruta API no encontrada' }));
  if (httpConfig.appEnv === 'production') {
    mountFrontend(app, { logger });
  }
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
