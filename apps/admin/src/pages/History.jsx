import { useState } from 'react';
import { queryString } from '../api/client';
import { ErrorBoundaryContent, Field, Panel, friendlyDate, useRemote } from '../ui';

export default function History() {
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [range] = useState(() => ({
    from: new Date(Date.now() - 7 * 86400000).toISOString(),
    to: new Date().toISOString(),
  }));
  const history = useRemote(`/admin/audit${queryString({ entityType, entityId, institutionId })}`);
  const stats = useRemote(`/ops/stats${queryString(range)}`);
  return <div className="page-stack"><div className="page-intro"><span className="eyebrow">Trazabilidad</span><h1>Historial y estadísticas</h1><p>Eventos auditados y métricas del ámbito autorizado.</p></div>
    <Panel title="Indicadores" eyebrow="Últimos siete días"><ErrorBoundaryContent loading={stats.loading} error={stats.error}><div className="metric-grid"><div className="metric"><span>Total</span><strong>{stats.data?.total ?? 0}</strong></div><div className="metric"><span>Asignación media</span><strong>{stats.data?.averageAssignmentMinutes ?? '—'} min</strong></div></div></ErrorBoundaryContent></Panel>
    <Panel title="Registro de auditoría" eyebrow="Eventos"><div className="filters"><Field label="Entidad"><input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="incident" /></Field><Field label="ID de entidad"><input value={entityId} onChange={(e) => setEntityId(e.target.value)} /></Field><Field label="Institución ID"><input value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} /></Field></div>
      <ErrorBoundaryContent loading={history.loading} error={history.error}><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>Actor</th></tr></thead><tbody>
        {(history.data ?? []).map((item) => <tr key={item.id}><td>{friendlyDate(item.createdAt)}</td><td><strong>{item.action}</strong></td><td>{item.entityType} · {item.entityId}</td><td>{item.actorUserId ?? 'Sistema'}</td></tr>)}
      </tbody></table></div></ErrorBoundaryContent></Panel>
  </div>;
}
