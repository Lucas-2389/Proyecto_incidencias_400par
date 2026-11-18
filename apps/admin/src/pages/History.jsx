import { useState } from 'react';
import { Link } from 'react-router-dom';
import { queryString } from '../api/client';
import { currentRange, METROPOLITAN_DISTRICTS } from '../config';
import { mapPeriod } from '../mapPeriod';
import { Empty, ErrorBoundaryContent, Field, Notice, Panel, friendlyDate, useRemote } from '../ui';
import { entityLabels, readableEvent, statusLabels } from '../incidentLabels';
import DistrictField from '../DistrictField';

const emptyFilters = { entityType: '', entityId: '', institutionId: '', siteId: '', districtId: '', q: '', action: '' };
const fieldLabels = { name: 'Nombre', email: 'Correo', phone: 'Teléfono', contactPhone: 'Teléfono de contacto',
  status: 'Estado', active: 'Activo', role: 'Rol', address: 'Dirección', type: 'Tipo', scope: 'Ámbito',
  institutionId: 'Institución', siteId: 'Sede', districtId: 'Distrito', location: 'Ubicación', territoryStatus: 'Clasificación territorial' };
const valueLabels = { active: 'Activo', inactive: 'Inactivo', national: 'Nacional', local: 'Local',
  SuperAdministrador: 'Superadministrador', AdministradorInstitucional: 'Administrador institucional', Operador: 'Operador',
  resolved: 'Resuelto', pending: 'Pendiente', outside_coverage: 'Fuera de cobertura', boundary: 'En límite compartido',
  overlap: 'Solapamiento', district_mismatch: 'Distrito pendiente de revisión' };

function Changes({ event, institutions, sites, districts }) {
  const before = event.beforeData;
  const after = event.afterData;
  if (!after || typeof after !== 'object') return <p>Detalle del cambio no disponible.</p>;
  const fields = Object.keys(fieldLabels).filter((key) => Object.hasOwn(after, key)
    && (!before || JSON.stringify(before[key]) !== JSON.stringify(after[key])));
  function display(key, value) {
    if (value === null || value === undefined || value === '') return 'Sin dato';
    if (key === 'institutionId') return institutions.find((item) => item.id === value)?.name ?? 'Institución no disponible';
    if (key === 'siteId') return sites.find((item) => item.id === value)?.name ?? 'Sede no disponible';
    if (key === 'districtId') return districts.find((item) => Number(item.id) === Number(value))?.name
      ?? (Number(value) === Number(event.districtId) ? event.districtName : null) ?? 'Distrito no disponible';
    if (key === 'territoryStatus' && value === 'resolved') return 'Distrito confirmado por ubicación';
    if (key === 'location') return `${value.latitude}, ${value.longitude}`;
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    return statusLabels[value] ?? valueLabels[value] ?? String(value);
  }
  return <div>
    {!before && <p>Datos anteriores no disponibles para este evento.</p>}
    {fields.length ? <dl className="audit-changes">{fields.map((key) => <div key={key}>
      <dt>{fieldLabels[key]}</dt><dd>{before && <><span>{display(key, before[key])}</span> → </>}{display(key, after[key])}</dd>
    </div>)}</dl> : <p>El evento conserva su referencia y fecha. El detalle de los campos modificados no está disponible.</p>}
  </div>;
}

