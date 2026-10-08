const assert = require('node:assert/strict');
const test = require('node:test');
const { Writable } = require('node:stream');
const { createCloudinaryEvidenceStore } = require('../src/incidents/cloudinary-store');
const { cleanPhoto } = require('../src/incidents/evidence');
const sharp = require('sharp');

const credentials = { cloud_name: 'test', api_key: 'test-key', api_secret: 'sentinel-secret' };

function fakeClient({ failUpload = false } = {}) {
  const state = { destroyed: [] };
  const client = {
    uploader: {
      upload_stream(options, callback) {
        state.uploadOptions = options;
        return new Writable({ write(chunk, _encoding, done) { state.bytes = Buffer.from(chunk); done(); },
          final(done) {
            if (failUpload) callback(new Error(credentials.api_secret));
            else callback(null, { public_id: options.public_id, secure_url: `https://example.invalid/${options.public_id}.png` });
            done();
          } });
      },
      async destroy(key, options) { state.destroyed.push({ key, options }); return { result: 'ok' }; },
    },
    url(key, options) { state.urlOptions = options; return `https://example.invalid/${key}.png`; },
  };
  return { client, state };
}

test('sube bytes en memoria como authenticated y devuelve solo metadatos', async () => {
  const { client, state } = fakeClient();
  const store = createCloudinaryEvidenceStore(credentials, { client });
  const bytes = Buffer.from('test-image');
  const stored = await store.put(bytes, 'image/png');
  assert.equal(stored.provider, 'cloudinary');
  assert.match(stored.key, /^incidencias\/[0-9a-f-]{36}$/);
  assert.equal(state.uploadOptions.type, 'authenticated');
  assert.equal(state.uploadOptions.overwrite, false);
  assert.deepEqual(state.bytes, bytes);
  assert.equal(JSON.stringify(stored).includes(credentials.api_secret), false);
  await store.remove(stored.key);
  assert.equal(state.destroyed[0].key, stored.key);
  assert.equal(state.destroyed[0].options.type, 'authenticated');
});

test('firma la descarga y conserva los bytes; limita errores y tamaño', async () => {
  const { client, state } = fakeClient();
  const key = 'incidencias/00000000-0000-0000-0000-000000000000';
  const store = createCloudinaryEvidenceStore(credentials, { client,
    fetchImpl: async (_url, options) => { assert.ok(options.signal); return new Response(Buffer.from('photo')); } });
  assert.deepEqual(await store.read(key, 'image/png'), Buffer.from('photo'));
  assert.equal(state.urlOptions.sign_url, true);
  assert.equal(state.urlOptions.type, 'authenticated');
  const failed = createCloudinaryEvidenceStore(credentials, { client, fetchImpl: async () => { throw new Error(credentials.api_secret); } });
  await assert.rejects(failed.read(key, 'image/png'), error => !error.message.includes(credentials.api_secret));
  const large = createCloudinaryEvidenceStore(credentials, { client,
    fetchImpl: async () => new Response(Buffer.alloc(5 * 1024 * 1024 + 1)) });
  await assert.rejects(large.read(key, 'image/png'), /no disponible/);
});

test('rechaza tipos/tamaños inválidos y limpia una subida fallida sin exponer secretos', async () => {
  const { client, state } = fakeClient({ failUpload: true });
  const store = createCloudinaryEvidenceStore(credentials, { client });
  await assert.rejects(store.put(Buffer.from('x'), 'text/plain'), /inválida/);
  await assert.rejects(store.put(Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png'), /inválida/);
  await assert.rejects(store.put(Buffer.from('x'), 'image/png'), error => !error.message.includes(credentials.api_secret));
  assert.equal(state.destroyed.length, 1);
  await assert.rejects(store.read('../outside', 'image/png'), /Clave/);
});

test('valida el contenido real de la foto y elimina metadatos antes de subir', async () => {
  await assert.rejects(cleanPhoto({ buffer: Buffer.from('not-image'), mimetype: 'image/png' }), error => error.status === 422);
  const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } }).png().withMetadata().toBuffer();
  await assert.rejects(cleanPhoto({ buffer: bytes, mimetype: 'image/jpeg' }), error => error.status === 422);
  const photo = await cleanPhoto({ buffer: bytes, mimetype: 'image/png' });
  assert.equal((await sharp(photo.bytes).metadata()).exif, undefined);
  assert.equal(photo.sha256.length, 64);
});

test('el SDK real genera una URL authenticated firmada sin exponer el secreto', async () => {
  let signedUrl;
  const store = createCloudinaryEvidenceStore(credentials, {
    fetchImpl: async (url) => { signedUrl = url; return new Response(Buffer.from('photo')); },
  });
  await store.read('incidencias/00000000-0000-0000-0000-000000000000', 'image/png');
  assert.match(signedUrl, /^https:\/\/res\.cloudinary\.com\/test\/image\/authenticated\/s--/);
  assert.equal(signedUrl.includes(credentials.api_secret), false);
});
