const express = require('express');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText, requireInteger } = require('../http/validation');
const { requireAuthentication, requireRoles, hasInstitutionScope } = require('../auth/authorization');

const columns = `id, name, phone, scope, institution_id AS institutionId, site_id AS siteId,
  district_id AS districtId, active, is_demo AS isDemo, created_at AS createdAt`;

function normalize(row) {
  return { ...row, active: Boolean(row.active), isDemo: Boolean(row.isDemo),
    createdAt: new Date(row.createdAt).toISOString() };
}

function districtFilter(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Distrito inválido');
  }
  return Number(value);
}

function entryInput(body) {
  const input = requireObject(body);
  const name = requireText(input.name, 'name', { max: 150 });
  const phone = requireText(input.phone, 'phone', { max: 40 });
  if (!/^\+?[0-9 ()-]{3,40}$/.test(phone)) throw new HttpError(422, 'VALIDATION_ERROR', 'Teléfono inválido');
  const scope = requireText(input.scope, 'scope', { max: 20 });
  if (!['national', 'local'].includes(scope)) throw new HttpError(422, 'VALIDATION_ERROR', 'Ámbito inválido');
  const institutionId = input.institutionId === undefined || input.institutionId === null ? null
    : requireText(input.institutionId, 'institutionId', { max: 36 });
  const siteId = input.siteId === undefined || input.siteId === null ? null
    : requireText(input.siteId, 'siteId', { max: 36 });
  const districtId = input.districtId === undefined || input.districtId === null ? null
    : requireInteger(input.districtId, 'districtId', { min: 1 });
  if (scope === 'national' && (districtId !== null || siteId !== null)) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Contacto nacional no puede tener distrito o sede');
  }
  if (scope === 'local' && districtId === null) throw new HttpError(422, 'VALIDATION_ERROR', 'Distrito requerido');
  if (siteId && !institutionId) throw new HttpError(422, 'VALIDATION_ERROR', 'Institución requerida');
  return { name, phone, scope, institutionId, siteId, districtId };
}

function canManage(auth, entry) {
  if (auth.roles.has('SuperAdministrador')) return true;
  return entry.scope === 'local' && entry.institutionId
    && hasInstitutionScope(auth, entry.institutionId, entry.siteId);
}

async function find(pool, id) {
  const [[row]] = await pool.execute(`SELECT ${columns} FROM directory_entries WHERE id = ?`, [id]);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Contacto no encontrado');
  return normalize(row);
}

async function writeAudit(connection, auth, correlationId, action, entry, before = null) {
  await connection.execute(
    `INSERT INTO audit_logs (actor_user_id, institution_id, site_id, correlation_id, action, entity_type, entity_id, before_data, after_data)
     VALUES (?, ?, ?, ?, ?, 'directory_entry', ?, ?, ?)`,
    [auth.user.id, entry.institutionId, entry.siteId, correlationId, action, entry.id,
      before ? JSON.stringify(before) : null, JSON.stringify(entry)],
  );
}

async function transaction(pool, action) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_NO_REFERENCED_ROW_2') throw new HttpError(422, 'VALIDATION_ERROR', 'Referencia territorial inválida');
    throw error;
  } finally { connection.release(); }
}

function createDirectoryRouter(pool, authConfig) {
  const router = express.Router();
  router.get('/public/directory', async (req, res) => {
    const districtId = districtFilter(req.query.districtId);
    const [rows] = await pool.execute(
      `SELECT ${columns} FROM directory_entries WHERE active = TRUE
       AND (scope = 'national' OR (? IS NOT NULL AND scope = 'local' AND district_id = ?))
       ORDER BY scope, name, id LIMIT 200`, [districtId, districtId],
    );
    res.json(rows.map(normalize));
  });
  const admin = [requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional')];
  router.get('/admin/directory', ...admin, async (req, res) => {
    const [rows] = await pool.execute(`SELECT ${columns} FROM directory_entries ORDER BY name, id LIMIT 501`);
    if (rows.length > 500) throw new HttpError(422, 'QUERY_LIMIT', 'Demasiados contactos');
    res.json(rows.map(normalize).filter((row) => canManage(req.auth, row)));
  });
  router.post('/admin/directory', ...admin, async (req, res) => {
    const input = entryInput(req.body);
    if (!canManage(req.auth, input)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const id = randomUUID();
    const entry = await transaction(pool, async (connection) => {
      if (input.siteId) {
        const [[site]] = await connection.execute('SELECT institution_id FROM sites WHERE id = ? AND active = TRUE', [input.siteId]);
        if (!site || site.institution_id !== input.institutionId) throw new HttpError(422, 'VALIDATION_ERROR', 'Sede inválida');
      }
      await connection.execute(
        `INSERT INTO directory_entries (id, name, phone, scope, institution_id, site_id, district_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, input.name, input.phone, input.scope, input.institutionId, input.siteId, input.districtId],
      );
      const [[row]] = await connection.execute(`SELECT ${columns} FROM directory_entries WHERE id = ?`, [id]);
      const result = normalize(row);
      await writeAudit(connection, req.auth, req.correlationId, 'directory.create', result);
      return result;
    });
    res.status(201).json(entry);
  });
  router.patch('/admin/directory/:id', ...admin, async (req, res) => {
    const before = await find(pool, req.params.id);
    if (!canManage(req.auth, before)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const input = entryInput({ ...before, ...requireObject(req.body) });
    if (!canManage(req.auth, input)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const entry = await transaction(pool, async (connection) => {
      if (input.siteId) {
        const [[site]] = await connection.execute('SELECT institution_id FROM sites WHERE id = ? AND active = TRUE', [input.siteId]);
        if (!site || site.institution_id !== input.institutionId) throw new HttpError(422, 'VALIDATION_ERROR', 'Sede inválida');
      }
      await connection.execute(
        `UPDATE directory_entries SET name = ?, phone = ?, scope = ?, institution_id = ?, site_id = ?, district_id = ? WHERE id = ?`,
        [input.name, input.phone, input.scope, input.institutionId, input.siteId, input.districtId, before.id],
      );
      const [[row]] = await connection.execute(`SELECT ${columns} FROM directory_entries WHERE id = ?`, [before.id]);
      const result = normalize(row);
      await writeAudit(connection, req.auth, req.correlationId, 'directory.update', result, before);
      return result;
    });
    res.json(entry);
  });
  router.delete('/admin/directory/:id', ...admin, async (req, res) => {
    const before = await find(pool, req.params.id);
    if (!canManage(req.auth, before)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    await transaction(pool, async (connection) => {
      await connection.execute('UPDATE directory_entries SET active = FALSE WHERE id = ?', [before.id]);
      await writeAudit(connection, req.auth, req.correlationId, 'directory.deactivate', { ...before, active: false }, before);
    });
    res.status(204).end();
  });
  return router;
}

module.exports = { createDirectoryRouter, entryInput, districtFilter };
