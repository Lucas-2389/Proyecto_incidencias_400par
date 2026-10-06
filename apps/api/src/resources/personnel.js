const express = require('express');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireText } = require('../http/validation');
const { requireAuthentication, requireRoles, hasInstitutionScope } = require('../auth/authorization');
const { nullableText, scopeInput, assertSiteScope, findResource, listScope, queryScope, duplicateError } = require('./common');

const columns = 'id, institution_id AS institutionId, site_id AS siteId, code, name, role_description AS roleDescription, active, is_demo AS isDemo';
function normalize(row) { return { ...row, active: Boolean(row.active), isDemo: Boolean(row.isDemo) }; }

function validate(body, options) {
  const { input, result } = scopeInput(body, options);
  if (!options?.partial || input.name !== undefined) result.name = requireText(input.name, 'name', { max: 150 });
  if (input.roleDescription !== undefined) result.roleDescription = nullableText(input.roleDescription, 'roleDescription', 100);
  if (input.active !== undefined) {
    if (typeof input.active !== 'boolean') throw new HttpError(422, 'VALIDATION_ERROR', 'Estado inválido');
    result.active = input.active;
  }
  if (options?.partial && !Object.keys(result).length) throw new HttpError(422, 'VALIDATION_ERROR', 'No hay campos para actualizar');
  return result;
}

function createPersonnelRouter(pool, authConfig) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador'));
  router.get('/', async (req, res) => {
    const scope = listScope(req.auth);
    const [rows] = await pool.execute(
      `SELECT DISTINCT r.id, r.institution_id AS institutionId, r.site_id AS siteId, r.code, r.name,
       r.role_description AS roleDescription, r.active, r.is_demo AS isDemo FROM personnel r ${scope.join}
       WHERE (? IS NULL OR r.institution_id = ?) AND (? IS NULL OR r.site_id = ?) ORDER BY r.name`,
      [...scope.params, ...queryScope(req)],
    );
    res.json(rows.map(normalize));
  });
  router.get('/:id', async (req, res) => {
    const row = await findResource(pool, 'personnel', req.params.id, columns);
    if (!hasInstitutionScope(req.auth, row.institutionId, row.siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    res.json(normalize(row));
  });
  router.post('/', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const input = validate(req.body);
    await assertSiteScope(pool, req.auth, input.institutionId, input.siteId);
    const id = randomUUID();
    try {
      await pool.execute('INSERT INTO personnel (id, institution_id, site_id, code, name, role_description, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, input.institutionId, input.siteId, input.code, input.name, input.roleDescription ?? null, input.active ?? true]);
    } catch (error) { duplicateError(error); }
    res.status(201).json(normalize(await findResource(pool, 'personnel', id, columns)));
  });
  router.patch('/:id', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const existing = await findResource(pool, 'personnel', req.params.id, columns);
    if (!hasInstitutionScope(req.auth, existing.institutionId, existing.siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const input = validate(req.body, { partial: true });
    if (input.institutionId && input.institutionId !== existing.institutionId) throw new HttpError(422, 'VALIDATION_ERROR', 'No se puede cambiar de institución');
    if (input.siteId) await assertSiteScope(pool, req.auth, existing.institutionId, input.siteId);
    const map = { siteId: 'site_id', code: 'code', name: 'name', roleDescription: 'role_description', active: 'active' };
    const keys = Object.keys(input).filter((key) => key !== 'institutionId');
    if (!keys.length) throw new HttpError(422, 'VALIDATION_ERROR', 'No hay campos para actualizar');
    try {
      await pool.execute(`UPDATE personnel SET ${keys.map((key) => `${map[key]} = ?`).join(', ')} WHERE id = ?`, [...keys.map((key) => input[key]), req.params.id]);
    } catch (error) { duplicateError(error); }
    res.json(normalize(await findResource(pool, 'personnel', req.params.id, columns)));
  });
  router.delete('/:id', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const existing = await findResource(pool, 'personnel', req.params.id, columns);
    if (!hasInstitutionScope(req.auth, existing.institutionId, existing.siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const [[busy]] = await pool.execute('SELECT id FROM personnel_assignments WHERE personnel_id = ? AND released_at IS NULL LIMIT 1', [existing.id]);
    if (busy) throw new HttpError(409, 'CONFLICT', 'Personal asignado a una atención activa');
    await pool.execute('UPDATE personnel SET active = FALSE WHERE id = ?', [existing.id]);
    res.status(204).end();
  });
  return router;
}

module.exports = { createPersonnelRouter };
