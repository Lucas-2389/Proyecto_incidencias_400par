const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReview, normalize } = require('../src/institutions/references');

const review = { latitude: -13.16, longitude: -74.22, method: 'institutional_map',
  source: 'https://www.gob.pe/institucion/munihuamanga/sedes', notes: 'Edificio contrastado con evidencia institucional.' };

test('revisión exige coordenadas, método y evidencia sin credenciales', () => {
  assert.equal(validateReview(review).latitude, review.latitude);
  assert.equal(validateReview({ ...review, method: 'user_report' }).method, 'user_report');
  for (const patch of [{ latitude: null }, { latitude: '-13.16' }, { longitude: -80 },
    { method: 'guess' }, { source: 'javascript:alert(1)' },
    { source: 'https://user:password@example.com' }, { notes: '' }]) {
    assert.throws(() => validateReview({ ...review, ...patch }), error => error.status === 422 || error.statusCode === 422);
  }
});

test('retirar ubicación conserva una operación explícita sin exigir coordenadas nuevas', () => {
  assert.deepEqual(validateReview({ clear: true }), { clear: true });
});

test('una referencia sin punto nunca se presenta como ubicación revisada', () => {
  const row = { sources: '["https://www.gob.pe"]', latitude: null, longitude: null, reviewedAt: null };
  assert.equal(normalize(row).status, 'pending_location');
  assert.deepEqual(normalize(row).sources, ['https://www.gob.pe']);
  assert.equal(normalize({ ...row, reviewedAt: new Date() }).status, 'pending_location');
  const located = normalize({ ...row, latitude: '-13.1600000', longitude: '-74.2200000', reviewedAt: new Date() });
  assert.equal(located.status, 'location_reviewed');
  assert.equal(located.latitude, -13.16);
});
