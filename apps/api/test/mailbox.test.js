const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createFileMailbox } = require('../src/auth/mailbox');

test('buzón local guarda token de recuperación fuera de la respuesta HTTP', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'incidencias-mailbox-'));
  try {
    const mailbox = createFileMailbox(directory);
    await mailbox.sendPasswordReset('demo@example.invalid', 'test-only-token');
    const files = await fs.readdir(directory);
    assert.equal(files.length, 1);
    const saved = JSON.parse(await fs.readFile(path.join(directory, files[0]), 'utf8'));
    assert.deepEqual(saved, { email: 'demo@example.invalid', token: 'test-only-token', purpose: 'password-reset' });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
