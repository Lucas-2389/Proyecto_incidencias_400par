const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const mysql = require('mysql2/promise');
const sharp = require('sharp');
const { createApp } = require('../src/app');
const { createEvidenceStore } = require('../src/incidents/evidence-store');
const { createCloudinaryEvidenceStore } = require('../src/incidents/cloudinary-store');
const { Writable } = require('node:stream');
const { registerCitizen } = require('../src/auth/register');
const { login } = require('../src/auth/login');
const { loadTestDatabaseConfig } = require('../scripts/integration-config');

const integration = process.env.RUN_MYSQL_INTEGRATION === '1' ? test : test.skip;

for (const provider of ['local', 'cloudinary']) {
integration(`fotografías privadas: ${provider === 'cloudinary' ? 'Cloudinary simulado' : 'disco local'}, límites y lectura auditada con MySQL real`, async () => {
  const pool = mysql.createPool({ ...loadTestDatabaseConfig(), connectionLimit: 3 });
  const authConfig = { jwtSecret: 'sentinel-test-secret-longer-than-thirty-two-characters' };
  const directory = path.resolve(__dirname, `../../../.local/test-evidence-${randomUUID()}`);
  const objects = new Map();
  function makeStore() {
    if (provider === 'local') return createEvidenceStore(directory);
    const client = {
      uploader: {
        upload_stream(options, callback) {
          const chunks = [];
          return new Writable({ write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); },
            final(done) { objects.set(options.public_id, Buffer.concat(chunks));
              callback(null, { public_id: options.public_id, secure_url: `https://example.invalid/${options.public_id}` }); done(); } });
        },
        async destroy(key) { objects.delete(key); return { result: 'ok' }; },
      },
      url: (key) => `https://example.invalid/${key}`,
    };
    return createCloudinaryEvidenceStore({ cloud_name: 'test', api_key: 'test', api_secret: 'test' }, {
      client, fetchImpl: async (url) => new Response(objects.get(new URL(url).pathname.slice(1))),
    });
  }
  const evidenceStore = makeStore();
  const password = 'test-only-secret-value';
  const userToken = async (kind) => {
    const email = `${kind}-${randomUUID()}@example.invalid`;
    const user = await registerCitizen(pool, { name: kind, email, password, acceptedTerms: true });
    return { user, token: (await login(pool, authConfig, { email, password })).accessToken };
  };
  const owner = await userToken('evidence-owner');
  const other = await userToken('evidence-other');
  const operator = await userToken('evidence-operator');
  const [[operatorRole]] = await pool.execute("SELECT id FROM roles WHERE code = 'Operador'");
  const [[site]] = await pool.execute("SELECT s.id, s.institution_id AS institutionId FROM sites s JOIN institutions i ON i.id = s.institution_id WHERE i.type = 'pnp' AND i.is_demo = TRUE LIMIT 1");
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [operator.user.id, operatorRole.id]);
  await pool.execute('INSERT INTO institution_memberships (user_id, institution_id, site_id, role_id) VALUES (?, ?, ?, ?)',
    [operator.user.id, site.institutionId, site.id, operatorRole.id]);
  const operatorToken = (await login(pool, authConfig, { email: operator.user.email, password })).accessToken;
  const [[category]] = await pool.execute("SELECT id FROM incident_categories WHERE code = 'traffic_accident'");
  const app = createApp({ checkDatabase: async () => {} }, { pool, authConfig, evidenceStore, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/incidents`;
    const report = await fetch(base, { method: 'POST', headers: { authorization: `Bearer ${owner.token}`,
      'Idempotency-Key': randomUUID(), 'content-type': 'application/json' }, body: JSON.stringify({
      categoryId: category.id, description: 'Accidente con foto de prueba', location: { latitude: -13.16, longitude: -74.22 },
    }) });
    assert.equal(report.status, 201);
    const incident = await report.json();
    const mine = await (await fetch(`${base}/mine`, { headers: { authorization: `Bearer ${owner.token}` } })).json();
    assert.ok(mine.some((row) => row.id === incident.id));
    const otherMine = await (await fetch(`${base}/mine`, { headers: { authorization: `Bearer ${other.token}` } })).json();
    assert.ok(!otherMine.some((row) => row.id === incident.id));
    assert.equal((await fetch(`${base}/${incident.id}`, { headers: { authorization: `Bearer ${other.token}` } })).status, 403);
    const ownerDetail = await (await fetch(`${base}/${incident.id}`, { headers: { authorization: `Bearer ${owner.token}` } })).json();
    assert.equal(ownerDetail.priority, undefined);
    assert.equal(ownerDetail.verificationStatus, undefined);
    assert.equal(ownerDetail.location.latitude, -13.16);
    const photo = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#00ff00' } }).png().toBuffer();
    const upload = (bytes, mediaType, token = owner.token) => {
      const form = new FormData();
      form.append('photo', new Blob([bytes], { type: mediaType }), 'photo.png');
      return fetch(`${base}/${incident.id}/evidence`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
    };
    assert.equal((await upload(Buffer.from('not an image'), 'image/png')).status, 422);
    assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png')).status, 413);
    assert.equal((await upload(photo, 'image/png', other.token)).status, 403);
    const added = await upload(photo, 'image/png');
    assert.equal(added.status, 201);
    const evidence = await added.json();
    assert.equal(evidence.mediaType, 'image/png');
    assert.equal(evidence.objectKey, undefined);
    const detailWithPhoto = await (await fetch(`${base}/${incident.id}`, { headers: { authorization: `Bearer ${owner.token}` } })).json();
    assert.ok(detailWithPhoto.evidence.some((item) => item.id === evidence.id));
    assert.equal(detailWithPhoto.evidence[0].objectKey, undefined);
    const [[stored]] = await pool.execute('SELECT object_key AS objectKey, byte_size AS byteSize, sha256, storage_provider AS provider, secure_url AS secureUrl FROM evidence WHERE id = ?', [evidence.id]);
    assert.equal(stored.provider, provider);
    if (provider === 'local') { assert.ok(stored.objectKey.endsWith('.png')); assert.equal(stored.secureUrl, null); }
    else { assert.ok(stored.objectKey.startsWith('incidencias/')); assert.ok(stored.secureUrl.startsWith('https://')); }
    assert.ok(stored.byteSize > 0);
    assert.equal(stored.sha256.length, 64);
    const restartedStore = makeStore();
    assert.ok((await restartedStore.read(stored.objectKey, stored.mediaType || 'image/png')).equals(photo));
    const visible = await fetch(`${base}/${incident.id}/evidence/${evidence.id}`, { headers: { authorization: `Bearer ${operatorToken}` } });
    assert.equal(visible.status, 200);
    assert.equal(visible.headers.get('content-type'), 'image/png');
    assert.equal((await visible.arrayBuffer()).byteLength, photo.length);
    const [[audit]] = await pool.execute("SELECT actor_user_id AS actorId FROM audit_logs WHERE action = 'evidence.read' AND entity_id = ? ORDER BY id DESC LIMIT 1", [evidence.id]);
    assert.equal(audit.actorId, operator.user.id);
    assert.equal((await fetch(`${base}/${incident.id}/evidence/${evidence.id}`, { headers: { authorization: `Bearer ${other.token}` } })).status, 403);
    assert.equal((await upload(photo, 'image/png')).status, 201);
    assert.equal((await upload(photo, 'image/png')).status, 201);
    assert.equal((await upload(photo, 'image/png')).status, 409);
    const [blobs] = await pool.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'evidence' AND data_type IN ('blob','mediumblob','longblob')");
    assert.deepEqual(blobs, []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
}