export default function History() {
  const [filters, setFilters] = useState(emptyFilters);
  const [dates, setDates] = useState({ from: '', to: '' });
  const [defaultRange, setDefaultRange] = useState(() => currentRange(7));
  const [page, setPage] = useState({ offset: 0, snapshotId: null });
  const period = mapPeriod(dates.from, dates.to, defaultRange);
  const history = useRemote(period.range ? `/admin/audit${queryString({ ...filters, ...period.range, ...page, limit: 25 })}` : null);
  const stats = useRemote(period.range ? `/ops/stats${queryString({ ...period.range, institutionId: filters.institutionId, districtId: filters.districtId })}` : null);
  const institutions = useRemote('/admin/institutions');
  const sites = useRemote('/admin/sites');
  const districts = useRemote(METROPOLITAN_DISTRICTS);
  function update(key, value) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === 'institutionId' ? { siteId: '' } : {}) }));
    setPage({ offset: 0, snapshotId: null });
  }
  function updateDate(key, value) {
    setDates((current) => ({ ...current, [key]: value }));
    setPage({ offset: 0, snapshotId: null });
  }
  return <div className="page-stack">
    <div className="page-intro"><span className="eyebrow">Trazabilidad</span><h1>Historial y estadísticas</h1><p>Consulta quién realizó cada cambio y los datos que se modificaron.</p></div>
    <Panel title="Periodo y territorio">
      <div className="filters">
        <Field label="Desde"><input type="date" value={dates.from} onChange={(event) => updateDate('from', event.target.value)} /></Field>
        <Field label="Hasta"><input type="date" value={dates.to} onChange={(event) => updateDate('to', event.target.value)} /></Field>
        <DistrictField value={filters.districtId} onChange={(value) => update('districtId', value)} />
        <Field label="Institución"><select value={filters.institutionId} onChange={(event) => update('institutionId', event.target.value)}>
          <option value="">Todas las autorizadas</option>{(institutions.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></Field>
      </div>
      <Notice kind="error">{period.error}</Notice>
      {period.range && <p>{friendlyDate(period.range.from)} — {friendlyDate(new Date(new Date(period.range.to).getTime() - 1))} · Hora de Perú</p>}
    </Panel>
    <Panel title="Indicadores operativos"><p>Aplican el periodo, distrito e institución seleccionados.</p>
      <ErrorBoundaryContent loading={stats.loading} error={stats.error}><div className="metric-grid">
        <div className="metric"><span>Incidentes registrados</span><strong>{stats.data?.total ?? 0}</strong></div>
        <div className="metric"><span>Tiempo promedio hasta la asignación</span><strong>{stats.data?.averageAssignmentMinutes == null ? 'Sin datos' : `${stats.data.averageAssignmentMinutes} min`}</strong></div>
      </div></ErrorBoundaryContent>
      <p className="field-hint">El promedio mide los minutos desde el registro hasta cada asignación visible de los incidentes del periodo.</p>
    </Panel>
    <Panel title="Cambios realizados">
      <div className="filters">
        <Field label="Buscar en eventos"><input type="search" maxLength={150} value={filters.q} placeholder="Persona, registro o referencia" onChange={(event) => update('q', event.target.value)} /></Field>
        <Field label="Tipo de registro"><select value={filters.entityType} onChange={(event) => update('entityType', event.target.value)}>
          <option value="">Todos los registros</option>{Object.entries(entityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></Field>
        <Field label="Acción"><select value={filters.action} onChange={(event) => update('action', event.target.value)}>
          <option value="">Todas las acciones</option>{['create', 'update', 'deactivate', 'assignment.confirm', 'assignment.override', 'assignment.status', 'incident.status', 'incident.verification', 'incident.priority', 'access.denied'].map((value) => <option key={value} value={value}>{readableEvent(value)}</option>)}
        </select></Field>
        <Field label="Sede"><select value={filters.siteId} onChange={(event) => update('siteId', event.target.value)}><option value="">Todas las autorizadas</option>
          {(sites.data ?? []).filter((site) => !filters.institutionId || site.institutionId === filters.institutionId).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
        </select></Field>
      </div>
      <details><summary>Referencia técnica opcional</summary><Field label="Identificador del registro"><input value={filters.entityId} onChange={(event) => update('entityId', event.target.value)} /></Field></details>
      <div className="actions"><button className="button ghost" onClick={() => { setFilters(emptyFilters); setDates({ from: '', to: '' }); setPage({ offset: 0, snapshotId: null }); }}>Limpiar filtros</button>
        <button className="button ghost" disabled={history.loading} onClick={() => {
          if (!dates.from && !dates.to) setDefaultRange(currentRange(7));
          setPage({ offset: 0, snapshotId: null }); history.reload();
        }}>Actualizar historial</button></div>
      <ErrorBoundaryContent loading={history.loading} error={history.error}>
        {history.data?.length ? <ol className="timeline">{history.data.map((event) => <li key={event.id}>
          <strong>{readableEvent(event.action)} · {event.entityName || entityLabels[event.recordType ?? event.entityType] || 'Registro no disponible'}</strong>
          <span>{event.actorName || (event.actorUserId ? 'Nombre del usuario no disponible' : 'Sistema')} · {friendlyDate(event.createdAt)}</span>
          <small>{[event.institutionName, event.siteName, event.districtName].filter(Boolean).join(' · ') || 'Ámbito del evento no disponible'}</small>
          {event.link && <Link to={event.link}>Abrir registro</Link>}
          <details><summary>Ver cambio</summary><Changes event={event} institutions={institutions.data ?? []} sites={sites.data ?? []} districts={districts.data ?? []} />
            {event.districtSource === 'current_record' && <p>El distrito se obtuvo del registro actual.</p>}
            <details><summary>Referencia técnica</summary><code>{event.action} · {event.entityId} · {event.actorUserId || 'Sistema'}</code></details>
          </details>
        </li>)}</ol> : <Empty>No hay eventos para estos filtros.</Empty>}
        <div className="actions"><button className="button ghost" disabled={page.offset === 0} onClick={() => setPage({ offset: Math.max(0, page.offset - 25), snapshotId: page.snapshotId ?? history.meta.snapshotId })}>Anterior</button>
          <span>Página {Math.floor(page.offset / 25) + 1} · {history.data?.length ?? 0} eventos</span>
          <button className="button ghost" disabled={!history.meta.hasMore || page.offset >= 10000} onClick={() => setPage({ offset: page.offset + 25, snapshotId: page.snapshotId ?? history.meta.snapshotId })}>Siguiente</button></div>
      </ErrorBoundaryContent>
    </Panel>
  </div>;
}
