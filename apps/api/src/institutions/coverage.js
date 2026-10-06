const express = require('express');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { requireAuthentication, requireRoles, hasInstitutionScope } = require('../auth/authorization');
const { parseCoordinate } = require('../territory/router');

function polygonInput(body) {
  const input = requireObject(body);
  const name = requireText(input.name, 'name', { max: 200 });
  const points = input.coordinates;
  if (!Array.isArray(points) || points.length < 4 || points.length > 1000) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Polígono inválido');
  }
  const ring = points.map((point) => {
    if (!Array.isArray(point) || point.length !== 2) throw new HttpError(422, 'VALIDATION_ERROR', 'Polígono inválido');
    return [parseCoordinate(String(point[0]), 'longitude', -180, 180), parseCoordinate(String(point[1]), 'latitude', -90, 90)];
  });
  if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Polígono no cerrado');
  }
  const wkt = `MULTIPOLYGON(((${ring.map(([lon, lat]) => `${lon} ${lat}`).join(',')})))`;
  return { name, wkt };
}

async function getSite(pool, id) {
  const [[site]] = await pool.execute('SELECT id, institution_id AS institutionId FROM sites WHERE id = ?', [id]);
  if (!site) throw new HttpError(404, 'NOT_FOUND', 'Sede no encontrada');
  return site;
}

async function getZone(pool, id) {
  const [[zone]] = await pool.execute(
    'SELECT z.id, z.site_id AS siteId, s.institution_id AS institutionId, z.name, z.active, z.is_demo AS isDemo, ST_AsGeoJSON(z.area) AS geojson FROM site_coverage_zones z JOIN sites s ON s.id = z.site_id WHERE z.id = ?', [id],
  );
  if (!zone) throw new HttpError(404, 'NOT_FOUND', 'Cobertura no encontrada');
  return { id: zone.id, siteId: zone.siteId, institutionId: zone.institutionId, name: zone.name,
    active: Boolean(zone.active), isDemo: Boolean(zone.isDemo), geometry: zone.geojson };
}

function createCoverageRouter(pool, authConfig) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador'));
  router.get('/candidates', async (req, res) => {
    const latitude = parseCoordinate(req.query.latitude, 'latitude', -90, 90);
    const longitude = parseCoordinate(req.query.longitude, 'longitude', -180, 180);
    const point = `POINT(${longitude} ${latitude})`;
    const superAdmin = req.auth.roles.has('SuperAdministrador');
    const [rows] = await pool.execute(
      `SELECT DISTINCT s.id AS siteId, s.institution_id AS institutionId, s.name AS siteName
       FROM site_coverage_zones z JOIN sites s ON s.id = z.site_id AND s.active = TRUE
       JOIN institutions i ON i.id = s.institution_id AND i.active = TRUE
       ${superAdmin ? '' : "JOIN institution_memberships m ON m.institution_id = i.id AND m.user_id = ? AND m.active = TRUE JOIN roles r ON r.id = m.role_id AND ((r.code = 'AdministradorInstitucional' AND (m.site_id IS NULL OR m.site_id = s.id)) OR (r.code = 'Operador' AND m.site_id = s.id))"}
       WHERE z.active = TRUE AND ST_Intersects(z.area, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))
       ORDER BY s.name`, [...(superAdmin ? [] : [req.auth.user.id]), point],
    );
    res.json(rows);
  });
  router.get('/sites/:siteId', async (req, res) => {
    const site = await getSite(pool, req.params.siteId);
    if (!hasInstitutionScope(req.auth, site.institutionId, site.id)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const [rows] = await pool.execute('SELECT id FROM site_coverage_zones WHERE site_id = ? ORDER BY id', [site.id]);
    res.json(await Promise.all(rows.map((row) => getZone(pool, row.id))));
  });
  router.post('/sites/:siteId', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const site = await getSite(pool, req.params.siteId);
    if (!hasInstitutionScope(req.auth, site.institutionId, site.id)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const input = polygonInput(req.body);
    try {
      const [[validity]] = await pool.execute("SELECT ST_IsValid(ST_GeomFromText(?, 4326, 'axis-order=long-lat')) AS valid", [input.wkt]);
      if (!validity.valid) throw new HttpError(422, 'VALIDATION_ERROR', 'Polígono inválido');
      const [result] = await pool.execute("INSERT INTO site_coverage_zones (site_id, name, area) VALUES (?, ?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))", [site.id, input.name, input.wkt]);
      res.status(201).json(await getZone(pool, result.insertId));
    } catch (error) {
      if (error.code?.startsWith('ER_GIS') || error.code === 'ER_GEOMETRY_PARAM_LONGITUDE_OUT_OF_RANGE') throw new HttpError(422, 'VALIDATION_ERROR', 'Polígono inválido');
      throw error;
    }
  });
  router.patch('/:id', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const zone = await getZone(pool, req.params.id);
    if (!hasInstitutionScope(req.auth, zone.institutionId, zone.siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    const input = requireObject(req.body);
    if (Object.hasOwn(input, 'active')) {
      if (typeof input.active !== 'boolean') throw new HttpError(422, 'VALIDATION_ERROR', 'Estado inválido');
      await pool.execute('UPDATE site_coverage_zones SET active = ? WHERE id = ?', [input.active, zone.id]);
    } else {
      throw new HttpError(422, 'VALIDATION_ERROR', 'No hay campos para actualizar');
    }
    res.json(await getZone(pool, zone.id));
  });
  router.delete('/:id', requireRoles('SuperAdministrador', 'AdministradorInstitucional'), async (req, res) => {
    const zone = await getZone(pool, req.params.id);
    if (!hasInstitutionScope(req.auth, zone.institutionId, zone.siteId)) throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    await pool.execute('UPDATE site_coverage_zones SET active = FALSE WHERE id = ?', [zone.id]);
    res.status(204).end();
  });
  return router;
}

module.exports = { createCoverageRouter, polygonInput };
