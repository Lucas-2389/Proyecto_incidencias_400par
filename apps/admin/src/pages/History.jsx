import { useState } from 'react';
import { queryString } from '../api/client';
import { ErrorBoundaryContent, Field, Panel, friendlyDate, useRemote } from '../ui';
import { entityLabels, readableEvent } from '../incidentLabels';

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
  const institutions = useRemote('/admin/institutions');
  return <div className="page-stack"><div className="page-intro"><span className="eyebrow">Trazabilidad</span><h1>Historial y estadísticas</h1><p>Eventos auditados y métricas del ámbito autorizado.</p></div>
    <Panel title="Indicadores" eyebrow="Últimos siete días"><ErrorBoundaryContent loading={stats.loading} error={stats.error}><div className="metric-grid"><div className="metric"><span>Total</span><strong>{stats.data?.total ?? 0}</strong></div><div className="metric"><span>Asignación media</span><strong>{stats.data?.averageAssignmentMinutes ?? '—'} min</strong></div></div></ErrorBoundaryContent></Panel>
    <Panel title="Cambios realizados" eyebrow="Historial"><p>Elige el tipo de registro y la institución. No necesitas conocer sus códigos internos.</p><div className="filters"><Field label="Tipo de registro"><select value={entityType} onChange={(e) => setEntityType(e.target.value)}><option value="">Todos los registros</option>{Object.entries(entityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Institución"><select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} disabled={institutions.loading || !!institutions.error}><option value="">Todas las autorizadas</option>{(institutions.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><button className="button ghost" onClick={() => { setEntityType(''); setEntityId(''); setInstitutionId(''); }}>Limpiar filtros</button></div><details><summary>Buscar por identificador técnico (opcional)</summary><Field label="Identificador del registro"><input value={entityId} onChange={(e) => setEntityId(e.target.value)} /></Field></details>
      <ErrorBoundaryContent loading={history.loading} error={history.error}><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>Actor</th></tr></thead><tbody>
        {(history.data ?? []).map((item) => <tr key={item.id}><td>{friendlyDate(item.createdAt)}</td><td><strong>{readableEvent(item.action)}</strong><details><summary>Referencia técnica</summary><code>{item.action}</code></details></td><td>{entityLabels[item.entityType] ?? 'Otro registro'}<details><summary>Identificador del registro</summary><code>{item.entityId}</code></details></td><td>{item.actorUserId ? <details><summary>Usuario autorizado</summary><code>{item.actorUserId}</code></details> : 'Sistema'}</td></tr>)}
      </tbody></table></div></ErrorBoundaryContent></Panel>
  </div>;
}
