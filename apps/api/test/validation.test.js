const assert = require('node:assert/strict');
const test = require('node:test');
const { requireObject, requireText, requireInteger } = require('../src/http/validation');

test('valida objetos, texto acotado y enteros sin incluir valores en errores', () => {
  assert.deepEqual(requireObject({ a: 1 }), { a: 1 });
  assert.equal(requireText('  hola  ', 'name', { max: 10 }), 'hola');
  assert.equal(requireInteger(2, 'count', { max: 3 }), 2);
  for (const action of [
    () => requireObject(['sentinel-secret'], 'body'),
    () => requireText('sentinel-secret', 'name', { max: 4 }),
    () => requireInteger(1.5, 'count'),
  ]) {
    assert.throws(action, (error) => error.status === 422 && error.code === 'VALIDATION_ERROR' && !error.message.includes('sentinel-secret'));
  }
});
