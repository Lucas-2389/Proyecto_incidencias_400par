import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from './session';
import { friendlyDate } from './ui';

export default function Notifications() {
  const { api } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [newNotice, setNewNotice] = useState('');
  const knownIds = useRef(null);

  const reload = useCallback(async () => {
    try {
      const next = await api.request('/notifications/mine?unread=true');
      if (knownIds.current !== null) {
        const added = next.find((item) => !knownIds.current.has(item.id));
        if (added) setNewNotice(added.title);
      }
      knownIds.current = new Set(next.map((item) => item.id));
      setItems(next);
      setError('');
    } catch {
      setError('No se pudieron actualizar los avisos.');
    }
  }, [api]);

  useEffect(() => {
    reload();
    const timer = window.setInterval(reload, 30000);
    window.addEventListener('focus', reload);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', reload); };
  }, [reload]);

  async function openNotice(item) {
    try {
      await api.request(`/notifications/${item.id}/read`, { method: 'PATCH' });
      knownIds.current?.delete(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setOpen(false);
      setNewNotice('');
      if (item.incidentId) navigate(`/incidentes/${item.incidentId}`);
    } catch {
      setError('No se pudo marcar el aviso como leído.');
    }
  }

  return <div className="notification-area">
    <button type="button" className="notification-button" aria-label={`Avisos: ${items.length} sin leer`}
      aria-expanded={open} onClick={() => { setOpen((value) => !value); setNewNotice(''); }}>
      <span aria-hidden="true">🔔</span><span>Avisos</span>
      {items.length > 0 && <span className="notification-count">{items.length}</span>}
    </button>
    {newNotice && !open && <div className="notification-toast" role="status">{newNotice} · Abre Avisos para verlo</div>}
    {open && <div className="notification-popover" role="region" aria-label="Avisos sin leer">
      <div className="notification-heading"><strong>Avisos sin leer</strong><button type="button" onClick={reload}>Actualizar</button></div>
      {error && <p className="notification-error" role="alert">{error}</p>}
      {items.length ? <div className="notification-list">{items.map((item) =>
        <button type="button" className="notification-entry" key={item.id} onClick={() => openNotice(item)}>
          <strong>{item.title}</strong><span>{item.message}</span><small>{friendlyDate(item.createdAt)}</small>
        </button>)}</div> : <p className="notification-empty">No tienes avisos pendientes.</p>}
    </div>}
  </div>;
}
