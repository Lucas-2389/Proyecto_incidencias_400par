const express = require('express');
const { HttpError } = require('../http/errors');
const { requireAuthentication, requireRoles, hasAdministrativeScope, hasIncidentScope } = require('../auth/authorization');
const { canonicalDistrictId } = require('../territory/router');
const { parseFilters } = require('../geospatial/router');

const entityAliases = {
  incident: ['incident', 'incidents'], institution: ['institution', 'institutions'], site: ['site', 'sites'],
  user: ['user', 'users'], unit: ['unit', 'units'], personnel: ['personnel'],
  directory: ['directory', 'directory_entry'], alert: ['alert', 'alerts'],
  institution_assignment: ['institution_assignment'], authorization: ['authorization'],
};

function recordType(value) {
  return Object.keys(entityAliases).find((type) => entityAliases[type].includes(value)) ?? value;
}

function identifier(value, name) {
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
      [key, /password|token|secret|credential|callercontact/i.test(key) ? '[REDACTED]' : stripSecrets(item)]));
  }
  return value;
}

const effectiveInstitution = "COALESCE(a.institution_id, s.institution_id, CASE WHEN a.entity_type IN ('institution','institutions') THEN a.entity_id END)";
const effectiveSite = 'COALESCE(a.site_id, ia.site_id, s.id)';
const effectiveDistrict = 'COALESCE(a.district_id, il.district_id, s.district_id, de.district_id, al.district_id)';
const joins = `FROM audit_logs a
  LEFT JOIN users actor ON actor.id = a.actor_user_id
  LEFT JOIN institution_assignments ia ON a.entity_type = 'institution_assignment' AND ia.id = a.entity_id
  LEFT JOIN incidents incident ON incident.id = CASE WHEN a.entity_type IN ('incident','incidents') THEN a.entity_id ELSE ia.incident_id END
  LEFT JOIN incident_locations il ON il.incident_id = incident.id
  LEFT JOIN sites s ON s.id = COALESCE(a.site_id, ia.site_id, CASE WHEN a.entity_type IN ('site','sites') THEN a.entity_id END)
  LEFT JOIN institutions institution ON institution.id = ${effectiveInstitution}
  LEFT JOIN directory_entries de ON a.entity_type IN ('directory','directory_entry') AND de.id = a.entity_id
  LEFT JOIN alerts al ON a.entity_type IN ('alert','alerts') AND al.id = a.entity_id
  LEFT JOIN users target_user ON a.entity_type IN ('user','users') AND target_user.id = a.entity_id
  LEFT JOIN units unit ON a.entity_type IN ('unit','units') AND unit.id = a.entity_id
  LEFT JOIN personnel person ON a.entity_type = 'personnel' AND person.id = a.entity_id
  LEFT JOIN district_aliases alias ON alias.legacy_id = ${effectiveDistrict}
  LEFT JOIN districts district ON district.id = COALESCE(alias.district_id, ${effectiveDistrict})`;

