import { createContext, useContext, useMemo, useState } from 'react';
import { createApiClient } from './api/client';

const SessionContext = createContext(null);

export function SessionProvider({ children, client }) {
  const [session, setSession] = useState(null);
  const [sessionNotice, setSessionNotice] = useState(null);
  const api = useMemo(() => client || createApiClient({ onSession: setSession }), [client]);
  const login = async (...credentials) => {
    const result = await api.login(...credentials);
    setSessionNotice(null);
    return result;
  };
  const logout = (notice = null) => {
    setSessionNotice(notice);
    return api.logout();
  };
  return <SessionContext.Provider value={{ api, session, sessionNotice, login, logout }}>
    {children}
  </SessionContext.Provider>;
}

export function useSession() { return useContext(SessionContext); }

export function hasRole(session, ...roles) {
  return roles.some((role) => session?.user?.roles?.includes(role));
}
