import { useEffect, useRef, useState } from 'react';
import { useSession } from './session';

export function useDispatchOperators(id, siteIds) {
  const { api } = useSession();
  const cache = useRef(new Map());
  const [bySite, setBySite] = useState({});
  const [revision, setRevision] = useState(0);
  const key = [...new Set(siteIds.filter(Boolean))].sort().join(',');
  useEffect(() => {
    let cancelled = false;
    for (const siteId of key.split(',').filter(Boolean)) {
      if (!cache.current.has(siteId)) {
        const promise = api.request(`/ops/incidents/${id}/operators?siteId=${encodeURIComponent(siteId)}`)
          .then((data) => ({ data, error: '' }), (issue) => ({ data: [], error: issue.message }));
        cache.current.set(siteId, promise);
      }
      cache.current.get(siteId).then((result) => {
        if (!cancelled) setBySite((value) => ({ ...value, [siteId]: result }));
      });
    }
    return () => { cancelled = true; };
  }, [api, id, key, revision]);
  const retry = (siteId) => {
    cache.current.delete(siteId);
    setBySite((value) => ({ ...value, [siteId]: undefined }));
    setRevision((value) => value + 1);
  };
  return { bySite, retry };
}
