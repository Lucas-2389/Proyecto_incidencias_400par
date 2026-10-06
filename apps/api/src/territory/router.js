const express = require('express');
const { HttpError } = require('../http/errors');

function parseId(value, name) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
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
    `SELECT d.id, d.code, d.name, d.is_demo AS isDemo
     FROM district_boundaries b JOIN districts d ON d.id = b.district_id
     WHERE ST_Intersects(b.area, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))
     ORDER BY d.id LIMIT 1`, [point],
  );
  if (!districts.length) return { latitude, longitude, district: null, sector: null };
  const district = normalizeTerritory(districts[0]);
  const [sectors] = await pool.execute(
    `SELECT s.id, s.code, s.name, s.is_demo AS isDemo
     FROM sector_boundaries b JOIN sectors s ON s.id = b.sector_id
     WHERE s.district_id = ? AND ST_Intersects(b.area, ST_GeomFromText(?, 4326, 'axis-order=long-lat'))
     ORDER BY s.id LIMIT 1`, [district.id, point],
  );
  return { latitude, longitude, district, sector: sectors[0] ? normalizeTerritory(sectors[0]) : null };
}

function createTerritoryRouter(pool) {
  const router = express.Router();
  const lists = [
    ['/departments', 'SELECT id, code, name, is_demo AS isDemo FROM departments ORDER BY name', null],
    ['/provinces', 'SELECT id, department_id AS departmentId, code, name, is_demo AS isDemo FROM provinces WHERE (? IS NULL OR department_id = ?) ORDER BY name', 'departmentId'],
    ['/districts', 'SELECT id, province_id AS provinceId, code, name, is_demo AS isDemo FROM districts WHERE (? IS NULL OR province_id = ?) ORDER BY name', 'provinceId'],
    ['/sectors', 'SELECT id, district_id AS districtId, code, name, is_demo AS isDemo FROM sectors WHERE (? IS NULL OR district_id = ?) ORDER BY name', 'districtId'],
  ];
  for (const [path, sql, filter] of lists) {
    router.get(path, async (req, res) => {
      const id = filter ? parseId(req.query[filter], filter) : null;
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

module.exports = { createTerritoryRouter, resolvePoint, parseCoordinate };
