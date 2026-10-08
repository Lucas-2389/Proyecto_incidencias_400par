const { HttpError } = require('../http/errors');

function parsePagination(value, name, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new HttpError(422, 'VALIDATION_ERROR', `Campo inválido: ${name}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new HttpError(422, 'VALIDATION_ERROR', `Campo inválido: ${name}`);
  return parsed;
}

async function listMine(pool, userId, query) {
  const limit = parsePagination(query.limit, 'limit', 50, 1, 100);
  const offset = parsePagination(query.offset, 'offset', 0, 0, 1000000);
  const [rows] = await pool.execute(
    `SELECT id, reference, category_id AS categoryId, status, verification_status AS verificationStatus,
     source, created_at AS createdAt FROM incidents WHERE reporter_user_id = ?
     ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [userId, limit, offset],
  );
  return rows.map((row) => ({ id: row.id, reference: row.reference, categoryId: row.categoryId,
    status: row.status, verified: row.verificationStatus === 'verified', source: row.source,
    createdAt: new Date(row.createdAt).toISOString() }));
}

async function incidentDetail(pool, id, auth) {
  const [[row]] = await pool.execute(
    `SELECT i.id, i.reference, i.reporter_user_id AS reporterId, i.category_id AS categoryId,
     i.subcategory_id AS subcategoryId, i.description, i.affected_people AS affectedPeople,
     i.status, i.verification_status AS verificationStatus, i.priority, i.source,
     i.caller_contact AS callerContact,
     i.occurred_at AS occurredAt, i.created_at AS createdAt,
     ST_X(l.location_point) AS latitude, ST_Y(l.location_point) AS longitude,
     l.accuracy_meters AS accuracyMeters, l.captured_at AS capturedAt, l.reference_text AS locationReference
     FROM incidents i LEFT JOIN incident_locations l ON l.incident_id = i.id WHERE i.id = ?`, [id],
  );
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Reporte no encontrado');
  const [evidence] = await pool.execute('SELECT id, media_type AS mediaType, created_at AS uploadedAt FROM evidence WHERE incident_id = ? ORDER BY created_at', [id]);
  const detail = {
    id: row.id, reference: row.reference, categoryId: row.categoryId, subcategoryId: row.subcategoryId,
    description: row.description, affectedPeople: row.affectedPeople, status: row.status,
    verified: row.verificationStatus === 'verified', source: row.source,
    occurredAt: new Date(row.occurredAt).toISOString(), createdAt: new Date(row.createdAt).toISOString(),
    location: row.latitude === null ? null : {
      latitude: row.latitude, longitude: row.longitude,
      accuracyMeters: row.accuracyMeters === null ? null : Number(row.accuracyMeters),
      capturedAt: row.capturedAt ? new Date(row.capturedAt).toISOString() : null,
      reference: row.locationReference,
    },
    evidence: evidence.map((photo) => ({ id: photo.id, mediaType: photo.mediaType,
      uploadedAt: new Date(photo.uploadedAt).toISOString() })),
  };
  if (auth.roles.has('Operador') || auth.roles.has('AdministradorInstitucional') || auth.roles.has('SuperAdministrador')) {
    detail.priority = row.priority;
    detail.verificationStatus = row.verificationStatus;
    detail.callerContact = row.callerContact;
  }
  return detail;
}

module.exports = { listMine, incidentDetail };
