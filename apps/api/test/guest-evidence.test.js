const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sharp = require('sharp');
const { randomBytes } = require('node:crypto');
const { issueGuestEvidenceToken } = require('../src/incidents/guest-evidence');
const { createEvidenceRouter } = require('../src/incidents/evidence');
const { errorHandler } = require('../src/http/errors');

test('invitado sube evidencia solo con permiso propio vigente; no puede leer ni cruzar reportes', async () => {
  const auth = { jwtSecret: randomBytes(48).toString('hex') };
  const id = 'guest-report';
  let writes = 0;
  const execute = async sql => {
    if (sql.startsWith('SELECT hits')) return [[{ hits: 1 }]];
    if (sql.startsWith('SELECT id, reporter')) return [[{ id, reporterUserId: null }]];
    if (sql.startsWith('SELECT COUNT')) return [[{ total: 0 }]];
    if (sql.startsWith('SELECT id, media_type')) return [[{ id: 'photo', mediaType: 'image/png', uploadedAt: new Date() }]];
    return [{ affectedRows: 1 }];
  };
  const pool = { execute, getConnection: async () => ({ execute, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} }) };
  const store = { put: async () => { writes++; return 'private-key'; }, remove: async () => {} };
  const app = express();
  app.use('/incidents', createEvidenceRouter(pool, auth, store));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const png = await sharp({ create: { width: 5, height: 5, channels: 3, background: '#168577' } }).png().toBuffer();
  const token = issueGuestEvidenceToken({ id, createdAt: new Date().toISOString() }, auth);
  async function upload(incident, permission) {
    const form = new FormData();
    form.append('photo', new Blob([png], { type: 'image/png' }), 'test.png');
    return fetch(`${base}/incidents/${incident}/evidence`, { method: 'POST', headers: permission ? { 'X-Evidence-Token': permission } : {}, body: form });
  }
  try {
    assert.equal((await upload(id)).status, 401);
    assert.equal((await upload('other-report', token)).status, 401);
    const forged = issueGuestEvidenceToken({ id, createdAt: new Date().toISOString() }, { jwtSecret: randomBytes(48).toString('hex') });
    assert.equal((await upload(id, forged)).status, 401);
    assert.equal(issueGuestEvidenceToken({ id, createdAt: new Date(Date.now() - 86401000).toISOString() }, auth), undefined);
    assert.equal(writes, 0);
    assert.equal((await upload(id, token)).status, 201);
    assert.equal(writes, 1);
    assert.equal((await fetch(`${base}/incidents/${id}/evidence/photo`, { headers: { 'X-Evidence-Token': token } })).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
