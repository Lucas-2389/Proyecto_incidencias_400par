const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { requireObject, requireText, requireInteger } = require('../http/validation');
const { parseCoordinate, resolvePoint } = require('../territory/router');
const { sendBestEffort } = require('../notifications/sender');

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
  const callerContact = input.callerContact == null || input.callerContact === ''
    ? null : requireText(input.callerContact, 'callerContact', { max: 20 });
  if (callerContact && (!/^\+?[0-9 ()-]{7,20}$/.test(callerContact)
    || callerContact.replace(/\D/g, '').length < 7 || callerContact.replace(/\D/g, '').length > 15)) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Teléfono de contacto inválido');
  }
  return {
    categoryId: parsePositiveId(input.categoryId, 'categoryId'),
    subcategoryId: input.subcategoryId == null ? null : parsePositiveId(input.subcategoryId, 'subcategoryId'),
    description: requireText(input.description, 'description', { max: 2000 }),
    affectedPeople: input.affectedPeople == null ? null : requireInteger(input.affectedPeople, 'affectedPeople'),
    occurredAt: optionalDate(input.occurredAt, 'occurredAt'),
    location: validateLocation(input.location, { required: locationRequired }),
    callerContact,
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

async function newReportRecipients(connection, incidentId) {
  const [rows] = await connection.execute(
    `SELECT DISTINCT recipient.userId FROM (
       SELECT ur.user_id AS userId FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id AND r.code = 'SuperAdministrador'
       UNION
       SELECT m.user_id AS userId FROM institution_memberships m
       JOIN roles r ON r.id = m.role_id AND r.code IN ('AdministradorInstitucional', 'Operador')
       JOIN institutions inst ON inst.id = m.institution_id AND inst.active = TRUE
       JOIN sites s ON s.institution_id = inst.id AND s.active = TRUE
       JOIN site_coverage_zones z ON z.site_id = s.id AND z.active = TRUE
       JOIN incidents i ON i.id = ?
       JOIN incident_locations l ON l.incident_id = i.id
       JOIN routing_rules rr ON rr.institution_type = inst.type AND rr.category_id = i.category_id
         AND rr.active = TRUE AND (rr.subcategory_id IS NULL OR rr.subcategory_id = i.subcategory_id)
       WHERE m.active = TRUE AND (m.site_id IS NULL OR m.site_id = s.id)
         AND ST_Intersects(z.area, l.location_point)
     ) recipient JOIN users u ON u.id = recipient.userId AND u.status = 'active'`,
    [incidentId],
  );
  return rows.map((row) => row.userId);
}

async function createReport(pool, body, { source, reporterUserId = null, creatorUserId = null,
  scopeType, scopeId, key, locationRequired = true, notificationSender = null } = {}) {
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
  const notifications = [];
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
    const recipients = await newReportRecipients(connection, id);
    for (const userId of recipients) {
      if (userId === reporterUserId || userId === creatorUserId) continue;
      const notification = {
        id: randomUUID(), userId, incidentId: id, type: 'incident_created',
        title: 'Nuevo reporte', message: `El reporte ${reference} requiere revisión.`,
      };
      await connection.execute(
        'INSERT INTO notifications (id, user_id, incident_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)',
        [notification.id, userId, id, notification.type, notification.title, notification.message],
      );
      notifications.push(notification);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      const repeated = await priorRequest(pool, scopeType, scopeId, key, hash);
      if (repeated) return { receipt: repeated, repeated: true };
    }
    throw error;
  } finally { connection.release(); }
  await Promise.all(notifications.map((notification) => sendBestEffort(notificationSender, notification)));
  const [[row]] = await pool.execute('SELECT id, reference, status, verification_status, source, created_at FROM incidents WHERE id = ?', [id]);
  return { receipt: receipt(row), repeated: false };
}

module.exports = { validateReport, validateLocation, requestKey, createReport };
