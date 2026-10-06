const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { hasInstitutionScope } = require('../auth/authorization');
const { sendBestEffort } = require('../notifications/sender');

const verificationValues = new Set(['verified', 'unverifiable', 'false', 'duplicate']);
const priorityValues = new Set(['low', 'normal', 'high', 'critical']);
const assignmentNext = Object.freeze({ assigned: 'en_route', en_route: 'attending', attending: 'resolved', resolved: 'closed' });
const assignmentStages = Object.freeze({ assigned: 0, en_route: 1, attending: 2, resolved: 3, closed: 4 });

async function recordAudit(connection, actorId, correlationId, action, entityId, before, after, scope = {}) {
  await connection.execute(
    `INSERT INTO audit_logs (actor_user_id, institution_id, site_id, correlation_id, action, entity_type,
     entity_id, before_data, after_data) VALUES (?, ?, ?, ?, ?, 'incident', ?, ?, ?)`,
    [actorId, scope.institutionId || null, scope.siteId || null, correlationId, action, entityId,
      JSON.stringify(before), JSON.stringify(after)],
  );
}

async function notifyReporter(connection, incidentId, reporterId, status) {
  if (!reporterId) return null;
  const notification = { id: randomUUID(), userId: reporterId, incidentId,
    type: 'incident_status', title: 'Estado del reporte', message: `Su reporte pasó a ${status}` };
  await connection.execute(
    'INSERT INTO notifications (id, user_id, incident_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)',
    [notification.id, reporterId, incidentId, notification.type, notification.title, notification.message],
  );
  return notification;
}

async function verifyIncident(pool, incidentId, actor, body, correlationId) {
  const input = requireObject(body);
  const verificationStatus = requireText(input.verificationStatus, 'verificationStatus', { max: 30 });
  const reason = requireText(input.reason, 'reason', { max: 1000 });
  if (!verificationValues.has(verificationStatus)) throw new HttpError(422, 'VALIDATION_ERROR', 'Verificación inválida');
  const priority = input.priority === undefined ? null : requireText(input.priority, 'priority', { max: 20 });
  if (priority && !priorityValues.has(priority)) throw new HttpError(422, 'VALIDATION_ERROR', 'Prioridad inválida');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[incident]] = await connection.execute('SELECT id, verification_status AS verificationStatus, priority, status, reporter_user_id AS reporterId FROM incidents WHERE id = ? FOR UPDATE', [incidentId]);
    if (!incident) throw new HttpError(404, 'NOT_FOUND', 'Reporte no encontrado');
    if (incident.status === 'closed') throw new HttpError(409, 'CONFLICT', 'Reporte cerrado');
    await connection.execute('UPDATE incidents SET verification_status = ?, priority = ? WHERE id = ?', [verificationStatus, priority || incident.priority, incidentId]);
    await connection.execute(
      'INSERT INTO incident_history (incident_id, actor_user_id, event_type, previous_value, new_value, note) VALUES (?, ?, ?, ?, ?, ?)',
      [incidentId, actor.user.id, 'verification.changed', incident.verificationStatus, verificationStatus, reason],
    );
    await recordAudit(connection, actor.user.id, correlationId, 'incident.verify', incidentId,
      { verificationStatus: incident.verificationStatus, priority: incident.priority },
      { verificationStatus, priority: priority || incident.priority, reason });
    await connection.commit();
    return { id: incidentId, verificationStatus, priority: priority || incident.priority };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

async function setUnitStatuses(connection, assignmentId, oldStatus, newStatus, actorId) {
  const [units] = await connection.execute(
    `SELECT u.id, u.status FROM unit_assignments ua JOIN units u ON u.id = ua.unit_id
     WHERE ua.institution_assignment_id = ? AND ua.released_at IS NULL ORDER BY u.id FOR UPDATE`, [assignmentId],
  );
  const target = { en_route: 'en_route', attending: 'attending', resolved: 'returning', closed: 'available' }[newStatus];
  const expected = { en_route: 'assigned', attending: 'en_route', resolved: 'attending', closed: 'returning' }[newStatus];
  for (const unit of units) {
    if (unit.status !== expected) throw new HttpError(409, 'CONFLICT', 'Estado de unidad incompatible');
    await connection.execute('UPDATE units SET status = ? WHERE id = ?', [target, unit.id]);
    await connection.execute('INSERT INTO unit_status_history (unit_id, actor_user_id, previous_status, new_status, note) VALUES (?, ?, ?, ?, ?)',
      [unit.id, actorId, oldStatus === 'assigned' ? 'assigned' : unit.status, target, 'Hito de atención']);
  }
  if (newStatus === 'closed') {
    await connection.execute('UPDATE unit_assignments SET released_at = UTC_TIMESTAMP(3) WHERE institution_assignment_id = ? AND released_at IS NULL', [assignmentId]);
    await connection.execute('UPDATE personnel_assignments SET released_at = UTC_TIMESTAMP(3) WHERE institution_assignment_id = ? AND released_at IS NULL', [assignmentId]);
  }
}

