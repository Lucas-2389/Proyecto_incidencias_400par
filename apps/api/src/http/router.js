const express = require('express');
const { notFound } = require('./errors');

function createV1Router() {
  const router = express.Router();
  router.use(notFound);
  return router;
}

module.exports = { createV1Router };
