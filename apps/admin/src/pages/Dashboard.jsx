import { useState } from 'react';
import { Link } from 'react-router-dom';
import { currentRange } from '../config';
import { queryString } from '../api/client';
import { Empty, ErrorBoundaryContent, Panel, Pill, useRemote } from '../ui';
import { statusLabels } from '../incidentLabels';
import PriorityBadge from '../PriorityBadge';

export default function Dashboard() {
  const [range] = useState(() => currentRange());
  const stats = useRemote(`/ops/stats${queryString(range)}`);
  const incidents = useRemote('/ops/incidents');
  const total = stats.data?.total ?? 0;
  return <div className="page-stack">
    <div className="page-intro"><span className="eyebrow">Vista general</span><h1>Centro de operaciones</h1><p>Revisa los reportes, identifica los que necesitan atención y coordina la respuesta de tu institución.</p></div>
    <nav className="quick-actions" aria-label="Acciones frecuentes"><Link to="/incidentes"><strong>Revisar reportes →</strong><span>Consulta la bandeja y abre un caso para atenderlo.</span></Link><Link to="/mapa"><strong>Ubicar reportes →</strong><span>Consulta los lugares y filtra los tipos de emergencia.</span></Link></nav>
    <ErrorBoundaryContent error={stats.error} loading={stats.loading}>
      <div className="metric-grid">
        <div className="metric"><span>Incidentes</span><strong>{total}</strong><small>En tu ámbito</small></div>
        <div className="metric"><span>En atención</span><strong>{(stats.data?.byStatus?.assigned ?? 0) + (stats.data?.byStatus?.en_route ?? 0) + (stats.data?.byStatus?.attending ?? 0)}</strong><small>Asignados o en curso</small></div>
        <div className="metric"><span>Cerrados</span><strong>{stats.data?.byStatus?.closed ?? 0}</strong><small>Últimos 7 días</small></div>
        <div className="metric"><span>Tiempo de asignación</span><strong>{stats.data?.averageAssignmentMinutes == null ? '—' : `${stats.data.averageAssignmentMinutes} min`}</strong><small>Promedio del ámbito</small></div>
      </div>
    </ErrorBoundaryContent>
    <Panel title="Incidentes recientes" eyebrow="Bandeja" action={<Link className="text-link" to="/incidentes">Ver todos →</Link>}>
      <ErrorBoundaryContent error={incidents.error} loading={incidents.loading}>
        {incidents.data?.length ? <ul className="recent-incidents">
          {incidents.data.slice(0, 6).map((item) => <li key={item.id}>
            <Link className="recent-incident" to={`/incidentes/${item.id}`}>
              <span className="recent-incident-title"><strong>{item.categoryName?.trim() || 'Categoría no disponible'}</strong><small>{item.reference}</small></span>
              <span className="incident-indicators"><Pill>{statusLabels[item.status] ?? 'Estado por confirmar'}</Pill><PriorityBadge priority={item.priority} unknownLabel="Por confirmar" /></span>
            </Link>
          </li>)}
        </ul> : <Empty>No hay incidentes recientes.</Empty>}
      </ErrorBoundaryContent>
    </Panel>
  </div>;
}
