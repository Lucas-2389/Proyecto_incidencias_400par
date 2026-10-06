const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const auditedPrefixes = ['/admin/', '/resources/', '/catalog/', '/territory/'];
function auditPath(req) { return req.originalUrl.split('?')[0].replace(/^\/api\/v1/, ''); }

function auditMutation(pool) {
  return (req, res, next) => {
    if (!pool || !['POST', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);
    let recorded = false;
    function needsAudit() {
      const path = auditPath(req);
      if (res.statusCode < 400 && (path.startsWith('/admin/directory') || path.startsWith('/admin/alerts'))) return false;
      return Boolean(req.auth) && ((res.statusCode === 403 &&
        [...auditedPrefixes, '/ops/'].some((prefix) => path.startsWith(prefix)))
        || (res.statusCode < 400 && auditedPrefixes.some((prefix) => path.startsWith(prefix))));
    }
    async function record(body) {
      const denied = res.statusCode === 403;
      const parts = auditPath(req).split('/').filter(Boolean);
      const entityType = denied ? 'authorization'
        : ['admin', 'resources', 'catalog', 'territory'].includes(parts[0]) ? parts[1] ?? parts[0] : parts[0];
      const entityId = !denied && typeof body?.id === 'string' && body.id.length <= 64 ? body.id
        : parts.find((part) => uuid.test(part)) ?? 'collection';
      let institutionId = !denied && uuid.test(body?.institutionId ?? '') ? body.institutionId : null;
      let siteId = !denied && uuid.test(body?.siteId ?? '') ? body.siteId : null;
      if (!denied && !req.auth.roles.has('SuperAdministrador')) {
        if (!siteId && uuid.test(req.body?.siteId ?? '')) siteId = req.body.siteId;
        if (!institutionId && siteId) {
          const [[site]] = await pool.execute('SELECT institution_id AS institutionId FROM sites WHERE id = ?', [siteId]);
          institutionId = site?.institutionId ?? null;
        }
        if (!institutionId) {
          const memberships = req.auth.memberships.filter((membership) => membership.role === 'AdministradorInstitucional');
          if (memberships.length === 1) {
            institutionId = memberships[0].institution_id;
            siteId = siteId ?? memberships[0].site_id;
          }
        }
      }
      const fields = denied ? null : Object.fromEntries(['status', 'active', 'institutionId', 'siteId', 'districtId']
        .filter((key) => body && Object.hasOwn(body, key)).map((key) => [key, body[key]]));
      await pool.execute(
        `INSERT INTO audit_logs (actor_user_id, institution_id, site_id, correlation_id, action,
         entity_type, entity_id, after_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.auth.user.id, institutionId, siteId, req.correlationId,
          denied ? 'access.denied' : `${entityType}.${req.method.toLowerCase()}`,
          entityType, entityId, fields ? JSON.stringify(fields) : null],
      );
    }
    res.json = (body) => {
      if (!recorded && needsAudit()) {
        recorded = true;
        Promise.resolve().then(() => record(body)).then(() => originalJson(body)).catch((error) => next(error));
        return res;
      }
      return originalJson(body);
    };
    res.end = (...args) => {
      if (!recorded && needsAudit()) {
        recorded = true;
        Promise.resolve().then(() => record(null)).then(() => originalEnd(...args)).catch((error) => next(error));
        return res;
      }
      return originalEnd(...args);
    };
    next();
  };
}

module.exports = { auditMutation };
