import { useState } from 'react';
import { Link } from 'react-router-dom';
import { currentRange } from '../config';
import { queryString } from '../api/client';
import { ErrorBoundaryContent, Panel, Pill, useRemote } from '../ui';
import { priorityLabels, statusLabels } from '../incidentLabels';

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
        <div className="table-wrap"><table><thead><tr><th>Referencia</th><th>Estado</th><th>Prioridad</th><th>Acción</th></tr></thead><tbody>
          {(incidents.data ?? []).slice(0, 6).map((item) => <tr key={item.id}><td><strong>{item.reference}</strong></td><td><Pill>{statusLabels[item.status] ?? 'Estado por confirmar'}</Pill></td><td>{priorityLabels[item.priority] ?? 'Por confirmar'}</td><td><Link to={`/incidentes/${item.id}`}>Ver reporte →</Link></td></tr>)}
        </tbody></table></div>
      </ErrorBoundaryContent>
    </Panel>
  </div>;
}
