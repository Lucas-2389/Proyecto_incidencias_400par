const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const frontendDirectory = path.resolve(__dirname, '../../admin/dist');

function mountFrontend(app, { logger = console, directory = frontendDirectory } = {}) {
  const index = path.join(directory, 'index.html');
  let exists = false;
  try { exists = fs.statSync(index).isFile(); } catch { /* Log only the expected path. */ }
  if (!exists) {
    logger.error(JSON.stringify({ expectedPath: index }));
    return false;
  }
  app.use(express.static(directory, { index: false }));
  app.get('/{*path}', (req, res, next) => {
    // Also guard here so the SPA cannot absorb API routes if mount order changes.
    if (req.path === '/api' || req.path.startsWith('/api/') || path.extname(req.path) || !req.accepts('html')) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
  return true;
}

module.exports = { mountFrontend, frontendDirectory };
