const assert = require('node:assert/strict');
const test = require('node:test');
const { checkOpenApi } = require('../scripts/check-openapi');

test('OpenAPI parsea y enumera los cuatro roles y rutas iniciales', () => {
  const contract = checkOpenApi();
  assert.equal(contract['x-access-roles'].length, 4);
  assert.ok(contract.paths['/api/health']);
  assert.ok(contract.paths['/api/health/database']);
  assert.ok(contract.paths['/auth/register']);
});

test('OpenAPI rechaza roles incompletos y claves YAML repetidas', () => {
  assert.throws(() => checkOpenApi('openapi: 3.0.3\npaths: {}\ncomponents: {}\nx-access-roles: []\n'), /cuatro roles/);
  assert.throws(() => checkOpenApi('openapi: 3.0.3\nopenapi: 3.0.3\n'), /claves repetidas/);
});
