const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function createEvidenceStore(directory) {
  const absolute = path.resolve(directory);
  function objectPath(key) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(key)) {
      throw new Error('Clave de evidencia inválida');
    }
    return path.join(absolute, key);
  }
  return {
    provider: 'local',
    async put(buffer, mediaType) {
      const extension = extensions[mediaType];
      if (!extension) throw new Error('Tipo de evidencia no permitido');
      await fs.mkdir(absolute, { recursive: true });
      const key = `${randomUUID()}.${extension}`;
      await fs.writeFile(objectPath(key), buffer, { mode: 0o600, flag: 'wx' });
      return key;
    },
    async read(key) { return fs.readFile(objectPath(key)); },
    async remove(key) { await fs.unlink(objectPath(key)); },
  };
}

module.exports = { createEvidenceStore };
