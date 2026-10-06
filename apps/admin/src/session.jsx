import { createContext, useContext, useMemo, useState } from 'react';
import { createApiClient } from './api/client';

const SessionContext = createContext(null);

export function SessionProvider({ children, client }) {
  const [session, setSession] = useState(null);
  const api = useMemo(() => client || createApiClient({ onSession: setSession }), [client]);
  return <SessionContext.Provider value={{ api, session, login: api.login, logout: api.logout }}>
    {children}
  </SessionContext.Provider>;
}

export function useSession() { return useContext(SessionContext); }

export function hasRole(session, ...roles) {
  return roles.some((role) => session?.user?.roles?.includes(role));
}
