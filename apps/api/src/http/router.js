const express = require('express');
const { notFound } = require('./errors');
const { createAuthRouter } = require('../auth/router');

function createV1Router({ pool, authConfig, mailbox } = {}) {
  const router = express.Router();
  if (pool) router.use('/auth', createAuthRouter(pool, authConfig, mailbox));
  router.use(notFound);
  return router;
}

module.exports = { createV1Router };
