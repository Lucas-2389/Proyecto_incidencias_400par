const express = require('express');
const { HttpError } = require('../http/errors');
const { requireAuthentication, requireRoles, hasIncidentScope, hasInstitutionScope } = require('../auth/authorization');

const MAX_DAYS = 90;
const MAX_ROWS = 5000;
const MIN_PUBLIC_COUNT = 3;

function positiveId(value, name) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new HttpError(422, 'VALIDATION_ERROR', `Filtro inválido: ${name}`);
  }
  return Number(value);
}

function parseFilters(query) {
  const from = new Date(query.from);
  const to = new Date(query.to);
  if (typeof query.from !== 'string' || typeof query.to !== 'string' || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())
    || to <= from || to.getTime() - from.getTime() > MAX_DAYS * 86400000) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Intervalo inválido o mayor a 90 días');
  }
  const type = query.type ?? null;
  if (type !== null && !['emergency', 'security'].includes(type)) throw new HttpError(422, 'VALIDATION_ERROR', 'Tipo inválido');
  const hour = query.hour === undefined ? null : Number(query.hour);
  if (hour !== null && (typeof query.hour !== 'string' || !/^\d{1,2}$/.test(query.hour) || hour > 23)) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Hora inválida');
  }
  const institutionId = query.institutionId ?? null;
  if (institutionId !== null && (typeof institutionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(institutionId))) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Institución inválida');
  }
  return { from, to, type, hour, institutionId,
    categoryId: positiveId(query.categoryId, 'categoryId'), districtId: positiveId(query.districtId, 'districtId') };
}

function databaseDate(date) { return date.toISOString().slice(0, 23).replace('T', ' '); }

async function loadIncidentRows(pool, filters) {
  const [rows] = await pool.execute(
    `SELECT i.id, i.reference, i.status, i.category_id AS categoryId, i.created_at AS createdAt,
      c.family, (c.is_sensitive OR COALESCE(sc.is_sensitive, FALSE)) AS isSensitive,
      l.district_id AS districtId, ST_X(l.location_point) AS latitude, ST_Y(l.location_point) AS longitude
     FROM incidents i JOIN incident_locations l ON l.incident_id = i.id
     JOIN incident_categories c ON c.id = i.category_id
     LEFT JOIN incident_subcategories sc ON sc.id = i.subcategory_id
     WHERE i.created_at >= ? AND i.created_at < ?
       AND (? IS NULL OR c.family = ?) AND (? IS NULL OR i.category_id = ?)
       AND (? IS NULL OR HOUR(i.created_at) = ?) AND (? IS NULL OR l.district_id = ?)
       AND (? IS NULL OR EXISTS (SELECT 1 FROM institution_assignments ia WHERE ia.incident_id = i.id AND ia.institution_id = ?))
     ORDER BY i.created_at, i.id LIMIT ${MAX_ROWS + 1}`,
    [databaseDate(filters.from), databaseDate(filters.to), filters.type, filters.type,
      filters.categoryId, filters.categoryId, filters.hour, filters.hour,
      filters.districtId, filters.districtId, filters.institutionId, filters.institutionId],
  );
  if (rows.length > MAX_ROWS) throw new HttpError(422, 'QUERY_LIMIT', 'Consulta demasiado amplia; reduzca el intervalo');
  return rows;
}

function aggregatePublic(rows) {
  const cells = new Map();
  for (const row of rows) {
    const sensitive = Boolean(row.isSensitive);
    const size = sensitive ? 0.2 : 0.05;
    const latitudeIndex = Math.floor(Number(row.latitude) / size);
    const longitudeIndex = Math.floor(Number(row.longitude) / size);
    const key = `${sensitive ? 's' : 'n'}:${row.categoryId}:${latitudeIndex}:${longitudeIndex}`;
    const cell = cells.get(key) ?? { cellId: key, count: 0,
      latitude: Number(((latitudeIndex + 0.5) * size).toFixed(4)),
      longitude: Number(((longitudeIndex + 0.5) * size).toFixed(4)),
      cellSizeDegrees: size };
    cell.count += 1;
    cells.set(key, cell);
  }
  return [...cells.values()].filter((cell) => cell.count >= MIN_PUBLIC_COUNT)
    .sort((a, b) => a.cellId.localeCompare(b.cellId));
}

