const assert = require('node:assert/strict');
const test = require('node:test');
const { checkOpenApi } = require('../scripts/check-openapi');
const { createAlertsRouter } = require('../src/alerts/router');
const { createNotificationsRouter } = require('../src/notifications/router');
const { createAuditRouter } = require('../src/audit/router');

test('OpenAPI declara rutas reales de alertas, notificaciones y auditoría', () => {
  const contract = checkOpenApi();
  const routers = [
    [createAlertsRouter({}, {}), ''],
    [createNotificationsRouter({}, {}), '/notifications'],
    [createAuditRouter({}, {}), '/admin/audit'],
  ];
  for (const [router, prefix] of routers) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const path = `${prefix}${layer.route.path}`.replace(/\/$/, '').replace(/:([A-Za-z]+)/g, '{$1}');
      for (const method of Object.keys(layer.route.methods)) {
        const operation = contract.paths[path]?.[method];
        assert.ok(operation, `Falta ${method.toUpperCase()} ${path}`);
        assert.ok(operation.operationId);
        assert.ok(operation.responses);
      }
    }
  }
});
