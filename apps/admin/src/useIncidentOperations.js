import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from './session';

export function useIncidentOperations(id) {
  const { api } = useSession();
  const [snapshot, setSnapshot] = useState({ detail: null, assignments: null, history: null, errors: {}, loading: true, refreshing: false, lastUpdated: null });
  const request = useRef({ version: 0, controller: null, promise: null });
  const reload = useCallback(({ force = false } = {}) => {
    if (request.current.promise && !force) return request.current.promise;
    request.current.controller?.abort();
    const controller = new AbortController();
    const version = ++request.current.version;
    request.current.controller = controller;
    setSnapshot((value) => ({ ...value, refreshing: true }));
    const paths = { detail: `/incidents/${id}`, assignments: `/ops/incidents/${id}/assignments`, history: `/ops/incidents/${id}/history` };
    const entries = Object.entries(paths);
    const promise = Promise.allSettled(entries.map(([, path]) => api.request(path, { signal: controller.signal })))
      .then((results) => {
        if (request.current.version !== version) return false;
        const errors = {};
        const values = {};
        results.forEach((result, index) => {
          const key = entries[index][0];
          if (result.status === 'fulfilled') values[key] = result.value;
          else errors[key] = result.reason.message || 'No se pudo actualizar la información.';
        });
        const complete = Object.keys(errors).length === 0;
        setSnapshot((value) => ({ ...value, ...values, errors, loading: false, refreshing: false, lastUpdated: complete ? new Date().toISOString() : value.lastUpdated }));
        return complete;
      }).finally(() => {
        if (request.current.version === version) request.current.promise = null;
      });
    request.current.promise = promise;
    return promise;
  }, [api, id]);

  useEffect(() => {
    reload();
    const refreshVisible = () => { if (!document.hidden) reload(); };
    const timer = setInterval(refreshVisible, 15000);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshVisible);
      request.current.version += 1;
      request.current.controller?.abort();
      request.current.promise = null;
    };
  }, [reload]);
  return { ...snapshot, reload };
}