async function advanceIncident(pool, incidentId, actor, body, correlationId, notificationSender = null) {
  const input = requireObject(body);
  const status = requireText(input.status, 'status', { max: 30 });
  const note = requireText(input.note, 'note', { max: 1000 });
  const assignmentId = input.assignmentId == null ? null : requireText(input.assignmentId, 'assignmentId', { max: 36 });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[incident]] = await connection.execute('SELECT id, status, reporter_user_id AS reporterId FROM incidents WHERE id = ? FOR UPDATE', [incidentId]);
    if (!incident) throw new HttpError(404, 'NOT_FOUND', 'Reporte no encontrado');
    if (!assignmentId) {
      if (incident.status !== 'reported' || status !== 'verifying') throw new HttpError(409, 'CONFLICT', 'Transición de estado no permitida');
      await connection.execute("UPDATE incidents SET status = 'verifying' WHERE id = ?", [incidentId]);
      await connection.execute('INSERT INTO incident_history (incident_id, actor_user_id, event_type, previous_value, new_value, note) VALUES (?, ?, ?, ?, ?, ?)',
        [incidentId, actor.user.id, 'status.changed', 'reported', 'verifying', note]);
      await recordAudit(connection, actor.user.id, correlationId, 'incident.status', incidentId, { status: 'reported' }, { status: 'verifying', note });
      const notification = await notifyReporter(connection, incidentId, incident.reporterId, 'verifying');
      await connection.commit();
      if (notification) await sendBestEffort(notificationSender, notification);
      return { id: incidentId, status: 'verifying' };
    }
    const [[assignment]] = await connection.execute(
      'SELECT id, institution_id AS institutionId, site_id AS siteId, status FROM institution_assignments WHERE id = ? AND incident_id = ? FOR UPDATE',
      [assignmentId, incidentId],
    );
    if (!assignment) throw new HttpError(404, 'NOT_FOUND', 'Asignación no encontrada');
    if (!hasInstitutionScope(actor, assignment.institutionId, assignment.siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    if (assignmentNext[assignment.status] !== status) throw new HttpError(409, 'CONFLICT', 'Transición de asignación no permitida');
    await setUnitStatuses(connection, assignmentId, assignment.status, status, actor.user.id);
    await connection.execute('UPDATE institution_assignments SET status = ?, closed_at = CASE WHEN ? = ? THEN UTC_TIMESTAMP(3) ELSE closed_at END WHERE id = ?',
      [status, status, 'closed', assignmentId]);
    const [all] = await connection.execute('SELECT status FROM institution_assignments WHERE incident_id = ?', [incidentId]);
    const minimum = Math.min(...all.map((item) => assignmentStages[item.status]));
    const globalStatus = Object.keys(assignmentStages).find((key) => assignmentStages[key] === minimum);
    let notification = null;
    if (globalStatus !== incident.status) {
      await connection.execute('UPDATE incidents SET status = ? WHERE id = ?', [globalStatus, incidentId]);
      notification = await notifyReporter(connection, incidentId, incident.reporterId, globalStatus);
    }
    await connection.execute(
      `INSERT INTO incident_history (incident_id, institution_assignment_id, actor_user_id, event_type, previous_value, new_value, note)
       VALUES (?, ?, ?, 'assignment.status', ?, ?, ?)`,
      [incidentId, assignmentId, actor.user.id, assignment.status, status, note],
    );
    await recordAudit(connection, actor.user.id, correlationId, 'assignment.status', incidentId,
      { assignmentId, status: assignment.status, globalStatus: incident.status },
      { assignmentId, status, globalStatus, note }, assignment);
    await connection.commit();
    if (notification) await sendBestEffort(notificationSender, notification);
    return { id: incidentId, assignmentId, assignmentStatus: status, status: globalStatus };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

module.exports = { verifyIncident, advanceIncident, assignmentNext, assignmentStages };
