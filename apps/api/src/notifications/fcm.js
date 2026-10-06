const { randomUUID } = require('node:crypto');
const { NotificationSender } = require('./sender');

function createFcmSender(pool, { env = process.env, sdk = null } = {}) {
  if (!env.FCM_PROJECT_ID) return new NotificationSender();
  if (!/^[a-z][a-z0-9-]{5,40}$/.test(env.FCM_PROJECT_ID)) throw new Error('FCM_PROJECT_ID inválido');
  const appSdk = sdk?.app ?? require('firebase-admin/app');
  const messagingSdk = sdk?.messaging ?? require('firebase-admin/messaging');
  const app = appSdk.initializeApp({ credential: appSdk.applicationDefault(), projectId: env.FCM_PROJECT_ID },
    `incidencias-${randomUUID()}`);
  return new NotificationSender({
    async send(notification) {
      const [devices] = await pool.execute(
        'SELECT id, token FROM push_device_tokens WHERE user_id = ? AND active = TRUE ORDER BY created_at DESC LIMIT 20',
        [notification.userId],
      );
      if (!devices.length) return { delivered: false, reason: 'no_devices' };
      const response = await messagingSdk.getMessaging(app).sendEachForMulticast({
        tokens: devices.map((device) => device.token),
        notification: { title: notification.title, body: notification.message },
        data: { type: notification.type, incidentId: notification.incidentId ?? '' },
      });
      for (let i = 0; i < response.responses.length; i += 1) {
        const code = response.responses[i].error?.code;
        if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code)) {
          await pool.execute('UPDATE push_device_tokens SET active = FALSE WHERE id = ?', [devices[i].id]);
        }
      }
      return { delivered: response.successCount > 0, reason: response.successCount > 0 ? undefined : 'provider_failed' };
    },
    async close() { await appSdk.deleteApp(app); },
  });
}

module.exports = { createFcmSender };
