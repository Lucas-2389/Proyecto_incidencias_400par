import { useCallback, useEffect, useState } from 'react';
import { useSession } from './session';

export function useRemote(path, dependencies = []) {
  const { api } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await api.request(path)); setError(''); }
    catch (issue) { setError(issue.message); }
    finally { setLoading(false); }
  }, [api, path]);
  useEffect(() => { reload(); }, [reload, ...dependencies]);
  return { data, error, loading, reload };
}

export function Panel({ title, eyebrow, action, children }) {
  return <section className="panel">
    <div className="panel-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>
    {children}
  </section>;
}

export function Notice({ children, kind = 'info' }) { return children ? <div role="status" className={`notice ${kind}`}>{children}</div> : null; }
export function Empty({ children = 'No hay registros para estos filtros.' }) { return <div className="empty">{children}</div>; }
export function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }
export function Pill({ children, tone = 'neutral' }) { return <span className={`pill ${tone}`}>{children}</span>; }

export function friendlyDate(value) { return value ? new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—'; }

export function ErrorBoundaryContent({ error, loading, children }) {
  if (loading) return <div className="loading">Cargando datos…</div>;
  if (error) return <Notice kind="error">{error}</Notice>;
  return children;
}
