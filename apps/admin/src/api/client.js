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
  let sessionVersion = 0;
  const setSession = (value) => {
    sessionVersion += 1;
    refreshing = null;
    session = value;
    onSession(value);
  };
  const requireCurrentSession = (version) => {
    if (version !== sessionVersion) throw new ApiError(401, { code: 'SESSION_CHANGED', message: 'La sesión ha cambiado' });
  };
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
    if (!refreshing) {
      const version = sessionVersion;
      refreshing = raw('/auth/refresh', { method: 'POST',
        body: JSON.stringify({ refreshToken: session.refreshToken }) }).then((tokens) => {
        requireCurrentSession(version);
        session = { ...tokens, user: tokens.user || session.user };
        onSession(session);
        return tokens.accessToken;
      }).catch((error) => {
        if (version === sessionVersion) setSession(null);
        throw error;
      }).finally(() => {
        if (version === sessionVersion) refreshing = null;
      });
    }
    return refreshing;
  };
  return {
    getSession: () => session,
    setSession,
    updateOwnProfile: (profile) => {
      if (session?.user?.id !== profile.id) return;
      session = { ...session, user: { ...session.user, name: profile.name } };
      onSession(session);
    },
    login: async (email, password) => {
      const version = sessionVersion;
      const tokens = await raw('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      requireCurrentSession(version);
      setSession(tokens);
      return tokens;
    },
    logout: async () => {
      const token = session?.refreshToken;
      setSession(null);
      if (token) await raw('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: token }) }).catch(() => {});
    },
    request: async (path, options = {}) => {
      const { retryAuth = true, ...requestOptions } = options;
      const version = sessionVersion;
      try {
        const result = await raw(path, requestOptions, session?.accessToken);
        requireCurrentSession(version);
        return result;
      }
      catch (error) {
        requireCurrentSession(version);
        if (!retryAuth || error.status !== 401 || !session?.refreshToken) throw error;
        const token = await refresh();
        requireCurrentSession(version);
        const result = await raw(path, requestOptions, token);
        requireCurrentSession(version);
        return result;
      }
    },
    getEvidence: async (incidentId, evidenceId) => {
      const version = sessionVersion;
      const response = await fetchImpl(`${baseUrl}/incidents/${incidentId}/evidence/${evidenceId}`, {
        headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {},
      });
      requireCurrentSession(version);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiError(response.status, body);
      }
      const blob = await response.blob();
      requireCurrentSession(version);
      return URL.createObjectURL(blob);
    },
    public: (path, options = {}) => raw(path, options),
  };
}

export function queryString(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  return `?${params}`;
}
