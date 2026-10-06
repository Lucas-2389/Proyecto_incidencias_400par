const express = require('express');
const { createHealthRouter } = require('./health/router');

function createApp(healthService, { logger = console } = {}) {
  const app = express();
  app.use('/api/health', createHealthRouter(healthService, logger));
  return app;
}

module.exports = { createApp };
