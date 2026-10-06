const express = require('express');
const { registerCitizen } = require('./register');
const { login } = require('./login');
const { refreshSession, logout } = require('./session');
const { requestPasswordReset, confirmPasswordReset } = require('./recovery');
const { createRateLimit } = require('./rate-limit');

function createAuthRouter(pool, authConfig, mailbox) {
  const router = express.Router();
  router.post('/register', async (req, res) => {
    const user = await registerCitizen(pool, req.body);
    res.status(201).json(user);
  });
  router.post('/login', createRateLimit(pool, 'login', { limit: 5 }), async (req, res) => {
    res.json(await login(pool, authConfig, req.body));
  });
  router.post('/refresh', async (req, res) => {
    res.json(await refreshSession(pool, authConfig, req.body));
  });
  router.post('/logout', async (req, res) => {
    await logout(pool, req.body);
    res.status(204).end();
  });
  router.post('/password-reset/request', createRateLimit(pool, 'password_reset', { limit: 3 }), async (req, res) => {
    res.status(202).json(await requestPasswordReset(pool, mailbox, req.body));
  });
  router.post('/password-reset/confirm', async (req, res) => {
    res.json(await confirmPasswordReset(pool, req.body));
  });
  return router;
}

module.exports = { createAuthRouter };
