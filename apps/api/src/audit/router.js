const express = require('express');
const { HttpError } = require('../http/errors');
const { requireAuthentication, requireRoles } = require('../auth/authorization');

function id(value, name) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) throw new HttpError(422, 'VALIDATION_ERROR', `Filtro inválido: ${name}`);
  return value;
}

function numeric(value, name, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
    throw new HttpError(422, 'VALIDATION_ERROR', `Filtro inválido: ${name}`);
  }
  return Number(value);
}

function stripSecrets(value) {
  if (typeof value === 'string') {
    if (!value.startsWith('{') && !value.startsWith('[')) return value;
    try { return stripSecrets(JSON.parse(value)); } catch { return '[REDACTED]'; }
  }
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key,
        /password|token|secret|credential|callercontact/i.test(key) ? '[REDACTED]' : stripSecrets(item)]));
  }
  return value;
}

function createAuditRouter(pool, authConfig) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional'));
  router.get('/', async (req, res) => {
    const institutionId = id(req.query.institutionId, 'institutionId');
    const siteId = id(req.query.siteId, 'siteId');
    const entityId = req.query.entityId;
    const entityType = req.query.entityType;
    if (entityId !== undefined && (typeof entityId !== 'string' || entityId.length > 64)) throw new HttpError(422, 'VALIDATION_ERROR', 'Entidad inválida');
    if (entityType !== undefined && (typeof entityType !== 'string' || !/^[a-z_]{1,80}$/.test(entityType))) throw new HttpError(422, 'VALIDATION_ERROR', 'Tipo inválido');
    const limit = numeric(req.query.limit, 'limit', 50, 100);
    const offset = numeric(req.query.offset, 'offset', 0, 10000);
    if (!req.auth.roles.has('SuperAdministrador')) {
      const memberships = req.auth.memberships.filter((membership) => membership.role === 'AdministradorInstitucional');
      if (institutionId && !memberships.some((membership) => membership.institution_id === institutionId)) {
        throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
      }
      if (siteId) {
        const [[site]] = await pool.execute('SELECT institution_id AS institutionId FROM sites WHERE id = ?', [siteId]);
        if (!site || !memberships.some((membership) => membership.institution_id === site.institutionId
          && (membership.site_id === null || membership.site_id === siteId))) {
          throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
        }
      }
    }
    const params = [institutionId, institutionId, siteId, siteId, entityType ?? null, entityType ?? null, entityId ?? null, entityId ?? null];
    let scope = '';
    if (!req.auth.roles.has('SuperAdministrador')) {
      const memberships = req.auth.memberships.filter((membership) => membership.role === 'AdministradorInstitucional');
      if (!memberships.length) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
      scope = ` AND (${memberships.map((membership) => {
        params.push(membership.institution_id);
        if (membership.site_id) { params.push(membership.site_id); return '(institution_id = ? AND site_id = ?)'; }
        return '(institution_id = ?)';
      }).join(' OR ')})`;
    }
    const [rows] = await pool.execute(
      `SELECT id, actor_user_id AS actorUserId, institution_id AS institutionId, site_id AS siteId,
        correlation_id AS correlationId, action, entity_type AS entityType, entity_id AS entityId,
        before_data AS beforeData, after_data AS afterData, created_at AS createdAt
       FROM audit_logs WHERE (? IS NULL OR institution_id = ?)
         AND (? IS NULL OR site_id = ?) AND (? IS NULL OR entity_type = ?)
         AND (? IS NULL OR entity_id = ?) ${scope}
       ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset],
    );
    res.json(rows.map((row) => ({ ...row,
      beforeData: stripSecrets(row.beforeData), afterData: stripSecrets(row.afterData),
      createdAt: new Date(row.createdAt).toISOString() })));
  });
  return router;
}

module.exports = { createAuditRouter, stripSecrets };
