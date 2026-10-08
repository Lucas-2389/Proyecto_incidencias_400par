const express = require('express');
const { createHash } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireText } = require('../http/validation');
const { requireAuthentication, requireRoles, requireIncidentScope, hasInstitutionScope } = require('../auth/authorization');
const { createRateLimit } = require('../auth/rate-limit');
const { createReport, requestKey } = require('./report');
const { listMine, incidentDetail } = require('./queries');

function createIncidentsRouter(pool, authConfig, notificationSender = null) {
  const router = express.Router();
  const authenticate = requireAuthentication(pool, authConfig);
  const guestLimit = createRateLimit(pool, 'guest_report', { limit: 10 });
  router.post('/', (req, res, next) => {
    if (req.get('authorization')) return authenticate(req, res, next);
    next();
  }, (req, res, next) => {
    if (req.auth) {
      if (!req.auth.roles.has('Ciudadano')) return next(new HttpError(403, 'FORBIDDEN', 'Acceso no permitido'));
      return next();
    }
    return guestLimit(req, res, next);
  }, async (req, res) => {
    const key = requestKey(req.get('Idempotency-Key'), req.body);
    const scopeType = req.auth ? 'user' : 'guest';
    const scopeId = req.auth?.user.id || createHash('sha256').update(req.ip || 'unknown').digest('hex');
    const result = await createReport(pool, req.body, {
      source: 'MOBILE_APP', reporterUserId: req.auth?.user.id || null,
      scopeType, scopeId, key, locationRequired: true, notificationSender,
    });
    res.status(result.repeated ? 200 : 201).json(result.receipt);
  });
  router.get('/mine', authenticate, requireRoles('Ciudadano'), async (req, res) => {
    res.json(await listMine(pool, req.auth.user.id, req.query));
  });
  router.get('/:id', authenticate, requireIncidentScope(pool), async (req, res) => {
    res.json(await incidentDetail(pool, req.params.id, req.auth));
  });
  return router;
}

function createPhoneReportRouter(pool, authConfig, notificationSender = null) {
  const router = express.Router();
  router.post('/phone', requireAuthentication(pool, authConfig),
    requireRoles('Operador', 'SuperAdministrador'), async (req, res) => {
      const institutionId = requireText(req.body?.institutionId, 'institutionId', { max: 36 });
      const siteId = requireText(req.body?.siteId, 'siteId', { max: 36 });
      if (!hasInstitutionScope(req.auth, institutionId, siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
      const [[site]] = await pool.execute('SELECT id FROM sites WHERE id = ? AND institution_id = ? AND active = TRUE', [siteId, institutionId]);
      if (!site) throw new HttpError(422, 'VALIDATION_ERROR', 'Sede inválida');
      const key = requestKey(req.get('Idempotency-Key'), req.body);
      const result = await createReport(pool, req.body, {
        source: 'PHONE', creatorUserId: req.auth.user.id,
        scopeType: 'operator', scopeId: req.auth.user.id, key, locationRequired: false, notificationSender,
      });
      res.status(result.repeated ? 200 : 201).json(result.receipt);
    });
  return router;
}

module.exports = { createIncidentsRouter, createPhoneReportRouter };
