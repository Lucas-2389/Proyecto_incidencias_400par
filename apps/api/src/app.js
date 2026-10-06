const express = require('express');
const { createHealthRouter } = require('./health/router');
const { createV1Router } = require('./http/router');
const { correlationId, errorHandler } = require('./http/errors');
const { noStore, requestLogger } = require('./http/logging');

function createApp(healthService, { logger = console, pool, authConfig, mailbox, evidenceStore } = {}) {
  const app = express();
  app.use('/api/health', createHealthRouter(healthService, logger));
  app.use('/api/v1', correlationId, noStore, requestLogger(logger), express.json({ limit: '256kb' }), createV1Router({ pool, authConfig, mailbox, evidenceStore }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
