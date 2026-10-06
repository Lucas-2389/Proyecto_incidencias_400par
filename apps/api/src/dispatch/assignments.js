const express = require('express');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { requireAuthentication, requireRoles, requireIncidentScope, hasInstitutionScope } = require('../auth/authorization');
const { suggestSites } = require('./suggestions');

function ids(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30 || value.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id))) {
    throw new HttpError(422, 'VALIDATION_ERROR', `Campo inválido: ${name}`);
  }
  if (new Set(value).size !== value.length) throw new HttpError(422, 'VALIDATION_ERROR', `Duplicados en ${name}`);
  return [...value].sort();
}

function assignmentInput(body) {
  const input = requireObject(body);
  return {
    institutionId: requireText(input.institutionId, 'institutionId', { max: 36 }),
    siteId: requireText(input.siteId, 'siteId', { max: 36 }),
    operatorUserId: input.operatorUserId == null ? null : requireText(input.operatorUserId, 'operatorUserId', { max: 36 }),
    reason: input.reason == null ? null : requireText(input.reason, 'reason', { max: 1000 }),
    unitIds: ids(input.unitIds, 'unitIds'),
    personnelIds: ids(input.personnelIds, 'personnelIds'),
  };
}

async function reserveResources(connection, assignmentId, input, actorId) {
  for (const unitId of input.unitIds) {
    const [[unit]] = await connection.execute('SELECT id, institution_id AS institutionId, site_id AS siteId, status FROM units WHERE id = ? FOR UPDATE', [unitId]);
    if (!unit || unit.institutionId !== input.institutionId || unit.siteId !== input.siteId || unit.status !== 'available') {
      throw new HttpError(409, 'CONFLICT', 'Unidad no disponible en la sede');
    }
    const [[busy]] = await connection.execute('SELECT id FROM unit_assignments WHERE unit_id = ? AND released_at IS NULL LIMIT 1', [unitId]);
    if (busy) throw new HttpError(409, 'CONFLICT', 'Unidad ya asignada');
    await connection.execute('INSERT INTO unit_assignments (id, institution_assignment_id, unit_id) VALUES (?, ?, ?)', [randomUUID(), assignmentId, unitId]);
    await connection.execute("UPDATE units SET status = 'assigned' WHERE id = ?", [unitId]);
    await connection.execute("INSERT INTO unit_status_history (unit_id, actor_user_id, previous_status, new_status, note) VALUES (?, ?, 'available', 'assigned', 'Reserva para atención')", [unitId, actorId]);
  }
  for (const personnelId of input.personnelIds) {
    const [[person]] = await connection.execute('SELECT id, institution_id AS institutionId, site_id AS siteId, active FROM personnel WHERE id = ? FOR UPDATE', [personnelId]);
    if (!person || person.institutionId !== input.institutionId || person.siteId !== input.siteId || !person.active) {
      throw new HttpError(409, 'CONFLICT', 'Personal no disponible en la sede');
    }
    const [[busy]] = await connection.execute('SELECT id FROM personnel_assignments WHERE personnel_id = ? AND released_at IS NULL LIMIT 1', [personnelId]);
    if (busy) throw new HttpError(409, 'CONFLICT', 'Personal ya asignado');
    await connection.execute('INSERT INTO personnel_assignments (id, institution_assignment_id, personnel_id) VALUES (?, ?, ?)', [randomUUID(), assignmentId, personnelId]);
  }
}

async function createAssignment(pool, incidentId, actor, body, correlationId) {
  const input = assignmentInput(body);
  if (!hasInstitutionScope(actor, input.institutionId, input.siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
  const [[site]] = await pool.execute(
    'SELECT s.id FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE s.id = ? AND s.institution_id = ? AND s.active = TRUE AND i.active = TRUE',
    [input.siteId, input.institutionId],
  );
  if (!site) throw new HttpError(422, 'VALIDATION_ERROR', 'Sede inactiva o fuera de institución');
  const suggested = await suggestSites(pool, incidentId, actor);
  const isSuggested = suggested.suggestions.some((item) => item.siteId === input.siteId);
  if (!isSuggested && !input.reason) throw new HttpError(422, 'VALIDATION_ERROR', 'La corrección manual requiere motivo');
  if (input.operatorUserId) {
    const [[operator]] = await pool.execute(
      `SELECT m.id FROM institution_memberships m JOIN roles r ON r.id = m.role_id
       JOIN users u ON u.id = m.user_id AND u.status = 'active'
       WHERE m.user_id = ? AND m.institution_id = ? AND m.site_id = ? AND m.active = TRUE AND r.code = 'Operador' LIMIT 1`,
      [input.operatorUserId, input.institutionId, input.siteId],
    );
    if (!operator) throw new HttpError(422, 'VALIDATION_ERROR', 'Operador fuera de sede');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[incident]] = await connection.execute('SELECT id, status FROM incidents WHERE id = ? FOR UPDATE', [incidentId]);
    if (!incident) throw new HttpError(404, 'NOT_FOUND', 'Reporte no encontrado');
    if (['resolved', 'closed'].includes(incident.status)) throw new HttpError(409, 'CONFLICT', 'Reporte ya finalizado');
    const id = randomUUID();
    await connection.execute(
      'INSERT INTO institution_assignments (id, incident_id, institution_id, site_id, operator_user_id, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [id, incidentId, input.institutionId, input.siteId, input.operatorUserId, input.reason],
    );
    await reserveResources(connection, id, input, actor.user.id);
    if (incident.status === 'reported' || incident.status === 'verifying') {
      await connection.execute("UPDATE incidents SET status = 'assigned' WHERE id = ?", [incidentId]);
    }
    await connection.execute(
      `INSERT INTO incident_history (incident_id, institution_assignment_id, actor_user_id, event_type, previous_value, new_value, note)
       VALUES (?, ?, ?, ?, ?, 'assigned', ?)`,
      [incidentId, id, actor.user.id, isSuggested ? 'assignment.confirmed' : 'assignment.corrected', incident.status, input.reason],
    );
    await connection.execute(
      `INSERT INTO audit_logs (actor_user_id, institution_id, site_id, correlation_id, action, entity_type, entity_id, after_data)
       VALUES (?, ?, ?, ?, ?, 'institution_assignment', ?, ?)`,
      [actor.user.id, input.institutionId, input.siteId, correlationId,
        isSuggested ? 'assignment.confirm' : 'assignment.override', id,
        JSON.stringify({ incidentId, siteId: input.siteId, reason: input.reason })],
    );
    const [[saved]] = await connection.execute('SELECT assigned_at AS assignedAt FROM institution_assignments WHERE id = ?', [id]);
    await connection.commit();
    return { id, incidentId, institutionId: input.institutionId, siteId: input.siteId,
      operatorUserId: input.operatorUserId, unitIds: input.unitIds, personnelIds: input.personnelIds,
      status: 'assigned', reason: input.reason, corrected: !isSuggested,
      createdAt: new Date(saved.assignedAt).toISOString() };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'CONFLICT', 'La sede ya está asignada');
    throw error;
  } finally { connection.release(); }
}

function createAssignmentsRouter(pool, authConfig) {
  const router = express.Router();
  router.post('/:id/assignments', requireAuthentication(pool, authConfig),
    requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador'),
    requireIncidentScope(pool), async (req, res) => {
      res.status(201).json(await createAssignment(pool, req.params.id, req.auth, req.body, req.correlationId));
    });
  return router;
}

module.exports = { createAssignment, createAssignmentsRouter };
