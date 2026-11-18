const express = require('express');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { hashPassword } = require('../auth/password');
const { requireAuthentication, requireRoles, hasAdministrativeScope } = require('../auth/authorization');
const { transaction } = require('../db/transaction');
const { writeAudit } = require('../audit/write');

const managedRoles = new Set(['Operador', 'AdministradorInstitucional']);

function validateNewUser(body) {
  const input = requireObject(body);
  const name = requireText(input.name, 'name', { max: 150 });
  const email = requireText(input.email, 'email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(422, 'VALIDATION_ERROR', 'Correo inválido');
  const role = requireText(input.role, 'role', { max: 48 });
  if (!managedRoles.has(role)) throw new HttpError(422, 'VALIDATION_ERROR', 'Rol inválido');
  const institutionId = requireText(input.institutionId, 'institutionId', { max: 36 });
  const siteId = requireText(input.siteId, 'siteId', { max: 36 });
  return { name, email, role, institutionId, siteId, password: input.password };
}

async function scopeForSite(pool, auth, institutionId, siteId) {
  if (!hasAdministrativeScope(auth, institutionId, siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
  const [[site]] = await pool.execute(
    `SELECT s.id, s.district_id AS districtId FROM sites s JOIN institutions i ON i.id = s.institution_id
     WHERE s.id = ? AND s.institution_id = ? AND s.active = TRUE AND i.active = TRUE FOR SHARE`,
    [siteId, institutionId],
  );
  if (!site) throw new HttpError(422, 'VALIDATION_ERROR', 'Sede inactiva o fuera de institución');
  return site;
}

function createInstitutionalUsersRouter(pool, authConfig) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional'));
  router.get('/', async (req, res) => {
    const superAdmin = req.auth.roles.has('SuperAdministrador');
    for (const key of ['institutionId', 'siteId']) {
      if (req.query[key] !== undefined && (typeof req.query[key] !== 'string' || req.query[key].length > 36)) {
        throw new HttpError(422, 'VALIDATION_ERROR', `Campo inválido: ${key}`);
      }
    }
    const [rows] = await pool.execute(
      `SELECT DISTINCT u.id, u.name, u.email, u.status, i.id AS institutionId, i.name AS institutionName,
       s.id AS siteId, s.name AS siteName, s.district_id AS districtId, r.code AS role
       FROM institution_memberships m JOIN users u ON u.id = m.user_id
       JOIN institutions i ON i.id = m.institution_id JOIN sites s ON s.id = m.site_id
       JOIN roles r ON r.id = m.role_id
       ${superAdmin ? '' : "JOIN institution_memberships actor ON actor.institution_id = i.id AND actor.user_id = ? AND actor.active = TRUE AND (actor.site_id IS NULL OR actor.site_id = s.id) JOIN roles ar ON ar.id = actor.role_id AND ar.code = 'AdministradorInstitucional'"}
       WHERE m.active = TRUE AND (? IS NULL OR i.id = ?) AND (? IS NULL OR s.id = ?)
       ORDER BY u.name`,
      [...(superAdmin ? [] : [req.auth.user.id]), req.query.institutionId ?? null, req.query.institutionId ?? null,
        req.query.siteId ?? null, req.query.siteId ?? null],
    );
    res.json(rows);
  });
  router.post('/', async (req, res) => {
    const input = validateNewUser(req.body);
    if (input.role === 'AdministradorInstitucional' && !req.auth.roles.has('SuperAdministrador')) {
      throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    }
    const passwordHash = await hashPassword(input.password);
    const id = randomUUID();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const site = await scopeForSite(connection, req.auth, input.institutionId, input.siteId);
      const [[role]] = await connection.execute('SELECT id FROM roles WHERE code = ?', [input.role]);
      if (!role) throw new Error('Rol institucional no configurado');
      await connection.execute('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
        [id, input.name, input.email, passwordHash]);
      await connection.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, role.id]);
      await connection.execute('INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)',
        [id, input.institutionId, input.siteId, role.id]);
      await writeAudit(connection, req, 'user', 'user.create', { id, name: input.name, email: input.email,
        role: input.role, institutionId: input.institutionId, siteId: input.siteId, districtId: site.districtId, status: 'active' });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'CONFLICT', 'Correo ya registrado');
      throw error;
    } finally {
      connection.release();
    }
    res.status(201).json({ id, name: input.name, email: input.email, status: 'active',
      role: input.role, institutionId: input.institutionId, siteId: input.siteId });
  });
  router.patch('/:id', async (req, res) => {
    const input = requireObject(req.body);
    const update = {};
    if (input.name !== undefined) update.name = requireText(input.name, 'name', { max: 150 });
    if (input.status !== undefined) {
      if (!['active', 'inactive'].includes(input.status)) throw new HttpError(422, 'VALIDATION_ERROR', 'Estado inválido');
      update.status = input.status;
    }
    if (!Object.keys(update).length) throw new HttpError(422, 'VALIDATION_ERROR', 'No hay campos para actualizar');
    const keys = Object.keys(update);
    const result = await transaction(pool, async (connection) => {
      const [[before]] = await connection.execute('SELECT id, name, email, status FROM users WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!before) throw new HttpError(404, 'NOT_FOUND', 'Usuario no encontrado');
      const [memberships] = await connection.execute(
        `SELECT m.institution_id AS institutionId, m.site_id AS siteId, s.district_id AS districtId, r.code AS role
         FROM institution_memberships m JOIN roles r ON r.id = m.role_id LEFT JOIN sites s ON s.id = m.site_id
         WHERE m.user_id = ? AND m.active = TRUE FOR UPDATE`, [before.id],
      );
      if (!memberships.length) throw new HttpError(404, 'NOT_FOUND', 'Usuario no encontrado');
      const superAdmin = req.auth.roles.has('SuperAdministrador');
      const [roles] = await connection.execute('SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? FOR UPDATE', [before.id]);
      if (!superAdmin && (roles.some((role) => !['Operador', 'Ciudadano'].includes(role.code))
        || memberships.some((member) => member.role !== 'Operador' || !hasAdministrativeScope(req.auth, member.institutionId, member.siteId)))) {
        throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
      }
      await connection.execute(`UPDATE users SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`, [...keys.map((key) => update[key]), before.id]);
      const after = { ...before, ...update };
      for (const member of memberships) await writeAudit(connection, req, 'user', 'user.update', { ...after, ...member }, { ...before, ...member });
      return { ...after, ...memberships[0], memberships };
    });
    res.json(result);
  });
  return router;
}

module.exports = { createInstitutionalUsersRouter };
