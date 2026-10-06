const express = require('express');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText, requireInteger } = require('../http/validation');
const { requireAuthentication, requireRoles, hasInstitutionScope } = require('../auth/authorization');
const { parseCoordinate } = require('../territory/router');

function siteInput(body, { partial = false } = {}) {
  const input = requireObject(body);
  const result = {};
  if (!partial || input.institutionId !== undefined) result.institutionId = requireText(input.institutionId, 'institutionId', { max: 36 });
  if (!partial || input.name !== undefined) result.name = requireText(input.name, 'name', { max: 200 });
  if (!partial || input.location !== undefined) {
    const location = requireObject(input.location, 'location');
    result.latitude = parseCoordinate(String(location.latitude), 'latitude', -90, 90);
    result.longitude = parseCoordinate(String(location.longitude), 'longitude', -180, 180);
  }
  if (input.districtId !== undefined) result.districtId = input.districtId === null ? null : requireInteger(input.districtId, 'districtId', { min: 1 });
  if (input.address !== undefined) result.address = input.address === null ? null : requireText(input.address, 'address', { max: 300 });
  if (input.contactPhone !== undefined) result.contactPhone = input.contactPhone === null ? null : requireText(input.contactPhone, 'contactPhone', { max: 40 });
  if (input.active !== undefined) {
    if (typeof input.active !== 'boolean') throw new HttpError(422, 'VALIDATION_ERROR', 'Estado inválido');
    result.active = input.active;
  }
  if (partial && Object.keys(result).length === 0) throw new HttpError(422, 'VALIDATION_ERROR', 'No hay campos para actualizar');
  return result;
}

const siteColumns = `s.id, s.institution_id AS institutionId, s.district_id AS districtId, s.name,
  s.address, s.contact_phone AS contactPhone, ST_Y(s.location) AS longitude,
  ST_X(s.location) AS latitude, s.active, s.is_demo AS isDemo`;

function normalizeSite(row) {
  return { id: row.id, institutionId: row.institutionId, districtId: row.districtId,
    name: row.name, address: row.address, contactPhone: row.contactPhone,
    location: { latitude: row.latitude, longitude: row.longitude },
    active: Boolean(row.active), isDemo: Boolean(row.isDemo) };
}

async function findSite(pool, id) {
  const [rows] = await pool.execute(`SELECT ${siteColumns} FROM sites s WHERE s.id = ?`, [id]);
  if (!rows.length) throw new HttpError(404, 'NOT_FOUND', 'Sede no encontrada');
  return rows[0];
}

function createSitesRouter(pool, authConfig) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador'));
  router.get('/', async (req, res) => {
    const id = req.query.institutionId;
    if (id !== undefined && (typeof id !== 'string' || id.length > 36)) throw new HttpError(422, 'VALIDATION_ERROR', 'Institución inválida');
    const superAdmin = req.auth.roles.has('SuperAdministrador');
    const [rows] = await pool.execute(
      `SELECT DISTINCT ${siteColumns} FROM sites s
       ${superAdmin ? '' : "JOIN institution_memberships m ON m.institution_id = s.institution_id AND m.user_id = ? AND m.active = TRUE JOIN roles r ON r.id = m.role_id AND ((r.code = 'AdministradorInstitucional' AND (m.site_id IS NULL OR m.site_id = s.id)) OR (r.code = 'Operador' AND m.site_id = s.id))"}
       WHERE (? IS NULL OR s.institution_id = ?) ORDER BY s.name`,
      [...(superAdmin ? [] : [req.auth.user.id]), id ?? null, id ?? null],
    );
    res.json(rows.map(normalizeSite));
  });
  router.get('/:id', async (req, res) => {
    const row = await findSite(pool, req.params.id);
    if (!hasInstitutionScope(req.auth, row.institutionId, row.id)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    res.json(normalizeSite(row));
  });
  router.post('/', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const input = siteInput(req.body);
    if (!hasInstitutionScope(req.auth, input.institutionId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const [[institution]] = await pool.execute('SELECT active FROM institutions WHERE id = ?', [input.institutionId]);
    if (!institution || !institution.active) throw new HttpError(422, 'VALIDATION_ERROR', 'Institución inactiva o inexistente');
    const id = randomUUID();
    try {
      await pool.execute(
        `INSERT INTO sites (id, institution_id, district_id, name, address, contact_phone, location, active)
         VALUES (?, ?, ?, ?, ?, ?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'), ?)`,
        [id, input.institutionId, input.districtId ?? null, input.name, input.address ?? null,
          input.contactPhone ?? null, `POINT(${input.longitude} ${input.latitude})`, input.active ?? true],
      );
    } catch (error) {
      if (error.code === 'ER_NO_REFERENCED_ROW_2') throw new HttpError(422, 'VALIDATION_ERROR', 'Distrito inválido');
      throw error;
    }
    res.status(201).json(normalizeSite(await findSite(pool, id)));
  });
  router.patch('/:id', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const existing = await findSite(pool, req.params.id);
    if (!hasInstitutionScope(req.auth, existing.institutionId, existing.id)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const input = siteInput(req.body, { partial: true });
    if (input.institutionId && input.institutionId !== existing.institutionId) {
      if (!req.auth.roles.has('SuperAdministrador')) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
      const [[target]] = await pool.execute('SELECT active FROM institutions WHERE id = ?', [input.institutionId]);
      if (!target || !target.active) throw new HttpError(422, 'VALIDATION_ERROR', 'Institución inactiva o inexistente');
    }
    const columns = { institutionId: 'institution_id', districtId: 'district_id', name: 'name', address: 'address', contactPhone: 'contact_phone', active: 'active' };
    const keys = Object.keys(input).filter((key) => key !== 'latitude' && key !== 'longitude');
    const setters = keys.map((key) => `${columns[key]} = ?`);
    const values = keys.map((key) => input[key]);
    if (input.latitude !== undefined) {
      setters.push("location = ST_GeomFromText(?, 4326, 'axis-order=long-lat')");
      values.push(`POINT(${input.longitude} ${input.latitude})`);
    }
    try {
      await pool.execute(`UPDATE sites SET ${setters.join(', ')} WHERE id = ?`, [...values, req.params.id]);
    } catch (error) {
      if (error.code === 'ER_NO_REFERENCED_ROW_2') throw new HttpError(422, 'VALIDATION_ERROR', 'Distrito inválido');
      throw error;
    }
    res.json(normalizeSite(await findSite(pool, req.params.id)));
  });
  router.delete('/:id', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const existing = await findSite(pool, req.params.id);
    if (!hasInstitutionScope(req.auth, existing.institutionId, existing.id)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    await pool.execute('UPDATE sites SET active = FALSE WHERE id = ?', [req.params.id]);
    res.status(204).end();
  });
  return router;
}

module.exports = { createSitesRouter, siteInput };
