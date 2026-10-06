const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function createFileMailbox(directory) {
  return {
    async sendPasswordReset(email, token) {
      await fs.mkdir(directory, { recursive: true });
      const file = path.join(directory, `${randomUUID()}.json`);
      await fs.writeFile(file, JSON.stringify({ email, token, purpose: 'password-reset' }), { mode: 0o600, flag: 'wx' });
    },
  };
}

module.exports = { createFileMailbox };
