const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const express = require('express');
const { mountFrontend, frontendDirectory } = require('../src/frontend');

test('desde apps/api: build React, rutas SPA, assets y API permanecen separados', { timeout: 15000 }, async () => {
  const index = path.resolve(__dirname, '../../admin/dist/index.html');
  assert.ok(fs.existsSync(index), 'Ejecutar build de apps/admin antes de las pruebas');
  const child = spawn(process.execPath, ['-e', `
    const { createApp } = require('./src/app');
    const app = createApp({checkDatabase: async()=>{}}, {httpConfig:{appEnv:'production',corsOrigins:['https://gestion-incidencias-200e.onrender.com']}});
    const server = app.listen(0, '127.0.0.1', ()=>process.send({port:server.address().port}));
    process.on('message', ()=>server.close(()=>process.exit(0)));
  `], { cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    const port = await new Promise((resolve, reject) => {
      child.once('message', message => resolve(message.port));
      child.once('error', reject);
      child.once('exit', () => reject(new Error('Proceso HTTP terminó antes de escuchar')));
    });
    const base = `http://127.0.0.1:${port}`;
    for (const route of ['/', '/login', '/incidentes/example']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.equal(await response.text(), fs.readFileSync(index, 'utf8'));
    }
    const asset = fs.readFileSync(index, 'utf8').match(/src="([^"]+\.js)"/)[1];
    assert.equal((await fetch(base + asset)).status, 200);
    assert.equal((await fetch(base + '/assets/absent.js')).status, 404);
    for (const route of ['/api', '/api/ruta-inexistente', '/api/v1', '/api/v1/absent']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 404);
      assert.match(response.headers.get('content-type'), /json/);
    }
    const health = await fetch(base + '/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    // Browser module/style requests send Origin; curl without it hid the failure.
    const css = fs.readFileSync(index, 'utf8').match(/href="([^"]+\.css)"/)[1];
    for (const route of ['/', '/index.html', asset, css]) {
      for (const method of ['GET', 'HEAD']) {
        const response = await fetch(base + route, { method, headers: { origin: 'https://gestionincidencias.cfd' } });
        assert.equal(response.status, 200);
        assert.doesNotMatch(response.headers.get('content-type'), /json/);
      }
    }
    const denied = await fetch(base + '/api/v1/absent', { headers: { origin: 'https://gestionincidencias.cfd' } });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).code, 'ORIGIN_NOT_ALLOWED');
  } finally {
    if (child.exitCode === null) {
      const stopped = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await stopped;
    }
  }
});

test('dist se calcula desde __dirname y un index ausente solo registra la ruta esperada', () => {
  assert.equal(frontendDirectory, path.resolve(__dirname, '../../admin/dist'));
  const logs = [];
  const absent = path.join(frontendDirectory, 'nonexistent-test-directory');
  assert.equal(mountFrontend(express(), { directory: absent, logger: { error: value => logs.push(JSON.parse(value)) } }), false);
  assert.deepEqual(logs, [{ expectedPath: path.join(absent, 'index.html') }]);
});
