import { useState } from 'react';
import { Link } from 'react-router-dom';
import { currentRange } from '../config';
import { queryString } from '../api/client';
import { Empty, ErrorBoundaryContent, Panel, Pill, useRemote } from '../ui';
import { statusLabels } from '../incidentLabels';
import PriorityBadge from '../PriorityBadge';
import DistrictField from '../DistrictField';

export default function Dashboard() {
  const [range] = useState(() => currentRange());
  const [districtId, setDistrictId] = useState('');
  const filters = queryString({ ...range, districtId });
  const stats = useRemote(`/ops/stats${filters}`);
  const incidents = useRemote(`/ops/incidents${filters}`);
  const total = stats.data?.total ?? 0;
  return <div className="page-stack">
    <div className="page-intro"><span className="eyebrow">Vista general</span><h1>Centro de operaciones</h1><p>Revisa los reportes, identifica los que necesitan atención y coordina la respuesta de tu institución.</p></div>
    <nav className="quick-actions" aria-label="Acciones frecuentes"><Link to="/incidentes"><strong>Revisar reportes →</strong><span>Consulta la bandeja y abre un caso para atenderlo.</span></Link><Link to="/mapa"><strong>Ubicar reportes →</strong><span>Consulta los lugares y filtra los tipos de emergencia.</span></Link></nav>
    <DistrictField value={districtId} onChange={setDistrictId} />
    <p className="map-note">Últimos siete días · Distrito seleccionado · Hora de Perú</p>
    <ErrorBoundaryContent error={stats.error} loading={stats.loading}>
      <div className="metric-grid">
        <Link className="metric metric-link" to={`/incidentes${filters}`}><span>Incidentes</span><strong>{total}</strong><small>Ver reportes del periodo →</small></Link>
        <Link className="metric metric-link" to={`/incidentes${filters}&status=in_progress`}><span>En atención</span><strong>{(stats.data?.byStatus?.assigned ?? 0) + (stats.data?.byStatus?.en_route ?? 0) + (stats.data?.byStatus?.attending ?? 0)}</strong><small>Ver asignados o en curso →</small></Link>
        <Link className="metric metric-link" to={`/incidentes${filters}&status=closed`}><span>Cerrados</span><strong>{stats.data?.byStatus?.closed ?? 0}</strong><small>Ver cierres del periodo →</small></Link>
        <Link className="metric metric-link" to={`/incidentes${filters}&status=in_progress`}><span>Tiempo de asignación</span><strong>{stats.data?.averageAssignmentMinutes == null ? '—' : `${stats.data.averageAssignmentMinutes} min`}</strong><small>Promedio · Ver atenciones →</small></Link>
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
