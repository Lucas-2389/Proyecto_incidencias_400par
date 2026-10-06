const express = require('express');
const { notFound } = require('./errors');
const { createAuthRouter } = require('../auth/router');
const { createTerritoryRouter } = require('../territory/router');
const { createInstitutionsRouter } = require('../institutions/router');
const { createSitesRouter } = require('../institutions/sites');
const { createCoverageRouter } = require('../institutions/coverage');
const { createInstitutionalUsersRouter } = require('../institutions/users');
const { createPersonnelRouter } = require('../resources/personnel');
const { createUnitsRouter } = require('../resources/units');
const { createCatalogRouter } = require('../incidents/catalog');
const { createIncidentsRouter, createPhoneReportRouter } = require('../incidents/router');
const { createEvidenceRouter } = require('../incidents/evidence');

function createV1Router({ pool, authConfig, mailbox, evidenceStore } = {}) {
  const router = express.Router();
  if (pool) router.use('/auth', createAuthRouter(pool, authConfig, mailbox));
  if (pool) router.use('/territory', createTerritoryRouter(pool));
  if (pool) router.use('/admin/institutions', createInstitutionsRouter(pool, authConfig));
  if (pool) router.use('/admin/sites', createSitesRouter(pool, authConfig));
  if (pool) router.use('/admin/coverage', createCoverageRouter(pool, authConfig));
  if (pool) router.use('/admin/users', createInstitutionalUsersRouter(pool, authConfig));
  if (pool) router.use('/resources/personnel', createPersonnelRouter(pool, authConfig));
  if (pool) router.use('/resources/units', createUnitsRouter(pool, authConfig));
  if (pool) router.use('/catalog', createCatalogRouter(pool, authConfig));
  if (pool) router.use('/incidents', createIncidentsRouter(pool, authConfig, evidenceStore));
  if (pool) router.use('/incidents', createEvidenceRouter(pool, authConfig, evidenceStore));
  if (pool) router.use('/ops/incidents', createPhoneReportRouter(pool, authConfig));
  router.use(notFound);
  return router;
}

module.exports = { createV1Router };
