const express = require('express');
const { notFound } = require('./errors');
const { createAuthRouter } = require('../auth/router');
const { createTerritoryRouter } = require('../territory/router');
const { createInstitutionsRouter } = require('../institutions/router');
const { createSitesRouter } = require('../institutions/sites');
const { createCoverageRouter } = require('../institutions/coverage');
const { createInstitutionalUsersRouter } = require('../institutions/users');

function createV1Router({ pool, authConfig, mailbox } = {}) {
  const router = express.Router();
  if (pool) router.use('/auth', createAuthRouter(pool, authConfig, mailbox));
  if (pool) router.use('/territory', createTerritoryRouter(pool));
  if (pool) router.use('/admin/institutions', createInstitutionsRouter(pool, authConfig));
  if (pool) router.use('/admin/sites', createSitesRouter(pool, authConfig));
  if (pool) router.use('/admin/coverage', createCoverageRouter(pool, authConfig));
  if (pool) router.use('/admin/users', createInstitutionalUsersRouter(pool, authConfig));
  router.use(notFound);
  return router;
}

module.exports = { createV1Router };
