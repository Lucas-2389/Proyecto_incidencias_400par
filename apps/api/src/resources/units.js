const express = require('express');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { requireAuthentication, requireRoles, hasInstitutionScope } = require('../auth/authorization');
const { nullableText, scopeInput, assertSiteScope, findResource, listScope, queryScope, duplicateError } = require('./common');

const transitions = Object.freeze({
  available: new Set(['assigned', 'maintenance', 'out_of_service']),
  assigned: new Set(['en_route', 'available']),
  en_route: new Set(['attending', 'returning']),
  attending: new Set(['returning']),
  returning: new Set(['available', 'maintenance']),
  maintenance: new Set(['available', 'out_of_service']),
  out_of_service: new Set(['available', 'maintenance']),
});

const columns = 'id, institution_id AS institutionId, site_id AS siteId, code, plate, type, capacity_description AS capacityDescription, status, is_demo AS isDemo';
function normalize(row) { return { ...row, isDemo: Boolean(row.isDemo) }; }

function validate(body, options) {
  const { input, result } = scopeInput(body, options);
  if (!options?.partial || input.type !== undefined) result.type = requireText(input.type, 'type', { max: 80 });
  if (input.plate !== undefined) result.plate = nullableText(input.plate, 'plate', 30);
  if (input.capacityDescription !== undefined) result.capacityDescription = nullableText(input.capacityDescription, 'capacityDescription', 200);
  if (options?.partial && !Object.keys(result).length) throw new HttpError(422, 'VALIDATION_ERROR', 'No hay campos para actualizar');
  return result;
}

async function changeStatus(pool, id, actorId, status, note) {
  if (!Object.hasOwn(transitions, status)) throw new HttpError(422, 'VALIDATION_ERROR', 'Estado inválido');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id, status FROM units WHERE id = ? FOR UPDATE', [id]);
    if (!rows.length) throw new HttpError(404, 'NOT_FOUND', 'Unidad no encontrada');
    const previous = rows[0].status;
    if (!transitions[previous].has(status)) throw new HttpError(409, 'CONFLICT', 'Transición de estado no permitida');
    const [[assignment]] = await connection.execute('SELECT id FROM unit_assignments WHERE unit_id = ? AND released_at IS NULL LIMIT 1', [id]);
    if (['available', 'maintenance', 'out_of_service'].includes(status) && assignment) {
      throw new HttpError(409, 'CONFLICT', 'Unidad asignada a una atención activa');
    }
    if (['assigned', 'en_route', 'attending', 'returning'].includes(status) && !assignment) {
      throw new HttpError(409, 'CONFLICT', 'Unidad sin asignación activa');
    }
    await connection.execute('UPDATE units SET status = ? WHERE id = ?', [status, id]);
    await connection.execute('INSERT INTO unit_status_history (unit_id, actor_user_id, previous_status, new_status, note) VALUES (?, ?, ?, ?, ?)',
      [id, actorId, previous, status, note]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

function createUnitsRouter(pool, authConfig) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador'));
  router.get('/', async (req, res) => {
    const scope = listScope(req.auth);
    const availability = req.query.available;
    if (availability !== undefined && availability !== 'true' && availability !== 'false') throw new HttpError(422, 'VALIDATION_ERROR', 'Filtro inválido');
    const [rows] = await pool.execute(
      `SELECT DISTINCT r.id, r.institution_id AS institutionId, r.site_id AS siteId, r.code, r.plate,
       r.type, r.capacity_description AS capacityDescription, r.status, r.is_demo AS isDemo
       FROM units r ${scope.join}
       WHERE (? IS NULL OR r.institution_id = ?) AND (? IS NULL OR r.site_id = ?)
       AND (? = 'false' OR r.status = 'available') ORDER BY r.code`,
      [...scope.params, ...queryScope(req), availability ?? 'false'],
    );
    res.json(rows.map(normalize));
  });
  router.get('/:id', async (req, res) => {
    const row = await findResource(pool, 'units', req.params.id, columns);
    if (!hasInstitutionScope(req.auth, row.institutionId, row.siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    res.json(normalize(row));
  });
  router.post('/', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const input = validate(req.body);
    await assertSiteScope(pool, req.auth, input.institutionId, input.siteId);
    const id = randomUUID();
    try {
      await pool.execute('INSERT INTO units (id, institution_id, site_id, code, plate, type, capacity_description) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, input.institutionId, input.siteId, input.code, input.plate ?? null, input.type, input.capacityDescription ?? null]);
    } catch (error) { duplicateError(error); }
    res.status(201).json(normalize(await findResource(pool, 'units', id, columns)));
  });
  router.patch('/:id', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const existing = await findResource(pool, 'units', req.params.id, columns);
    if (!hasInstitutionScope(req.auth, existing.institutionId, existing.siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const input = validate(req.body, { partial: true });
    if (input.institutionId && input.institutionId !== existing.institutionId) throw new HttpError(422, 'VALIDATION_ERROR', 'No se puede cambiar de institución');
    if (input.siteId) {
      await assertSiteScope(pool, req.auth, existing.institutionId, input.siteId);
      if (input.siteId !== existing.siteId && existing.status !== 'available') throw new HttpError(409, 'CONFLICT', 'Unidad no disponible para cambio de sede');
    }
    const map = { siteId: 'site_id', code: 'code', plate: 'plate', type: 'type', capacityDescription: 'capacity_description' };
    const keys = Object.keys(input).filter((key) => key !== 'institutionId');
    if (!keys.length) throw new HttpError(422, 'VALIDATION_ERROR', 'No hay campos para actualizar');
    try {
      await pool.execute(`UPDATE units SET ${keys.map((key) => `${map[key]} = ?`).join(', ')} WHERE id = ?`, [...keys.map((key) => input[key]), req.params.id]);
    } catch (error) { duplicateError(error); }
    res.json(normalize(await findResource(pool, 'units', req.params.id, columns)));
  });
  router.patch('/:id/status', requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador'), async (req, res) => {
    const existing = await findResource(pool, 'units', req.params.id, columns);
    if (!hasInstitutionScope(req.auth, existing.institutionId, existing.siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const input = requireObject(req.body);
    const status = requireText(input.status, 'status', { max: 30 });
    const note = input.note === undefined ? null : nullableText(input.note, 'note', 500);
    await changeStatus(pool, existing.id, req.auth.user.id, status, note);
    res.json(normalize(await findResource(pool, 'units', existing.id, columns)));
  });
  router.delete('/:id', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const existing = await findResource(pool, 'units', req.params.id, columns);
    if (!hasInstitutionScope(req.auth, existing.institutionId, existing.siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    if (existing.status !== 'available' && existing.status !== 'maintenance') throw new HttpError(409, 'CONFLICT', 'Unidad en uso');
    await changeStatus(pool, existing.id, req.auth.user.id, 'out_of_service', 'Unidad retirada del inventario activo');
    res.status(204).end();
  });
  return router;
}

module.exports = { createUnitsRouter, changeStatus, transitions };
