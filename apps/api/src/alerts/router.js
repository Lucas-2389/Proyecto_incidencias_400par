const express = require('express');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText, requireInteger } = require('../http/validation');
const { requireAuthentication, requireRoles } = require('../auth/authorization');

const columns = `id, author_user_id AS authorUserId, district_id AS districtId, type,
  title, message, valid_from AS validFrom, valid_until AS validUntil,
  active, is_demo AS isDemo, created_at AS createdAt`;

function normalize(row) {
  return { ...row, active: Boolean(row.active), isDemo: Boolean(row.isDemo),
    validFrom: new Date(row.validFrom).toISOString(), validUntil: new Date(row.validUntil).toISOString(),
    createdAt: new Date(row.createdAt).toISOString() };
}

function parseDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value)) throw new HttpError(422, 'VALIDATION_ERROR', `Fecha inválida: ${field}`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new HttpError(422, 'VALIDATION_ERROR', `Fecha inválida: ${field}`);
  return date;
}

function inputFrom(body) {
  const input = requireObject(body);
  const districtId = input.districtId == null ? null : requireInteger(input.districtId, 'districtId', { min: 1 });
  const type = requireText(input.type, 'type', { max: 60 });
  const title = requireText(input.title, 'title', { max: 200 });
  const message = requireText(input.message, 'message', { max: 2000 });
  const validFrom = parseDate(input.validFrom, 'validFrom');
  const validUntil = parseDate(input.validUntil, 'validUntil');
  if (validUntil <= validFrom || validUntil.getTime() - validFrom.getTime() > 90 * 86400000) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Vigencia inválida');
  }
  return { districtId, type, title, message, validFrom, validUntil };
}

async function canManageDistrict(pool, auth, districtId) {
  if (auth.roles.has('SuperAdministrador')) return true;
  if (districtId === null) return false;
  const [rows] = await pool.execute(
    `SELECT s.id FROM sites s JOIN institution_memberships m ON m.institution_id = s.institution_id
     JOIN roles r ON r.id = m.role_id AND r.code = 'AdministradorInstitucional'
     WHERE m.user_id = ? AND m.active = TRUE AND s.active = TRUE AND s.district_id = ?
       AND (m.site_id IS NULL OR m.site_id = s.id) LIMIT 1`, [auth.user.id, districtId],
  );
  return rows.length > 0;
}

async function find(pool, id) {
  const [[row]] = await pool.execute(`SELECT ${columns} FROM alerts WHERE id = ?`, [id]);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Alerta no encontrada');
  return normalize(row);
}

function dbDate(value) { return value.toISOString().slice(0, 23).replace('T', ' '); }

async function transaction(pool, action) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_NO_REFERENCED_ROW_2') throw new HttpError(422, 'VALIDATION_ERROR', 'Distrito inválido');
    throw error;
  } finally { connection.release(); }
}

async function audit(connection, auth, correlationId, action, alert, before = null) {
  let institutionId = null;
  let siteId = null;
  if (!auth.roles.has('SuperAdministrador')) {
    const [[scope]] = await connection.execute(
      `SELECT s.institution_id AS institutionId, m.site_id AS siteId FROM sites s
       JOIN institution_memberships m ON m.institution_id = s.institution_id
       JOIN roles r ON r.id = m.role_id AND r.code = 'AdministradorInstitucional'
       WHERE m.user_id = ? AND m.active = TRUE AND s.active = TRUE AND s.district_id = ?
         AND (m.site_id IS NULL OR m.site_id = s.id) LIMIT 1`, [auth.user.id, alert.districtId],
    );
    institutionId = scope?.institutionId ?? null;
    siteId = scope?.siteId ?? null;
  }
  await connection.execute(
    `INSERT INTO audit_logs (actor_user_id, institution_id, site_id, correlation_id, action, entity_type, entity_id, before_data, after_data)
     VALUES (?, ?, ?, ?, ?, 'alert', ?, ?, ?)`,
    [auth.user.id, institutionId, siteId, correlationId, action, alert.id,
      before ? JSON.stringify(before) : null, JSON.stringify(alert)],
  );
}

