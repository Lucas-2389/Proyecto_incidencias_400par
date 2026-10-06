const assert = require('node:assert/strict');
const test = require('node:test');
const { checkOpenApi } = require('../scripts/check-openapi');
const { createTerritoryRouter } = require('../src/territory/router');
const { createInstitutionsRouter } = require('../src/institutions/router');
const { createSitesRouter } = require('../src/institutions/sites');
const { createCoverageRouter } = require('../src/institutions/coverage');
const { createInstitutionalUsersRouter } = require('../src/institutions/users');

test('OpenAPI declara todos los métodos de territorio y organización montados por Express', () => {
  const contract = checkOpenApi();
  const groups = [
    ['/territory', createTerritoryRouter({})],
    ['/admin/institutions', createInstitutionsRouter({}, {})],
    ['/admin/sites', createSitesRouter({}, {})],
    ['/admin/coverage', createCoverageRouter({}, {})],
    ['/admin/users', createInstitutionalUsersRouter({}, {})],
  ];
  for (const [prefix, router] of groups) {
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
});
