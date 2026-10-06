const express = require('express');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { requireAuthentication, requireRoles, hasInstitutionScope } = require('../auth/authorization');

const institutionTypes = new Set(['pnp', 'samu', 'bomberos', 'municipalidad', 'otra']);

function institutionInput(body, { partial = false } = {}) {
  const input = requireObject(body);
  const result = {};
  if (!partial || input.name !== undefined) result.name = requireText(input.name, 'name', { max: 200 });
  if (!partial || input.type !== undefined) {
    result.type = requireText(input.type, 'type', { max: 30 });
    if (!institutionTypes.has(result.type)) throw new HttpError(422, 'VALIDATION_ERROR', 'Tipo institucional inválido');
  }
  if (input.contactPhone !== undefined) {
    result.contactPhone = input.contactPhone === null ? null : requireText(input.contactPhone, 'contactPhone', { max: 40 });
  }
  if (input.active !== undefined) {
    if (typeof input.active !== 'boolean') throw new HttpError(422, 'VALIDATION_ERROR', 'Estado inválido');
    result.active = input.active;
  }
  if (partial && Object.keys(result).length === 0) throw new HttpError(422, 'VALIDATION_ERROR', 'No hay campos para actualizar');
  return result;
}

function normalizeInstitution(row) {
  return { ...row, active: Boolean(row.active), isDemo: Boolean(row.isDemo) };
}

function createInstitutionsRouter(pool, authConfig) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador'));
  router.get('/', async (req, res) => {
    const superAdmin = req.auth.roles.has('SuperAdministrador');
    const [rows] = await pool.execute(
      `SELECT DISTINCT i.id, i.name, i.type, i.contact_phone AS contactPhone, i.active, i.is_demo AS isDemo
       FROM institutions i
       ${superAdmin ? '' : 'JOIN institution_memberships m ON m.institution_id = i.id AND m.user_id = ? AND m.active = TRUE'}
       ORDER BY i.name`, superAdmin ? [] : [req.auth.user.id],
    );
    res.json(rows.map(normalizeInstitution));
  });
  router.get('/:id', async (req, res) => {
    if (!hasInstitutionScope(req.auth, req.params.id)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const [rows] = await pool.execute('SELECT id, name, type, contact_phone AS contactPhone, active, is_demo AS isDemo FROM institutions WHERE id = ?', [req.params.id]);
    if (!rows.length) throw new HttpError(404, 'NOT_FOUND', 'Institución no encontrada');
    res.json(normalizeInstitution(rows[0]));
  });
  router.post('/', requireRoles('SuperAdministrador'), async (req, res) => {
    const input = institutionInput(req.body);
    const id = randomUUID();
    await pool.execute('INSERT INTO institutions (id, name, type, contact_phone, active) VALUES (?, ?, ?, ?, ?)',
      [id, input.name, input.type, input.contactPhone ?? null, input.active ?? true]);
    res.status(201).json({ id, name: input.name, type: input.type, contactPhone: input.contactPhone ?? null, active: input.active ?? true, isDemo: false });
  });
  router.patch('/:id', requireRoles('SuperAdministrador'), async (req, res) => {
    const input = institutionInput(req.body, { partial: true });
    const fields = Object.keys(input);
    const columns = { name: 'name', type: 'type', contactPhone: 'contact_phone', active: 'active' };
    const [result] = await pool.execute(`UPDATE institutions SET ${fields.map((key) => `${columns[key]} = ?`).join(', ')} WHERE id = ?`,
      [...fields.map((key) => input[key]), req.params.id]);
    if (!result.affectedRows) throw new HttpError(404, 'NOT_FOUND', 'Institución no encontrada');
    const [[row]] = await pool.execute('SELECT id, name, type, contact_phone AS contactPhone, active, is_demo AS isDemo FROM institutions WHERE id = ?', [req.params.id]);
    res.json(normalizeInstitution(row));
  });
  router.delete('/:id', requireRoles('SuperAdministrador'), async (req, res) => {
    const [result] = await pool.execute('UPDATE institutions SET active = FALSE WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) throw new HttpError(404, 'NOT_FOUND', 'Institución no encontrada');
    res.status(204).end();
  });
  return router;
}

module.exports = { createInstitutionsRouter, institutionInput };