function createAlertsRouter(pool, authConfig) {
  const router = express.Router();
  router.get('/public/alerts', async (req, res) => {
    const districtId = req.query.districtId === undefined ? null : Number(req.query.districtId);
    if (districtId !== null && (typeof req.query.districtId !== 'string' || !/^[1-9]\d*$/.test(req.query.districtId) || !Number.isSafeInteger(districtId))) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'Distrito inválido');
    }
    const [rows] = await pool.execute(
      `SELECT ${columns} FROM alerts WHERE active = TRUE
       AND valid_from <= UTC_TIMESTAMP(3) AND valid_until > UTC_TIMESTAMP(3)
       AND (district_id IS NULL OR (? IS NOT NULL AND district_id = ?))
       ORDER BY valid_from DESC, id DESC LIMIT 100`, [districtId, districtId],
    );
    res.json(rows.map(normalize));
  });
  const admin = [requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional')];
  router.get('/admin/alerts', ...admin, async (req, res) => {
    const [rows] = await pool.execute(`SELECT ${columns} FROM alerts ORDER BY created_at DESC LIMIT 501`);
    if (rows.length > 500) throw new HttpError(422, 'QUERY_LIMIT', 'Demasiadas alertas');
    const visible = [];
    for (const row of rows) if (await canManageDistrict(pool, req.auth, row.districtId)) visible.push(normalize(row));
    res.json(visible);
  });
  router.post('/admin/alerts', ...admin, async (req, res) => {
    const input = inputFrom(req.body);
    if (!await canManageDistrict(pool, req.auth, input.districtId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const id = randomUUID();
    const alert = await transaction(pool, async (connection) => {
      await connection.execute(
        `INSERT INTO alerts (id, author_user_id, district_id, type, title, message, valid_from, valid_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.auth.user.id, input.districtId, input.type, input.title, input.message,
          dbDate(input.validFrom), dbDate(input.validUntil)],
      );
      const [[row]] = await connection.execute(`SELECT ${columns} FROM alerts WHERE id = ?`, [id]);
      const result = normalize(row);
      await audit(connection, req.auth, req.correlationId, 'alert.create', result);
      return result;
    });
    res.status(201).json(alert);
  });
  router.patch('/admin/alerts/:id', ...admin, async (req, res) => {
    const before = await find(pool, req.params.id);
    if (!req.auth.roles.has('SuperAdministrador') && before.authorUserId !== req.auth.user.id) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    if (!await canManageDistrict(pool, req.auth, before.districtId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const input = inputFrom({ ...before, ...requireObject(req.body) });
    if (!await canManageDistrict(pool, req.auth, input.districtId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const alert = await transaction(pool, async (connection) => {
      await connection.execute(
        `UPDATE alerts SET district_id = ?, type = ?, title = ?, message = ?, valid_from = ?, valid_until = ? WHERE id = ?`,
        [input.districtId, input.type, input.title, input.message,
          dbDate(input.validFrom), dbDate(input.validUntil), before.id],
      );
      const [[row]] = await connection.execute(`SELECT ${columns} FROM alerts WHERE id = ?`, [before.id]);
      const result = normalize(row);
      await audit(connection, req.auth, req.correlationId, 'alert.update', result, before);
      return result;
    });
    res.json(alert);
  });
  router.delete('/admin/alerts/:id', ...admin, async (req, res) => {
    const before = await find(pool, req.params.id);
    if (!req.auth.roles.has('SuperAdministrador') && before.authorUserId !== req.auth.user.id) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    if (!await canManageDistrict(pool, req.auth, before.districtId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    await transaction(pool, async (connection) => {
      await connection.execute('UPDATE alerts SET active = FALSE WHERE id = ?', [before.id]);
      await audit(connection, req.auth, req.correlationId, 'alert.deactivate', { ...before, active: false }, before);
    });
    res.status(204).end();
  });
  return router;
}

module.exports = { createAlertsRouter, inputFrom };
