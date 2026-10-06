const express = require('express');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { requireAuthentication, requireRoles, requireIncidentScope, hasIncidentScope } = require('../auth/authorization');
const { verifyIncident, advanceIncident } = require('./lifecycle');
const { suggestSites } = require('./suggestions');

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
  const [rows] = await pool.execute(
    `SELECT i.id, i.reference, i.category_id AS categoryId, i.status, i.verification_status AS verificationStatus,
     i.priority, i.created_at AS createdAt FROM incidents i
     WHERE (? IS NULL OR i.status = ?) ORDER BY i.created_at DESC LIMIT 200`, [status ?? null, status ?? null],
  );
  const visible = [];
  for (const row of rows) {
    if (!await hasIncidentScope(pool, auth, row.id)) continue;
    const suggestion = await suggestSites(pool, row.id, auth);
    if (exceptionOnly && !suggestion.exception) continue;
    visible.push({ ...row, createdAt: new Date(row.createdAt).toISOString(), exception: suggestion.exception });
  }
  return visible;
}

function createOperationsRouter(pool, authConfig, notificationSender = null) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador'));
  router.get('/', async (req, res) => { res.json(await listOperational(pool, req.auth, req.query)); });
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
      `SELECT id, institution_assignment_id AS assignmentId, actor_user_id AS actorUserId,
       event_type AS eventType, previous_value AS previousValue, new_value AS newValue,
       note, created_at AS createdAt FROM incident_history WHERE incident_id = ? ORDER BY id`, [req.params.id],
    );
    res.json(rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() })));
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
