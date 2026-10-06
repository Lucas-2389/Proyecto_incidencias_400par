const assert = require('node:assert/strict');
const test = require('node:test');
const { checkOpenApi } = require('../scripts/check-openapi');
const { createAuthRouter } = require('../src/auth/router');

test('OpenAPI declara las rutas, métodos, solicitudes y respuestas de autenticación', () => {
  const contract = checkOpenApi();
  const router = createAuthRouter({}, {}, {});
  const expected = {
    '/register': { status: '201', request: 'RegisterRequest' },
    '/login': { status: '200', request: 'LoginRequest' },
    '/refresh': { status: '200', request: 'RefreshRequest' },
    '/logout': { status: '204', request: 'RefreshRequest' },
    '/password-reset/request': { status: '202', request: 'PasswordResetRequest' },
    '/password-reset/confirm': { status: '200', request: 'PasswordResetConfirm' },
  };
  const actualPaths = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path).sort();
  assert.deepEqual(actualPaths, Object.keys(expected).sort());
  for (const [path, { status, request }] of Object.entries(expected)) {
    const operation = contract.paths[`/auth${path}`]?.post;
    assert.ok(operation, `Falta POST /auth${path}`);
    assert.ok(operation.responses[status], `Falta respuesta ${status} en ${path}`);
    assert.equal(operation.requestBody.content['application/json'].schema.$ref, `#/components/schemas/${request}`);
    assert.ok(contract.components.schemas[request]);
  }
  assert.equal(contract.paths['/auth/login'].post.responses['429'].$ref, '#/components/responses/TooManyRequests');
  assert.equal(contract.paths['/auth/password-reset/request'].post.responses['429'].$ref, '#/components/responses/TooManyRequests');
});
