const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

test('SIGTERM deja de aceptar HTTP y cierra el pool', async () => {
  const source = `
    const express = require('express');
    const { startServer } = require('./src/lifecycle');
    const app = express();
    startServer({ app, port: 0, closePool: async () => {
      try { await fetch('http://127.0.0.1:' + global.port + '/api/health'); console.log('STILL_OPEN'); }
      catch { console.log('NOT_ACCEPTING'); }
      console.log('POOL_CLOSED');
    } }).then(({ server }) => { global.port = server.address().port; process.emit('SIGTERM'); });
  `;
  const child = spawn(process.execPath, ['-e', source], {
    cwd: path.resolve(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Cierre excedió el plazo')); }, 5000);
    child.once('exit', (code) => { clearTimeout(timeout); resolve(code); });
    child.once('error', reject);
  });
  assert.equal(exitCode, 0, stderr);
  assert.match(stdout, /NOT_ACCEPTING/);
  assert.match(stdout, /POOL_CLOSED/);
  assert.equal(stdout.includes('STILL_OPEN'), false);
});
