const path = require('node:path');
const { createEvidenceStore } = require('./evidence-store');
const { createCloudinaryEvidenceStore } = require('./cloudinary-store');

function createEvidenceStorage(config) {
  const stores = {};
  if (config.directory) stores.local = createEvidenceStore(path.resolve(__dirname, '../..', config.directory));
  if (config.cloudinary) stores.cloudinary = createCloudinaryEvidenceStore(config.cloudinary);
  const active = stores[config.uploadConfiguration];
  if (!active) return undefined;
  return {
    provider: active.provider,
    put: (buffer, mediaType) => active.put(buffer, mediaType),
    read(key, mediaType, provider = active.provider) {
      if (!stores[provider]) throw new Error('Proveedor de evidencia no disponible');
      return stores[provider].read(key, mediaType);
    },
    remove: (key) => active.remove(key),
  };
}

module.exports = { createEvidenceStorage };
