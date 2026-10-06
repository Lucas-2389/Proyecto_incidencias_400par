const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText, requireInteger } = require('../http/validation');
const { parseCoordinate, resolvePoint } = require('../territory/router');

function optionalDate(value, name, { defaultNow = false } = {}) {
  if (value === undefined || value === null) return defaultNow ? new Date().toISOString() : null;
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new HttpError(422, 'VALIDATION_ERROR', `Fecha inválida: ${name}`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.UTC(2000, 0, 1) || parsed.getTime() > Date.now() + 300000) {
    throw new HttpError(422, 'VALIDATION_ERROR', `Fecha inválida: ${name}`);
  }
  return parsed.toISOString();
}

function parsePositiveId(value, name) {
  const integer = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value;
  return requireInteger(integer, name, { min: 1 });
}

function validateLocation(value, { required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(422, 'VALIDATION_ERROR', 'Ubicación requerida');
    return null;
  }
  const input = requireObject(value, 'location');
  const latitude = parseCoordinate(String(input.latitude), 'latitude', -90, 90);
  const longitude = parseCoordinate(String(input.longitude), 'longitude', -180, 180);
  const accuracyMeters = input.accuracyMeters === undefined || input.accuracyMeters === null
    ? null : Number(input.accuracyMeters);
  if (accuracyMeters !== null && (!Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 1000000)) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Precisión inválida');
  }
  return { latitude, longitude, accuracyMeters,
    capturedAt: optionalDate(input.capturedAt, 'capturedAt'),
    reference: input.reference === undefined || input.reference === null ? null : requireText(input.reference, 'reference', { max: 500 }) };
}

function validateReport(body, { locationRequired = true } = {}) {
  const input = requireObject(body);
  return {
    categoryId: parsePositiveId(input.categoryId, 'categoryId'),
    subcategoryId: input.subcategoryId == null ? null : parsePositiveId(input.subcategoryId, 'subcategoryId'),
    description: requireText(input.description, 'description', { max: 2000 }),
    affectedPeople: input.affectedPeople == null ? null : requireInteger(input.affectedPeople, 'affectedPeople'),
    occurredAt: optionalDate(input.occurredAt, 'occurredAt'),
    location: validateLocation(input.location, { required: locationRequired }),
    callerContact: input.callerContact == null ? null : requireText(input.callerContact, 'callerContact', { max: 100 }),
  };
}

function requestKey(header, body) {
  const supplied = body?.clientRequestId;
  if (header && supplied && header !== supplied) throw new HttpError(400, 'VALIDATION_ERROR', 'Claves de solicitud distintas');
  const key = header || supplied;
  if (typeof key !== 'string' || key.length < 1 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Idempotency-Key requerida');
  }
  return key;
}

function receipt(row) {
  return { id: row.id, reference: row.reference, status: row.status,
    verified: row.verification_status === 'verified', source: row.source,
    createdAt: new Date(row.created_at).toISOString() };
}

function mysqlDate(iso) {
  return iso.slice(0, 23).replace('T', ' ');
}

async function priorRequest(pool, scopeType, scopeId, key, hash) {
  const [[row]] = await pool.execute(
    `SELECT cr.request_hash AS requestHash, i.id, i.reference, i.status, i.verification_status,
     i.source, i.created_at FROM client_requests cr JOIN incidents i ON i.id = cr.incident_id
     WHERE cr.scope_type = ? AND cr.scope_id = ? AND cr.idempotency_key = ?`, [scopeType, scopeId, key],
  );
  if (!row) return null;
  if (row.requestHash !== hash) throw new HttpError(409, 'CONFLICT', 'Clave de solicitud reutilizada con otro contenido');
  return receipt(row);
}

async function createReport(pool, body, { source, reporterUserId = null, creatorUserId = null,
  scopeType, scopeId, key, locationRequired = true } = {}) {
  const input = validateReport(body, { locationRequired });
  const hash = createHash('sha256').update(JSON.stringify({ source, input })).digest('hex');
  const prior = await priorRequest(pool, scopeType, scopeId, key, hash);
  if (prior) return { receipt: prior, repeated: true };
  const [[category]] = await pool.execute(
    'SELECT id, default_priority AS defaultPriority FROM incident_categories WHERE id = ? AND active = TRUE', [input.categoryId],
  );
  if (!category) throw new HttpError(422, 'VALIDATION_ERROR', 'Categoría inválida');
  if (input.subcategoryId !== null) {
    const [[subcategory]] = await pool.execute(
      'SELECT id FROM incident_subcategories WHERE id = ? AND category_id = ? AND active = TRUE', [input.subcategoryId, category.id],
    );
    if (!subcategory) throw new HttpError(422, 'VALIDATION_ERROR', 'Subcategoría inválida');
  }
  const territory = input.location ? await resolvePoint(pool, input.location.latitude, input.location.longitude) : null;
  const id = randomUUID();
  const reference = `INC-${new Date().getUTCFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO incidents (id, reference, reporter_user_id, created_by_user_id, category_id, subcategory_id,
       source, description, affected_people, occurred_at, priority, caller_contact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, reference, reporterUserId, creatorUserId, input.categoryId, input.subcategoryId,
        source, input.description, input.affectedPeople, mysqlDate(input.occurredAt ?? new Date().toISOString()), category.defaultPriority, input.callerContact],
    );
    if (input.location) {
      await connection.execute(
        `INSERT INTO incident_locations (incident_id, location_point, accuracy_meters, captured_at, reference_text,
         district_id, sector_id) VALUES (?, ST_GeomFromText(?, 4326, 'axis-order=long-lat'), ?, ?, ?, ?, ?)`,
        [id, `POINT(${input.location.longitude} ${input.location.latitude})`, input.location.accuracyMeters,
          input.location.capturedAt ? mysqlDate(input.location.capturedAt) : null,
          input.location.reference, territory.district?.id ?? null, territory.sector?.id ?? null],
      );
    }
    await connection.execute(
      "INSERT INTO incident_history (incident_id, actor_user_id, event_type, new_value, note) VALUES (?, ?, 'created', 'reported', ?)",
      [id, creatorUserId || reporterUserId, source === 'PHONE' ? 'Reporte telefónico' : 'Reporte móvil'],
    );
    await connection.execute(
      'INSERT INTO client_requests (scope_type, scope_id, idempotency_key, request_hash, incident_id) VALUES (?, ?, ?, ?, ?)',
      [scopeType, scopeId, key, hash, id],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      const repeated = await priorRequest(pool, scopeType, scopeId, key, hash);
      if (repeated) return { receipt: repeated, repeated: true };
    }
    throw error;
  } finally { connection.release(); }
  const [[row]] = await pool.execute('SELECT id, reference, status, verification_status, source, created_at FROM incidents WHERE id = ?', [id]);
  return { receipt: receipt(row), repeated: false };
}

module.exports = { validateReport, validateLocation, requestKey, createReport };
