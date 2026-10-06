const assert = require('node:assert/strict');
const test = require('node:test');
const { checkOpenApi } = require('../scripts/check-openapi');
const { createCatalogRouter } = require('../src/incidents/catalog');
const { createIncidentsRouter, createPhoneReportRouter } = require('../src/incidents/router');
const { createEvidenceRouter } = require('../src/incidents/evidence');

test('OpenAPI declara las rutas reales de catálogo, reportes y evidencias', () => {
  const contract = checkOpenApi();
  for (const [prefix, router] of [
    ['/catalog', createCatalogRouter({}, {})],
    ['/incidents', createIncidentsRouter({}, {})],
    ['/incidents', createEvidenceRouter({}, {}, {})],
    ['/ops/incidents', createPhoneReportRouter({}, {})],
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
  assert.equal(contract.paths['/incidents/{id}/evidence'].post.responses['413'].$ref,
    '#/components/responses/PayloadTooLarge');
  assert.equal(contract.paths['/incidents'].post.responses['200'].description.includes('Reintento'), true);
  assert.deepEqual(contract.components.schemas.Coordinates.required, ['latitude', 'longitude']);
});
