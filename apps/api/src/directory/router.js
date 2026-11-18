const express = require('express');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText, requireInteger } = require('../http/validation');
const { requireAuthentication, requireRoles, hasAdministrativeScope } = require('../auth/authorization');
const { canonicalDistrictId, lockTerritory } = require('../territory/router');
const { transaction } = require('../db/transaction');
const { writeAudit } = require('../audit/write');

const columns = `id, name, phone, scope, institution_id AS institutionId, site_id AS siteId,
  district_id AS districtId, active, is_demo AS isDemo, created_at AS createdAt,
  (SELECT name FROM institutions WHERE id = directory_entries.institution_id) AS institutionName,
  (SELECT name FROM sites WHERE id = directory_entries.site_id) AS siteName,
  (SELECT name FROM districts WHERE id = directory_entries.district_id) AS districtName`;

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
    && hasAdministrativeScope(auth, entry.institutionId, entry.siteId);
}

async function find(pool, id, lock = false) {
  const [[row]] = await pool.execute(`SELECT ${columns} FROM directory_entries WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Contacto no encontrado');
  return normalize(row);
}

function createDirectoryRouter(pool, authConfig) {
  const router = express.Router();
  router.get('/public/directory', async (req, res) => {
    const districtId = await canonicalDistrictId(pool, req.query.districtId);
    const [rows] = await pool.execute(
      `SELECT ${columns} FROM directory_entries WHERE active = TRUE
       AND (scope = 'national' OR (? IS NOT NULL AND scope = 'local' AND district_id = ?))
       ORDER BY scope, name, id LIMIT 201`, [districtId, districtId],
    );
    if (rows.length > 200) throw new HttpError(422, 'QUERY_LIMIT', 'El directorio supera el límite de publicación');
    res.json(rows.map(normalize));
  });
  const admin = [requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional')];
  router.get('/admin/directory', ...admin, async (req, res) => {
    const districtId = await canonicalDistrictId(pool, req.query.districtId);
    const superAdmin = req.auth.roles.has('SuperAdministrador');
    const [rows] = await pool.execute(`SELECT ${columns} FROM directory_entries
      WHERE (? IS NULL OR district_id = ?) ${superAdmin ? '' : `AND scope = 'local' AND EXISTS (
        SELECT 1 FROM institution_memberships m JOIN roles r ON r.id = m.role_id
        WHERE m.user_id = ? AND m.active = TRUE AND r.code = 'AdministradorInstitucional'
          AND m.institution_id = directory_entries.institution_id
          AND (m.site_id IS NULL OR m.site_id = directory_entries.site_id))`}
      ORDER BY name, id LIMIT 501`, [districtId, districtId, ...(superAdmin ? [] : [req.auth.user.id])]);
    if (rows.length > 500) throw new HttpError(422, 'QUERY_LIMIT', 'Demasiados contactos');
    res.json(rows.map(normalize).filter((row) => canManage(req.auth, row)));
  });
  router.post('/admin/directory', ...admin, async (req, res) => {
    const input = entryInput(req.body);
    if (!canManage(req.auth, input)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const id = randomUUID();
    const entry = await transaction(pool, async (connection) => {
      await lockTerritory(connection);
      if (input.districtId) input.districtId = await canonicalDistrictId(connection, String(input.districtId));
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
      await writeAudit(connection, req, 'directory', 'directory.create', result);
      return result;
    });
    res.status(201).json(entry);
  });
  router.patch('/admin/directory/:id', ...admin, async (req, res) => {
    const entry = await transaction(pool, async (connection) => {
      await lockTerritory(connection);
      const before = await find(connection, req.params.id, true);
      if (!canManage(req.auth, before)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
      const input = entryInput({ ...before, ...requireObject(req.body) });
      if (input.districtId) input.districtId = await canonicalDistrictId(connection, String(input.districtId));
      if (!canManage(req.auth, input)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
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
      await writeAudit(connection, req, 'directory', 'directory.update', result, before);
      return result;
    });
    res.json(entry);
  });
  router.delete('/admin/directory/:id', ...admin, async (req, res) => {
    await transaction(pool, async (connection) => {
      const before = await find(connection, req.params.id, true);
      if (!canManage(req.auth, before)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
      await connection.execute('UPDATE directory_entries SET active = FALSE WHERE id = ?', [before.id]);
      await writeAudit(connection, req, 'directory', 'directory.deactivate', { ...before, active: false }, before);
    });
    res.status(204).end();
  });
  return router;
}

module.exports = { createDirectoryRouter, entryInput, districtFilter };
