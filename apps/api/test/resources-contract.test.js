const assert = require('node:assert/strict');
const test = require('node:test');
const { checkOpenApi } = require('../scripts/check-openapi');
const { createPersonnelRouter } = require('../src/resources/personnel');
const { createUnitsRouter } = require('../src/resources/units');

test('OpenAPI documenta cada ruta real de recursos y estados', () => {
  const contract = checkOpenApi();
  for (const [prefix, router] of [
    ['/resources/personnel', createPersonnelRouter({}, {})],
    ['/resources/units', createUnitsRouter({}, {})],
  ]) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const path = (prefix + layer.route.path).replace(/\/$/, '').replace(/:([A-Za-z]+)/g, '{$1}');
      for (const method of Object.keys(layer.route.methods)) {
        const operation = contract.paths[path]?.[method];
        assert.ok(operation, `Falta ${method.toUpperCase()} ${path}`);
        assert.ok(operation.operationId);
        assert.ok(operation.responses);
      }
    }
  }
  assert.deepEqual(contract.components.schemas.UnitStatus.enum,
    ['available', 'assigned', 'en_route', 'attending', 'returning', 'maintenance', 'out_of_service']);
});
