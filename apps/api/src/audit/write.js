const allowedFields = new Set(['id', 'name', 'email', 'phone', 'contactPhone', 'status', 'active', 'type', 'role',
  'institutionId', 'siteId', 'districtId', 'address', 'scope', 'location', 'latitude', 'longitude', 'territoryStatus']);

function auditFields(value) {
  if (!value) return null;
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowedFields.has(key)));
}

async function writeAudit(connection, req, entityType, action, after, before = null) {
  const districtId = after.districtId ?? before?.districtId ?? null;
  await connection.execute(
    `INSERT INTO audit_logs (actor_user_id, institution_id, site_id, district_id, correlation_id,
       action, entity_type, entity_id, before_data, after_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.auth.user.id, after.institutionId ?? null, entityType === 'site' ? after.id : after.siteId ?? null,
      districtId, req.correlationId, action, entityType, after.id,
      before ? JSON.stringify(auditFields(before)) : null, JSON.stringify(auditFields(after))],
  );
}

module.exports = { writeAudit };
