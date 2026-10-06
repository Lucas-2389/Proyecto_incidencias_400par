const express = require('express');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { logDatabaseFailure } = require('./logging');

function createHealthRouter(healthService, logger = console) {
  const router = express.Router();

  router.get('/', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.status(200).json({ status: 'ok' });
  });

  router.get('/database', async (_request, response) => {
    response.set('Cache-Control', 'no-store');
    const started = performance.now();
    try {
      await healthService.checkDatabase();
      response.status(200).json({ status: 'ok', database: 'connected' });
    } catch (error) {
      const correlationId = randomUUID();
      logDatabaseFailure(logger, {
        correlationId,
        error,
        durationMs: performance.now() - started,
      });
      response.status(503).json({
        status: 'error',
        database: 'unavailable',
        code: 'DATABASE_UNAVAILABLE',
        message: 'Base de datos no disponible',
        correlationId,
      });
    }
  });

  return router;
}

module.exports = { createHealthRouter };