async function operationalRows(pool, auth, rows) {
  const visible = [];
  for (const row of rows) {
    if (await hasIncidentScope(pool, auth, row.id)) visible.push(row);
  }
  return visible;
}

function createGeospatialRouter(pool, authConfig) {
  const router = express.Router();
  router.get('/public/heatmap', async (req, res) => {
    const filters = parseFilters(req.query);
    res.json(aggregatePublic(await loadIncidentRows(pool, filters)));
  });
  const secure = [requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador')];
  router.get('/ops/map', ...secure, async (req, res) => {
    const filters = parseFilters(req.query);
    if (filters.institutionId && !hasInstitutionScope(req.auth, filters.institutionId)) {
      throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    }
    const incidents = await operationalRows(pool, req.auth, await loadIncidentRows(pool, filters));
    const [sites] = await pool.execute(
      `SELECT s.id, s.institution_id AS institutionId, s.name,
        ST_X(s.location) AS latitude, ST_Y(s.location) AS longitude
       FROM sites s WHERE s.active = TRUE AND (? IS NULL OR s.institution_id = ?) ORDER BY s.name LIMIT 501`,
      [filters.institutionId, filters.institutionId],
    );
    if (sites.length > 500) throw new HttpError(422, 'QUERY_LIMIT', 'Demasiadas sedes');
    res.json({ incidents: incidents.map((row) => ({ id: row.id, reference: row.reference, status: row.status,
      categoryId: row.categoryId, latitude: Number(row.latitude), longitude: Number(row.longitude) })),
    sites: sites.filter((site) => hasInstitutionScope(req.auth, site.institutionId, site.id))
      .map((site) => ({ ...site, latitude: Number(site.latitude), longitude: Number(site.longitude) })) });
  });
  router.get('/ops/stats', ...secure, async (req, res) => {
    const filters = parseFilters(req.query);
    if (filters.institutionId && !hasInstitutionScope(req.auth, filters.institutionId)) {
      throw new HttpError(403, 'FORBIDDEN', 'Acceso no permitido');
    }
    const rows = await operationalRows(pool, req.auth, await loadIncidentRows(pool, filters));
    const byStatus = {};
    const byCategory = {};
    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      byCategory[row.categoryId] = (byCategory[row.categoryId] ?? 0) + 1;
    }
    const ids = rows.map((row) => row.id);
    let averageAssignmentMinutes = null;
    if (ids.length) {
      const [times] = await pool.query(
        `SELECT ia.institution_id AS institutionId, ia.site_id AS siteId,
           TIMESTAMPDIFF(SECOND, i.created_at, ia.assigned_at) / 60 AS minutes
         FROM institution_assignments ia JOIN incidents i ON i.id = ia.incident_id
         WHERE ia.incident_id IN (${ids.map(() => '?').join(',')})
           AND (? IS NULL OR ia.institution_id = ?)`, [...ids, filters.institutionId, filters.institutionId],
      );
      const visibleTimes = times.filter((time) => hasInstitutionScope(req.auth, time.institutionId, time.siteId));
      if (visibleTimes.length) averageAssignmentMinutes = Number((visibleTimes.reduce((sum, time) => sum + Number(time.minutes), 0) / visibleTimes.length).toFixed(2));
    }
    res.json({ total: rows.length, byStatus, byCategory, averageAssignmentMinutes });
  });
  return router;
}

module.exports = { createGeospatialRouter, parseFilters, aggregatePublic, loadIncidentRows };
