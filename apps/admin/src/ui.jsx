import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from './session';

export function useRemote(path, dependencies = []) {
  const { api } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({});
  const generation = useRef(0);
  const currentPath = useRef(path);
  currentPath.current = path;
  const reload = useCallback(async () => {
    if (currentPath.current !== path) return;
    if (!path) { setLoading(false); return; }
    const requestId = ++generation.current;
    setLoading(true);
    try {
      let responseMeta = {};
      const result = await api.request(path, { onResponse(response) {
        responseMeta = { snapshotId: response.headers?.get('X-Audit-Snapshot'), hasMore: response.headers?.get('X-Has-More') === 'true' };
      } });
      if (requestId !== generation.current || currentPath.current !== path) return;
      setData(result); setMeta(responseMeta); setError('');
    } catch (issue) {
      if (requestId === generation.current && currentPath.current === path) setError(issue.message);
    } finally {
      if (requestId === generation.current && currentPath.current === path) setLoading(false);
    }
  }, [api, path]);
  useEffect(() => { reload(); return () => { generation.current += 1; }; }, [reload, ...dependencies]);
  return { data, error, loading, reload, meta };
}

export function Panel({ title, eyebrow, action, children }) {
  return <section className="panel">
    <div className="panel-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>
    {children}
  </section>;
}

export function Notice({ children, kind = 'info' }) { return children ? <div role="status" className={`notice ${kind}`}>{children}</div> : null; }
export function Empty({ children = 'No hay registros para estos filtros.' }) { return <div className="empty">{children}</div>; }
export function Field({ label, hint, children }) { return <label className="field"><span>{label}</span>{children}{hint && <small className="field-hint">{hint}</small>}</label>; }
export function Pill({ children, tone = 'neutral' }) { return <span className={`pill ${tone}`}>{children}</span>; }

export function friendlyDate(value) { return value ? new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' }) : '—'; }

export function ErrorBoundaryContent({ error, loading, children }) {
  if (loading) return <div className="loading">Cargando datos…</div>;
  if (error) return <Notice kind="error">{error}</Notice>;
  return children;
}
