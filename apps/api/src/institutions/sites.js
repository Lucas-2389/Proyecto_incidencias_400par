const express = require('express');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText, requireInteger } = require('../http/validation');
const { requireAuthentication, requireRoles, hasInstitutionScope, hasAdministrativeScope } = require('../auth/authorization');
const { parseCoordinate, canonicalDistrictId, resolvePoint, lockTerritory } = require('../territory/router');
const { transaction } = require('../db/transaction');
const { writeAudit } = require('../audit/write');

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
  ST_X(s.location) AS latitude, s.active, s.is_demo AS isDemo,
  s.territory_status AS territoryStatus, s.territory_version_id AS territoryVersionId,
  (SELECT name FROM districts WHERE id = s.district_id) AS districtName`;

function normalizeSite(row) {
  return { id: row.id, institutionId: row.institutionId, districtId: row.districtId,
    name: row.name, address: row.address, contactPhone: row.contactPhone,
    location: { latitude: row.latitude, longitude: row.longitude },
    active: Boolean(row.active), isDemo: Boolean(row.isDemo), territoryStatus: row.territoryStatus,
    territoryVersionId: row.territoryVersionId, districtName: row.districtName };
}

async function findSite(pool, id, lock = false) {
  const [rows] = await pool.execute(`SELECT ${siteColumns} FROM sites s WHERE s.id = ?${lock ? ' FOR UPDATE' : ''}`, [id]);
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
    const districtId = await canonicalDistrictId(pool, req.query.districtId);
    const [rows] = await pool.execute(
      `SELECT DISTINCT ${siteColumns} FROM sites s
       ${superAdmin ? '' : "JOIN institution_memberships m ON m.institution_id = s.institution_id AND m.user_id = ? AND m.active = TRUE JOIN roles r ON r.id = m.role_id AND ((r.code = 'AdministradorInstitucional' AND (m.site_id IS NULL OR m.site_id = s.id)) OR (r.code = 'Operador' AND m.site_id = s.id))"}
       WHERE (? IS NULL OR s.institution_id = ?) AND (? IS NULL OR s.district_id = ?) ORDER BY s.name`,
      [...(superAdmin ? [] : [req.auth.user.id]), id ?? null, id ?? null, districtId, districtId],
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
    if (!hasAdministrativeScope(req.auth, input.institutionId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const id = randomUUID();
    const result = await transaction(pool, async (connection) => {
      const versionId = await lockTerritory(connection);
      const [[institution]] = await connection.execute('SELECT active FROM institutions WHERE id = ? FOR SHARE', [input.institutionId]);
      if (!institution || !institution.active) throw new HttpError(422, 'VALIDATION_ERROR', 'Institución inactiva o inexistente');
      const territory = await siteTerritory(connection, input);
      await connection.execute(
        `INSERT INTO sites (id, institution_id, district_id, name, address, contact_phone, location, active, territory_status, territory_version_id)
         VALUES (?, ?, ?, ?, ?, ?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'), ?, ?, ?)`,
        [id, input.institutionId, territory.districtId, input.name, input.address ?? null,
          input.contactPhone ?? null, `POINT(${input.longitude} ${input.latitude})`, input.active ?? true, territory.status, versionId],
      );
      const after = normalizeSite(await findSite(connection, id));
      await writeAudit(connection, req, 'site', 'site.create', after);
      return after;
    });
    res.status(201).json(result);
  });
  router.patch('/:id', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const result = await transaction(pool, async (connection) => {
      const versionId = await lockTerritory(connection);
      const existing = await findSite(connection, req.params.id, true);
      if (!hasAdministrativeScope(req.auth, existing.institutionId, existing.id)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
      const input = siteInput(req.body, { partial: true });
      if (input.institutionId && input.institutionId !== existing.institutionId) {
        if (!req.auth.roles.has('SuperAdministrador')) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
        const [[target]] = await connection.execute('SELECT active FROM institutions WHERE id = ? FOR SHARE', [input.institutionId]);
        if (!target || !target.active) throw new HttpError(422, 'VALIDATION_ERROR', 'Institución inactiva o inexistente');
      }
      const columns = { institutionId: 'institution_id', districtId: 'district_id', name: 'name', address: 'address', contactPhone: 'contact_phone', active: 'active' };
      const keys = Object.keys(input).filter((key) => !['latitude', 'longitude', 'districtId'].includes(key));
      const setters = keys.map((key) => `${columns[key]} = ?`);
      const values = keys.map((key) => input[key]);
      if (input.latitude !== undefined) {
        setters.push("location = ST_GeomFromText(?, 4326, 'axis-order=long-lat')");
        values.push(`POINT(${input.longitude} ${input.latitude})`);
      }
      if (input.latitude !== undefined || input.districtId !== undefined) {
        const territory = await siteTerritory(connection, { latitude: input.latitude ?? existing.latitude,
          longitude: input.longitude ?? existing.longitude, districtId: input.districtId });
        setters.push('district_id = ?', 'territory_status = ?', 'territory_version_id = ?');
        values.push(territory.districtId, territory.status, versionId);
      }
      await connection.execute(`UPDATE sites SET ${setters.join(', ')} WHERE id = ?`, [...values, req.params.id]);
      const after = normalizeSite(await findSite(connection, req.params.id));
      await writeAudit(connection, req, 'site', 'site.update', after, normalizeSite(existing));
      return after;
    });
    res.json(result);
  });
  router.delete('/:id', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    await transaction(pool, async (connection) => {
      const existing = await findSite(connection, req.params.id, true);
      if (!hasAdministrativeScope(req.auth, existing.institutionId, existing.id)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
      await connection.execute('UPDATE sites SET active = FALSE WHERE id = ?', [req.params.id]);
      await writeAudit(connection, req, 'site', 'site.deactivate', { ...normalizeSite(existing), active: false }, normalizeSite(existing));
    });
    res.status(204).end();
  });
  return router;
}

async function siteTerritory(connection, input) {
  const result = await resolvePoint(connection, input.latitude, input.longitude);
  const declared = input.districtId == null ? null : await canonicalDistrictId(connection, String(input.districtId));
  if (declared) {
    const [[district]] = await connection.execute('SELECT id FROM districts WHERE id = ?', [declared]);
    if (!district) throw new HttpError(422, 'VALIDATION_ERROR', 'Distrito inválido');
  }
  if (declared && result.district && declared !== result.district.id) return { districtId: null, status: 'district_mismatch' };
  return { districtId: result.district?.id ?? declared, status: result.status };
}

module.exports = { createSitesRouter, siteInput };
