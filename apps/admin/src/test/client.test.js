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

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

it.each([200, 401])('una renovación tardía (%s) no restaura ni elimina otra sesión', async (status) => {
  const pending = deferred();
  const fetchImpl = vi.fn(async (url) => {
    if (url.endsWith('/auth/refresh')) return pending.promise;
    return response(401, {});
  });
  const client = createApiClient({ baseUrl: '/api', fetchImpl });
  client.setSession({ accessToken: 'old', refreshToken: 'old-refresh', user: { id: 'old-user' } });
  const request = client.request('/ops/incidents');
  const rejected = expect(request).rejects.toMatchObject({ status: 401 });
  await vi.waitFor(() => expect(fetchImpl.mock.calls.some(([url]) => url.endsWith('/auth/refresh'))).toBe(true));
  await client.logout();
  const next = { accessToken: 'next', refreshToken: 'next-refresh', user: { id: 'next-user' } };
  client.setSession(next);
  pending.resolve(response(status, { accessToken: 'late', refreshToken: 'late-refresh' }));
  await rejected;
  expect(client.getSession()).toEqual(next);
});

it('un guardado tardío no publica datos tras salir y volver a la misma cuenta', async () => {
  const pending = deferred();
  const client = createApiClient({ baseUrl: '/api', fetchImpl: async (url) => url.endsWith('/auth/me') ? pending.promise : response(204) });
  const session = { accessToken: 'old', refreshToken: 'refresh', user: { id: 'same-user', name: 'Original' } };
  client.setSession(session);
  const request = client.request('/auth/me', { method: 'PATCH', body: '{}' });
  const rejected = expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  await client.logout();
  client.setSession({ ...session, accessToken: 'new' });
  pending.resolve(response(200, { id: 'same-user', name: 'Respuesta anterior' }));
  await rejected;
  expect(client.getSession().user.name).toBe('Original');
});

it('el cambio de contraseña permite desactivar el reintento de autenticación', async () => {
  const fetchImpl = vi.fn(async () => response(401, {}));
  const client = createApiClient({ baseUrl: '/api', fetchImpl });
  client.setSession({ accessToken: 'old', refreshToken: 'refresh' });
  await expect(client.request('/auth/password/change', { method: 'POST', retryAuth: false })).rejects.toMatchObject({ status: 401 });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