function createAuditRouter(pool, authConfig) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional'));
  router.get('/', async (req, res) => {
    const institutionId = identifier(req.query.institutionId, 'institutionId');
    const siteId = identifier(req.query.siteId, 'siteId');
    const districtId = await canonicalDistrictId(pool, req.query.districtId);
    const { entityId, entityType, action, q } = req.query;
    if (entityId !== undefined && (typeof entityId !== 'string' || entityId.length > 64)) throw new HttpError(422, 'VALIDATION_ERROR', 'Entidad inválida');
    if (entityType !== undefined && (typeof entityType !== 'string' || !/^[a-z_]{1,80}$/.test(entityType))) throw new HttpError(422, 'VALIDATION_ERROR', 'Tipo inválido');
    if (action !== undefined && (typeof action !== 'string' || !/^[a-z_.]{1,80}$/.test(action))) throw new HttpError(422, 'VALIDATION_ERROR', 'Acción inválida');
    if (q !== undefined && (typeof q !== 'string' || q.length > 150)) throw new HttpError(422, 'VALIDATION_ERROR', 'Búsqueda inválida');
    const limit = numeric(req.query.limit, 'limit', 50, 100);
    const offset = numeric(req.query.offset, 'offset', 0, 10000);
    const requestedSnapshot = numeric(req.query.snapshotId, 'snapshotId', null, Number.MAX_SAFE_INTEGER);
    const period = req.query.from !== undefined || req.query.to !== undefined ? parseFilters(req.query) : null;
    if (institutionId && !hasAdministrativeScope(req.auth, institutionId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    if (siteId) {
      const [[site]] = await pool.execute('SELECT institution_id AS institutionId FROM sites WHERE id = ?', [siteId]);
      if (!site || !hasAdministrativeScope(req.auth, site.institutionId, siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    }
    const conditions = [];
    const params = [];
    if (!req.auth.roles.has('SuperAdministrador')) {
      const memberships = req.auth.memberships.filter((membership) => membership.role === 'AdministradorInstitucional');
      if (!memberships.length) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
      conditions.push(`(${memberships.map((membership) => {
        params.push(membership.institution_id);
        if (membership.site_id) { params.push(membership.site_id); return `(${effectiveInstitution} = ? AND ${effectiveSite} = ?)`; }
        return `(${effectiveInstitution} = ?)`;
      }).join(' OR ')})`);
    }
    for (const [expression, value] of [[effectiveInstitution, institutionId], [effectiveSite, siteId], ['a.entity_id', entityId]]) {
      if (value != null) { conditions.push(`${expression} = ?`); params.push(value); }
    }
    if (entityType) {
      const types = entityAliases[recordType(entityType)] ?? [entityType];
      conditions.push(`a.entity_type IN (${types.map(() => '?').join(',')})`);
      params.push(...types);
    }
    if (action) {
      const patterns = { create: '\\.(create|post)$', update: '\\.(update|patch)$', deactivate: '\\.(deactivate|delete)$' };
      conditions.push(patterns[action] ? 'a.action REGEXP ?' : 'a.action = ?');
      params.push(patterns[action] ?? action);
    }
    if (period) {
      conditions.push('a.created_at >= ? AND a.created_at < ?');
      params.push(period.from.toISOString().slice(0, 23).replace('T', ' '), period.to.toISOString().slice(0, 23).replace('T', ' '));
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [[maximum]] = await pool.execute(`SELECT MAX(a.id) AS id ${joins} ${where}`, params);
    const snapshotId = requestedSnapshot ?? Number(maximum.id ?? 0);
    const results = [];
    const search = q?.trim().toLocaleLowerCase('es') ?? '';
    const userVisibility = new Map();
    let lastId = snapshotId + 1;
    let more = true;
    while (more && results.length <= offset + limit) {
      const [rows] = await pool.execute(
        `SELECT a.id, a.actor_user_id AS actorUserId, actor.name AS actorName,
          ${effectiveInstitution} AS institutionId, institution.name AS institutionName,
          ${effectiveSite} AS siteId, s.name AS siteName, district.id AS districtId, district.name AS districtName,
          a.district_id AS storedDistrictId, a.correlation_id AS correlationId, a.action,
          a.entity_type AS entityType, a.entity_id AS entityId, a.before_data AS beforeData,
          a.after_data AS afterData, a.created_at AS createdAt, incident.id AS incidentId,
          COALESCE(incident.reference, de.name, al.title, target_user.name, unit.code, person.name,
            CASE WHEN a.entity_type IN ('site','sites') THEN s.name END,
            CASE WHEN a.entity_type IN ('institution','institutions') THEN institution.name END) AS currentEntityName,
          COALESCE(de.institution_id, unit.institution_id, person.institution_id, s.institution_id) AS currentInstitutionId,
          COALESCE(de.site_id, unit.site_id, person.site_id, s.id) AS currentSiteId
         ${joins} ${where}${where ? ' AND' : 'WHERE'} a.id <= ? AND a.id < ? ORDER BY a.id DESC LIMIT 500`, [...params, snapshotId, lastId],
      );
      for (const row of rows) {
        const { currentEntityName, currentInstitutionId, currentSiteId, incidentId, storedDistrictId, ...event } = row;
        const type = recordType(row.entityType);
        event.beforeData = stripSecrets(row.beforeData);
        event.afterData = stripSecrets(row.afterData);
        let objectVisible = req.auth.roles.has('SuperAdministrador') || !currentInstitutionId
          || hasAdministrativeScope(req.auth, currentInstitutionId, currentSiteId);
        if (incidentId) objectVisible = await hasIncidentScope(pool, req.auth, incidentId);
        if (type === 'user' && !req.auth.roles.has('SuperAdministrador')) {
          if (!userVisibility.has(row.entityId)) {
            const [memberships] = await pool.execute('SELECT institution_id, site_id FROM institution_memberships WHERE user_id = ? AND active = TRUE', [row.entityId]);
            userVisibility.set(row.entityId, memberships.some((member) => hasAdministrativeScope(req.auth, member.institution_id, member.site_id)));
          }
          objectVisible = userVisibility.get(row.entityId);
        }
        event.recordType = type;
        event.entityName = event.afterData?.name ?? event.beforeData?.name ?? (objectVisible ? currentEntityName : null);
        event.districtSource = storedDistrictId ? 'event' : 'current_record';
        if (!objectVisible) {
          event.siteName = null;
          if (!storedDistrictId) { event.districtId = null; event.districtName = null; }
        }
        if (districtId && Number(event.districtId) !== districtId) continue;
        event.link = null;
        if (objectVisible && incidentId) event.link = `/incidentes/${incidentId}`;
        else if (objectVisible && currentEntityName && ['site', 'institution', 'user'].includes(type)) event.link = `/instituciones${event.siteId ? `?siteId=${event.siteId}` : ''}`;
        else if (objectVisible && currentEntityName && type === 'directory') event.link = '/directorio';
        event.createdAt = new Date(row.createdAt).toISOString();
        const searchable = [event.actorName, event.entityName, event.entityId, event.institutionName, event.siteName].filter(Boolean).join(' ').toLocaleLowerCase('es');
        if (!search || searchable.includes(search)) results.push(event);
        if (results.length > offset + limit) break;
      }
      more = rows.length === 500;
      if (rows.length) lastId = Number(rows.at(-1).id);
    }
    res.set('X-Audit-Snapshot', String(snapshotId));
    res.set('X-Has-More', String(results.length > offset + limit));
    res.json(results.slice(offset, offset + limit));
  });
  return router;
}

module.exports = { createAuditRouter, stripSecrets, recordType };
