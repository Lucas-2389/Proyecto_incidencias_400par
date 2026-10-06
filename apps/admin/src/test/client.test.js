import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/client';

const response = (status, body) => ({ status, ok: status >= 200 && status < 300,
  json: async () => body });

describe('sesión API', () => {
  it('inicia sesión y renueva un token vencido antes de reintentar', async () => {
    let dataCalls = 0;
    const fetchImpl = vi.fn(async (url, options) => {
      if (url.endsWith('/auth/login')) return response(200, { accessToken: 'old', refreshToken: 'refresh-old', user: { roles: ['Operador'] } });
      if (url.endsWith('/auth/refresh')) return response(200, { accessToken: 'new', refreshToken: 'refresh-new' });
      if (url.endsWith('/ops/incidents')) {
        dataCalls += 1;
        return options.headers.Authorization === 'Bearer old' ? response(401, { message: 'Sesión vencida' }) : response(200, [{ id: 'incident-1' }]);
      }
      return response(404, {});
    });
    const client = createApiClient({ baseUrl: '/api/v1', fetchImpl });
    await client.login('operador@example.invalid', 'test-secret');
    expect(await client.request('/ops/incidents')).toEqual([{ id: 'incident-1' }]);
    expect(client.getSession().accessToken).toBe('new');
    expect(client.getSession().user.roles).toEqual(['Operador']);
    expect(dataCalls).toBe(2);
  });

  it('borra la sesión cuando falla la renovación', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith('/auth/login')) return response(200, { accessToken: 'old', refreshToken: 'refresh-old', user: { roles: ['Operador'] } });
      return response(401, { message: 'Sesión vencida' });
    });
    const client = createApiClient({ baseUrl: '/api/v1', fetchImpl });
    await client.login('operador@example.invalid', 'test-secret');
    await expect(client.request('/ops/incidents')).rejects.toMatchObject({ status: 401 });
    expect(client.getSession()).toBeNull();
  });
});
