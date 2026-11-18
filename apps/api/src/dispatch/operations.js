const express = require('express');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { requireAuthentication, requireRoles, requireIncidentScope, hasIncidentScope, hasInstitutionScope } = require('../auth/authorization');
const { verifyIncident, advanceIncident } = require('./lifecycle');
const { suggestSites } = require('./suggestions');
const { canonicalDistrictId } = require('../territory/router');
const { parseFilters } = require('../geospatial/router');

async function linkDuplicate(pool, duplicateId, actor, body, correlationId) {
  const input = requireObject(body);
  const primaryId = requireText(input.primaryIncidentId, 'primaryIncidentId', { max: 36 });
  const reason = requireText(input.reason, 'reason', { max: 1000 });
  if (primaryId === duplicateId) throw new HttpError(422, 'VALIDATION_ERROR', 'Incidentes idénticos');
  if (!await hasIncidentScope(pool, actor, primaryId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id FROM incidents WHERE id IN (?, ?) ORDER BY id FOR UPDATE', [duplicateId, primaryId]);
    if (rows.length !== 2) throw new HttpError(404, 'NOT_FOUND', 'Reporte no encontrado');
    await connection.execute('INSERT INTO incident_duplicates (duplicate_incident_id, primary_incident_id, linked_by_user_id, reason) VALUES (?, ?, ?, ?)',
      [duplicateId, primaryId, actor.user.id, reason]);
    await connection.execute("UPDATE incidents SET verification_status = 'duplicate' WHERE id = ?", [duplicateId]);
    await connection.execute(
      "INSERT INTO incident_history (incident_id, actor_user_id, event_type, new_value, note) VALUES (?, ?, 'duplicate.linked', ?, ?)",
      [duplicateId, actor.user.id, primaryId, reason],
    );
    await connection.execute(
      `INSERT INTO audit_logs (actor_user_id, correlation_id, action, entity_type, entity_id, after_data)
       VALUES (?, ?, 'incident.duplicate', 'incident', ?, ?)`,
      [actor.user.id, correlationId, duplicateId, JSON.stringify({ primaryId, reason })],
    );
    await connection.commit();
    return { duplicateIncidentId: duplicateId, primaryIncidentId: primaryId, reason };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'CONFLICT', 'Reporte ya vinculado');
    throw error;
  } finally { connection.release(); }
}

async function listOperational(pool, auth, query) {
  const status = query.status;
  const allowed = new Set(['reported', 'verifying', 'assigned', 'en_route', 'attending', 'resolved', 'closed']);
  if (status !== undefined && (typeof status !== 'string' || !allowed.has(status))) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Estado inválido');
  }
  const exceptionOnly = query.exception === 'true';
  if (query.exception !== undefined && !['true', 'false'].includes(query.exception)) throw new HttpError(422, 'VALIDATION_ERROR', 'Filtro inválido');
  const districtId = await canonicalDistrictId(pool, query.districtId);
  const period = query.from !== undefined || query.to !== undefined ? parseFilters(query) : null;
  const from = period?.from.toISOString().slice(0, 23).replace('T', ' ') ?? null;
  const to = period?.to.toISOString().slice(0, 23).replace('T', ' ') ?? null;
  const visible = [];
  let offset = 0;
  let more = true;
  while (more && visible.length < 200) {
    const [rows] = await pool.execute(
    `SELECT i.id, i.reference, i.category_id AS categoryId, c.name AS categoryName,
     i.status, i.verification_status AS verificationStatus,
     i.priority, i.created_at AS createdAt, l.district_id AS districtId FROM incidents i
     LEFT JOIN incident_categories c ON c.id = i.category_id
     LEFT JOIN incident_locations l ON l.incident_id = i.id
     WHERE (? IS NULL OR i.status = ?) AND (? IS NULL OR l.district_id = ?)
       AND (? IS NULL OR i.created_at >= ?) AND (? IS NULL OR i.created_at < ?)
     ORDER BY i.created_at DESC, i.id DESC LIMIT 200 OFFSET ?`,
      [status ?? null, status ?? null, districtId, districtId, from, from, to, to, offset],
    );
    for (const row of rows) {
      if (!await hasIncidentScope(pool, auth, row.id)) continue;
      const suggestion = await suggestSites(pool, row.id, auth);
      if (exceptionOnly && !suggestion.exception) continue;
      visible.push({ ...row, createdAt: new Date(row.createdAt).toISOString(), exception: suggestion.exception });
      if (visible.length === 200) break;
    }
    more = rows.length === 200;
    offset += 200;
  }
  return visible;
}

