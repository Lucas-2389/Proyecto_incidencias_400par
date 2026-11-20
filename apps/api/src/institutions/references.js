const express = require('express');
const { requireAuthentication, requireRoles } = require('../auth/authorization');
const { HttpError } = require('../http/errors');
const { requireObject, requireText } = require('../http/validation');
const { transaction } = require('../db/transaction');
const { writeAudit } = require('../audit/write');
const { referenceDistrictContains } = require('./reference-geometry');

function validateReview(body) {
  const input = requireObject(body);
  if (input.clear === true) return { clear: true };
  if (typeof input.latitude !== 'number' || typeof input.longitude !== 'number'
    || !Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)
    || input.latitude < -16 || input.latitude > -11 || input.longitude < -76 || input.longitude > -72) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Indica coordenadas numéricas de Ayacucho');
  }
  if (!['institutional_map', 'field_review', 'user_report'].includes(input.method)) throw new HttpError(422, 'VALIDATION_ERROR', 'Método de revisión inválido');
  const source = requireText(input.source, 'source', { max: 1000 });
  let url;
  try { url = new URL(source); } catch { throw new HttpError(422, 'VALIDATION_ERROR', 'Fuente inválida'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new HttpError(422, 'VALIDATION_ERROR', 'Fuente inválida');
  return { latitude: input.latitude, longitude: input.longitude, method: input.method, source,
    notes: requireText(input.notes, 'notes', { max: 2000 }) };
}
const columns = `id, name, institution_type AS institutionType, district_code AS districtCode, address,
  sources, notes, latitude, longitude, verification_method AS verificationMethod,
  location_source AS locationSource, reviewed_at AS reviewedAt`;
function normalize(row) {
  return { ...row, sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources,
    latitude: row.latitude === null ? null : Number(row.latitude), longitude: row.longitude === null ? null : Number(row.longitude),
    status: row.reviewedAt && row.latitude !== null && row.longitude !== null ? 'location_reviewed' : 'pending_location' };
}
function createReferencesRouter(pool, authConfig) {
  const router = express.Router();
  router.use(requireAuthentication(pool, authConfig), requireRoles('SuperAdministrador', 'AdministradorInstitucional', 'Operador'));
  router.get('/', async (_req, res) => {
    const [rows] = await pool.execute(`SELECT ${columns} FROM site_references ORDER BY institution_type, name LIMIT 1000`);
    res.set('Cache-Control', 'no-store'); res.json(rows.map(normalize));
  });
  router.patch('/:id', requireRoles('SuperAdministrador'), async (req, res) => {
    const input = validateReview(req.body);
    const result = await transaction(pool, async connection => {
      const [[before]] = await connection.execute(`SELECT ${columns} FROM site_references WHERE id = ? FOR UPDATE`, [req.params.id]);
      if (!before) throw new HttpError(404, 'NOT_FOUND', 'Referencia no encontrada');
      if (!input.clear) {
        if (!await referenceDistrictContains(connection, before.districtCode, input.latitude, input.longitude)) {
          throw new HttpError(422, 'VALIDATION_ERROR', 'El punto no está en el interior del distrito de la referencia según la cartografía regional de consulta');
        }
      }
      await connection.execute(`UPDATE site_references SET latitude=?, longitude=?, verification_method=?, location_source=?,
        notes=?, reviewed_at=?, reviewed_by=? WHERE id=?`, [input.clear ? null : input.latitude, input.clear ? null : input.longitude,
        input.clear ? null : input.method, input.clear ? null : input.source, input.clear ? before.notes : input.notes,
        input.clear ? null : new Date(), input.clear ? null : req.auth.user.id, req.params.id]);
      const [[after]] = await connection.execute(`SELECT ${columns} FROM site_references WHERE id=?`, [req.params.id]);
      await writeAudit(connection, req, 'site_reference', input.clear ? 'site_reference.clear' : 'site_reference.review', normalize(after), normalize(before));
      return normalize(after);
    });
    res.json(result);
  });
  router.patch('/:id/details', requireRoles('SuperAdministrador'), async (req, res) => {
    const input = requireObject(req.body);
    const name = requireText(input.name, 'name', { max: 200 });
    const address = requireText(input.address, 'address', { max: 300 });
    await transaction(pool, async connection => {
      const [[before]] = await connection.execute(`SELECT ${columns} FROM site_references WHERE id=? FOR UPDATE`, [req.params.id]);
      if (!before) throw new HttpError(404, 'NOT_FOUND', 'Referencia no encontrada');
      await connection.execute('UPDATE site_references SET name=?, address=? WHERE id=?', [name, address, req.params.id]);
      await writeAudit(connection, req, 'site_reference', 'site_reference.edit', { ...normalize(before), name, address }, normalize(before));
    });
    res.json({ status: 'ok' });
  });
  router.delete('/:id', requireRoles('SuperAdministrador'), async (req, res) => {
    await transaction(pool, async connection => {
      const [[before]] = await connection.execute(`SELECT ${columns} FROM site_references WHERE id=? FOR UPDATE`, [req.params.id]);
      if (!before) throw new HttpError(404, 'NOT_FOUND', 'Referencia no encontrada');
      await connection.execute('DELETE FROM site_references WHERE id=?', [req.params.id]);
      await writeAudit(connection, req, 'site_reference', 'site_reference.delete', { id: req.params.id }, normalize(before));
    });
    res.status(204).end();
  });
  return router;
}
module.exports = { createReferencesRouter, validateReview, normalize };
