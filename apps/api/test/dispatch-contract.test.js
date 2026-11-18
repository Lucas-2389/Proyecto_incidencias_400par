const assert = require('node:assert/strict');
const test = require('node:test');
const { checkOpenApi } = require('../scripts/check-openapi');
const { createSuggestionsRouter } = require('../src/dispatch/suggestions');
const { createAssignmentsRouter } = require('../src/dispatch/assignments');
const { createOperationsRouter } = require('../src/dispatch/operations');

test('OpenAPI declara rutas reales y estados de despacho', () => {
  const contract = checkOpenApi();
  for (const router of [createSuggestionsRouter({}, {}), createAssignmentsRouter({}, {}), createOperationsRouter({}, {})]) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const path = ('/ops/incidents' + layer.route.path).replace(/\/$/, '').replace(/:([A-Za-z]+)/g, '{$1}');
      for (const method of Object.keys(layer.route.methods)) {
        const operation = contract.paths[path]?.[method];
        assert.ok(operation, `Falta ${method.toUpperCase()} ${path}`);
        assert.ok(operation.operationId);
        assert.ok(operation.responses);
      }
    }
  }
  assert.deepEqual(contract.components.schemas.VerifyIncidentRequest.properties.verificationStatus.enum,
    ['verified', 'unverifiable', 'false', 'duplicate']);
  const assignment = contract.components.schemas.CreateAssignmentRequest;
  assert.deepEqual(assignment.required, ['institutionId', 'siteId']);
  for (const field of ['unitIds', 'personnelIds']) {
    assert.equal(assignment.properties[field].type, 'array');
    assert.equal(assignment.properties[field].items.format, 'uuid');
    assert.equal(assignment.properties[field].maxItems, 30);
    assert.equal(assignment.properties[field].uniqueItems, true);
    assert.deepEqual(assignment.properties[field].default, []);
  }
  const examples = contract.paths['/ops/incidents/{id}/assignments'].post.requestBody.content['application/json'].examples;
  assert.ok(examples.withoutResources && examples.unitsOnly && examples.personnelOnly);
});