function createOperationsRouter(pool, authConfig, notificationSender = null) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador'));
  router.get('/', async (req, res) => { res.json(await listOperational(pool, req.auth, req.query)); });
  router.get('/:id/operators', requireIncidentScope(pool), async (req, res) => {
    const siteId = req.query.siteId;
    if (typeof siteId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteId)) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'Sede inválida');
    }
    const [[incident]] = await pool.execute('SELECT id FROM incidents WHERE id = ?', [req.params.id]);
    if (!incident) throw new HttpError(404, 'NOT_FOUND', 'Reporte no encontrado');
    const [[site]] = await pool.execute(
      `SELECT s.institution_id AS institutionId FROM sites s JOIN institutions i ON i.id = s.institution_id
       WHERE s.id = ? AND s.active = TRUE AND i.active = TRUE`, [siteId],
    );
    if (!site) throw new HttpError(404, 'NOT_FOUND', 'Sede activa no encontrada');
    if (!hasInstitutionScope(req.auth, site.institutionId, siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const [operators] = await pool.execute(
      `SELECT DISTINCT u.id, u.name FROM users u
       JOIN institution_memberships m ON m.user_id = u.id
       JOIN roles r ON r.id = m.role_id
       WHERE u.status = 'active' AND m.active = TRUE AND r.code = 'Operador'
         AND m.institution_id = ? AND m.site_id = ? ORDER BY u.name, u.id`, [site.institutionId, siteId],
    );
    res.json(operators);
  });
  router.patch('/:id/verification', requireIncidentScope(pool), async (req, res) => {
    res.json(await verifyIncident(pool, req.params.id, req.auth, req.body, req.correlationId));
  });
  router.patch('/:id/status', requireIncidentScope(pool), async (req, res) => {
    res.json(await advanceIncident(pool, req.params.id, req.auth, req.body, req.correlationId, notificationSender));
  });
  router.post('/:id/duplicates', requireIncidentScope(pool), async (req, res) => {
    res.status(201).json(await linkDuplicate(pool, req.params.id, req.auth, req.body, req.correlationId));
  });
  router.get('/:id/history', requireIncidentScope(pool), async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT h.id, h.institution_assignment_id AS assignmentId, h.actor_user_id AS actorUserId,
       actor.name AS actorName, h.event_type AS eventType, h.previous_value AS previousValue, h.new_value AS newValue,
       h.note, h.created_at AS createdAt, a.institution_id AS institutionId, a.site_id AS siteId,
       linked.id AS linkedIncidentId, linked.reference AS linkedIncidentReference
       FROM incident_history h LEFT JOIN users actor ON actor.id = h.actor_user_id
       LEFT JOIN institution_assignments a ON a.id = h.institution_assignment_id
       LEFT JOIN incidents linked ON h.event_type = 'duplicate.linked' AND linked.id = h.new_value
       WHERE h.incident_id = ? ORDER BY h.id`, [req.params.id],
    );
    const events = await Promise.all(rows.map(async (row) => {
      const { institutionId, siteId, linkedIncidentId, ...event } = row;
      if (row.assignmentId && !hasInstitutionScope(req.auth, institutionId, siteId)) event.actorName = null;
      if (linkedIncidentId && !await hasIncidentScope(pool, req.auth, linkedIncidentId)) event.linkedIncidentReference = null;
      return { ...event, createdAt: new Date(row.createdAt).toISOString() };
    }));
    res.json(events);
  });
  router.get('/:id/assignments', requireIncidentScope(pool), async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT id, institution_id AS institutionId, site_id AS siteId, operator_user_id AS operatorUserId,
       status, reason, assigned_at AS assignedAt, closed_at AS closedAt
       FROM institution_assignments WHERE incident_id = ? ORDER BY assigned_at, id`, [req.params.id],
    );
    const visible = rows.filter((row) => req.auth.roles.has('SuperAdministrador')
      || req.auth.memberships.some((m) => m.institution_id === row.institutionId && (!m.site_id || m.site_id === row.siteId)));
    res.json(visible.map((row) => ({ ...row, incidentId: req.params.id,
      assignedAt: new Date(row.assignedAt).toISOString(), createdAt: new Date(row.assignedAt).toISOString(),
      closedAt: row.closedAt ? new Date(row.closedAt).toISOString() : null })));
  });
  return router;
}

module.exports = { createOperationsRouter, listOperational, linkDuplicate };
