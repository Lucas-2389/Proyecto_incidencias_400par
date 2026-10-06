const assert = require('node:assert/strict');
const test = require('node:test');
const { checkOpenApi } = require('../scripts/check-openapi');
const { createGeospatialRouter } = require('../src/geospatial/router');
const { createDirectoryRouter } = require('../src/directory/router');

test('OpenAPI cubre rutas reales de mapa, estadísticas y directorio', () => {
  const contract = checkOpenApi();
  for (const router of [createGeospatialRouter({}, {}), createDirectoryRouter({}, {})]) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const path = layer.route.path.replace(/:([A-Za-z]+)/g, '{$1}');
      for (const method of Object.keys(layer.route.methods)) {
        const operation = contract.paths[path]?.[method];
        assert.ok(operation, `Falta ${method.toUpperCase()} ${path}`);
        assert.ok(operation.operationId);
        assert.ok(operation.responses);
      }
    }
  }
  assert.equal(contract.components.schemas.HeatmapCell.properties.count.minimum, 3);
});
