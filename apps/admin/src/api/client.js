import { API_BASE_URL } from '../config';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Error HTTP ${status}`);
    this.status = status;
    this.code = body?.code;
  }
}

export function createApiClient({ baseUrl = API_BASE_URL, fetchImpl = fetch, onSession = () => {} } = {}) {
  let session = null;
  let refreshing = null;
  const setSession = (value) => { session = value; onSession(value); };
  const raw = async (path, options = {}, token = null) => {
    const headers = { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
    const response = await fetchImpl(`${baseUrl}${path}`, { ...options, headers });
    if (response.status === 204) return null;
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, body);
    return body;
  };
  const refresh = async () => {
    if (!session?.refreshToken) throw new ApiError(401, { message: 'Sesión vencida' });
    if (!refreshing) refreshing = raw('/auth/refresh', { method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken }) }).then((tokens) => {
      setSession({ ...tokens, user: tokens.user || session.user });
      return tokens.accessToken;
    }).catch((error) => { setSession(null); throw error; }).finally(() => { refreshing = null; });
    return refreshing;
  };
  return {
    getSession: () => session,
    setSession,
    login: async (email, password) => {
      const tokens = await raw('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setSession(tokens);
      return tokens;
    },
    logout: async () => {
      const token = session?.refreshToken;
      setSession(null);
      if (token) await raw('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: token }) }).catch(() => {});
    },
    request: async (path, options = {}) => {
      try { return await raw(path, options, session?.accessToken); }
      catch (error) {
        if (error.status !== 401 || !session?.refreshToken) throw error;
        const token = await refresh();
        return raw(path, options, token);
      }
    },
    getEvidence: async (incidentId, evidenceId) => {
      const response = await fetchImpl(`${baseUrl}/incidents/${incidentId}/evidence/${evidenceId}`, {
        headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {},
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiError(response.status, body);
      }
      return URL.createObjectURL(await response.blob());
    },
    public: (path, options = {}) => raw(path, options),
  };
}

export function queryString(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  return `?${params}`;
}
