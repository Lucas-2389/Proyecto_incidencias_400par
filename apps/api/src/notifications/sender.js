class NotificationSender {
  constructor(provider = null) { this.provider = provider; }

  async send(notification) {
    if (!this.provider) return { delivered: false, reason: 'not_configured' };
    try {
      return await this.provider.send(notification) ?? { delivered: true };
    } catch {
      return { delivered: false, reason: 'provider_failed' };
    }
  }

  async close() { if (this.provider?.close) await this.provider.close(); }
}

async function sendBestEffort(sender, notification) {
  try { return await sender?.send(notification); } catch { return { delivered: false, reason: 'provider_failed' }; }
}

module.exports = { NotificationSender, sendBestEffort };
