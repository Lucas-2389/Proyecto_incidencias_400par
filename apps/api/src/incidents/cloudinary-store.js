const { randomUUID } = require('node:crypto');
const { v2: cloudinary } = require('cloudinary');

const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const maxBytes = 5 * 1024 * 1024;

function createCloudinaryEvidenceStore(credentials, { client = cloudinary, fetchImpl = fetch } = {}) {
  const options = { ...credentials, secure: true, resource_type: 'image', type: 'authenticated' };
  function validKey(key) {
    if (!/^incidencias\/[0-9a-f-]{36}$/.test(key)) throw new Error('Clave de evidencia inválida');
  }
  return {
    provider: 'cloudinary',
    async put(buffer, mediaType) {
      if (!extensions[mediaType] || buffer.length > maxBytes) throw new Error('Fotografía inválida');
      const key = `incidencias/${randomUUID()}`;
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = client.uploader.upload_stream({ ...options, public_id: key, overwrite: false, timeout: 15000 },
            (error, uploaded) => error ? reject(error) : resolve(uploaded));
          stream.once('error', reject);
          stream.end(buffer);
        });
        if (result?.public_id !== key || !result.secure_url?.startsWith('https://')) {
          throw new Error('Respuesta de almacenamiento inválida');
        }
        return { key, secureUrl: result.secure_url, provider: 'cloudinary' };
      } catch {
        // La subida puede haberse completado aunque se haya perdido su respuesta.
        await client.uploader.destroy(key, { ...options, invalidate: true, timeout: 15000 }).catch(() => {});
        throw new Error('Almacenamiento de fotografías no disponible');
      }
    },
    async read(key, mediaType) {
      validKey(key);
      if (!extensions[mediaType]) throw new Error('Tipo de evidencia inválido');
      try {
        const url = client.url(key, { ...options, sign_url: true, format: extensions[mediaType] });
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
        if (!response.ok || Number(response.headers.get('content-length')) > maxBytes) throw new Error('Descarga inválida');
        const chunks = [];
        let total = 0;
        for await (const chunk of response.body) {
          total += chunk.length;
          if (total > maxBytes) throw new Error('Descarga demasiado grande');
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      } catch { throw new Error('Almacenamiento de fotografías no disponible'); }
    },
    async remove(key) {
      validKey(key);
      try { await client.uploader.destroy(key, { ...options, invalidate: true, timeout: 15000 }); }
      catch { throw new Error('Almacenamiento de fotografías no disponible'); }
    },
  };
}

module.exports = { createCloudinaryEvidenceStore };
