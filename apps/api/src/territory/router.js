const express = require('express');
const { HttpError } = require('../http/errors');

function parseId(value, name) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new HttpError(422, 'VALIDATION_ERROR', `Campo inválido: ${name}`);
  }
  return Number(value);
}

function parseCoordinate(value, name, minimum, maximum) {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new HttpError(422, 'VALIDATION_ERROR', `Campo inválido: ${name}`);
  }
  return parsed;
}

function normalizeTerritory(row) {
  return { ...row, isDemo: Boolean(row.isDemo) };
}

async function resolvePoint(pool, latitude, longitude) {
  const point = `POINT(${longitude} ${latitude})`;
  const [districts] = await pool.execute(
    `SELECT d.id, d.code, d.name, d.is_demo AS isDemo,
       MAX(ST_Contains(b.area, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))) AS interior
     FROM district_boundaries b JOIN districts d ON d.id = b.district_id
     WHERE ST_Intersects(b.area, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))
     GROUP BY d.id, d.code, d.name, d.is_demo ORDER BY d.id`, [point, point],
  );
  if (districts.length !== 1 || !districts[0].interior) {
    const status = districts.length === 0 ? 'outside_coverage'
      : districts.some((district) => !district.interior) ? 'boundary' : 'overlap';
    return { latitude, longitude, district: null, sector: null, status };
  }
  const { interior, ...row } = districts[0];
  const district = normalizeTerritory(row);
  const [sectors] = await pool.execute(
    `SELECT s.id, s.code, s.name, s.is_demo AS isDemo
     FROM sector_boundaries b JOIN sectors s ON s.id = b.sector_id
     WHERE s.district_id = ? AND ST_Intersects(b.area, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))
     ORDER BY s.id LIMIT 1`, [district.id, point],
  );
  return { latitude, longitude, district, sector: sectors[0] ? normalizeTerritory(sectors[0]) : null, status: 'resolved' };
}

const metropolitanScope = 'ayacucho-metropolitan';

function validateScope(value) {
  if (value !== undefined && value !== metropolitanScope) throw new HttpError(422, 'VALIDATION_ERROR', 'Ámbito territorial inválido');
  return value ?? null;
}

async function canonicalDistrictId(pool, value) {
  const districtId = parseId(value, 'districtId');
  if (districtId === null) return null;
  const [[alias]] = await pool.execute('SELECT district_id AS districtId FROM district_aliases WHERE legacy_id = ?', [districtId]);
  return alias?.districtId ?? districtId;
}

async function lockTerritory(connection) {
  const [[state]] = await connection.execute('SELECT version_id AS versionId FROM territory_state WHERE scope = ? FOR SHARE', [metropolitanScope]);
  return state?.versionId ?? null;
}

function createTerritoryRouter(pool) {
  const router = express.Router();
  const lists = [
    ['/departments', 'SELECT id, code, name, is_demo AS isDemo FROM departments ORDER BY name', null],
    ['/provinces', 'SELECT id, department_id AS departmentId, code, name, is_demo AS isDemo FROM provinces WHERE (? IS NULL OR department_id = ?) ORDER BY name', 'departmentId'],
    ['/sectors', 'SELECT id, district_id AS districtId, code, name, is_demo AS isDemo FROM sectors WHERE (? IS NULL OR district_id = ?) ORDER BY name', 'districtId'],
  ];
  router.get('/districts', async (req, res) => {
    const provinceId = parseId(req.query.provinceId, 'provinceId');
    const scope = validateScope(req.query.scope);
    const [rows] = await pool.execute(
      `SELECT d.id, d.province_id AS provinceId, d.code, d.name, d.is_demo AS isDemo
       FROM districts d WHERE (? IS NULL OR d.province_id = ?)
       AND NOT EXISTS (SELECT 1 FROM district_aliases a WHERE a.legacy_id = d.id)
       AND (? IS NULL OR EXISTS (SELECT 1 FROM territory_scope_districts t WHERE t.district_id = d.id AND t.scope = ?))
       ORDER BY d.name`, [provinceId, provinceId, scope, scope],
    );
    res.json(rows.map(normalizeTerritory));
  });
  router.get('/districts/boundaries', async (req, res) => {
    validateScope(req.query.scope);
    const [[version]] = await pool.execute(
      `SELECT v.id, v.metadata FROM territory_state t JOIN territory_versions v ON v.id = t.version_id WHERE t.scope = ?`, [metropolitanScope],
    );
    if (!version) throw new HttpError(503, 'TERRITORY_UNAVAILABLE', 'Cartografía metropolitana pendiente de cargar');
    const [rows] = await pool.execute(
      `SELECT d.id, d.code, d.name, ST_AsGeoJSON(b.area) AS geometry
       FROM territory_scope_districts t JOIN districts d ON d.id = t.district_id
       JOIN district_boundaries b ON b.district_id = d.id WHERE t.scope = ? ORDER BY d.code`, [metropolitanScope],
    );
    const features = rows.map((row) => {
      const geometry = typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry;
      const points = geometry.coordinates.flat(2);
      return { type: 'Feature', properties: { id: row.id, code: row.code, name: row.name }, geometry,
        bbox: [Math.min(...points.map(([x]) => x)), Math.min(...points.map(([, y]) => y)),
          Math.max(...points.map(([x]) => x)), Math.max(...points.map(([, y]) => y))] };
    });
    const metadata = typeof version.metadata === 'string' ? JSON.parse(version.metadata) : version.metadata;
    res.json({ ...metadata, type: 'FeatureCollection', version: version.id, features });
  });
  for (const [path, sql, filter] of lists) {
    router.get(path, async (req, res) => {
      const id = filter === 'districtId' ? await canonicalDistrictId(pool, req.query[filter])
        : filter ? parseId(req.query[filter], filter) : null;
      const [rows] = await pool.execute(sql, filter ? [id, id] : []);
      res.json(rows.map(normalizeTerritory));
    });
  }
  router.get('/resolve', async (req, res) => {
    const latitude = parseCoordinate(req.query.latitude, 'latitude', -90, 90);
    const longitude = parseCoordinate(req.query.longitude, 'longitude', -180, 180);
    res.json(await resolvePoint(pool, latitude, longitude));
  });
  return router;
}

module.exports = { createTerritoryRouter, resolvePoint, parseCoordinate, parseId, canonicalDistrictId, lockTerritory, metropolitanScope };
