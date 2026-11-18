import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../session';
import { priorityLabels, readableEvent, readableValue, sourceLabels, statusLabels, verificationLabels } from '../incidentLabels';
import { Empty, ErrorBoundaryContent, Field, Notice, Panel, Pill, friendlyDate, useRemote } from '../ui';

import IncidentTriage from '../IncidentTriage';
import PriorityBadge from '../PriorityBadge';
import DistrictField from '../DistrictField';
import { useIncidentOperations } from '../useIncidentOperations';
import { useDispatchOperators } from '../useDispatchOperators';

const IncidentLocation = lazy(() => import('../IncidentLocation'));

const statuses = ['reported', 'verifying', 'assigned', 'en_route', 'attending', 'resolved', 'closed'];
const nextStatus = { reported: 'verifying', assigned: 'en_route', en_route: 'attending', attending: 'resolved', resolved: 'closed' };

export function IncidentList() {
  const { api, session } = useSession();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [exception, setException] = useState(false);
  const [districtId, setDistrictId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [description, setDescription] = useState('');
  const [callerContact, setCallerContact] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const categories = useRemote('/catalog/categories');
  const sites = useRemote('/admin/sites');
  const institutions = useRemote('/admin/institutions');
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (exception) params.set('exception', 'true');
  if (districtId) params.set('districtId', districtId);
  const incidents = useRemote(`/ops/incidents?${params}`);
  async function createPhone(event) {
    event.preventDefault(); setError('');
    try {
      const receipt = await api.request('/ops/incidents/phone', { method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ institutionId, siteId, categoryId: Number(categoryId), description,
          ...(callerContact.trim() ? { callerContact: callerContact.trim() } : {}),
          ...(latitude && longitude ? { location: { latitude: Number(latitude), longitude: Number(longitude) } } : {}) }) });
      setShowForm(false); await incidents.reload(); navigate(`/incidentes/${receipt.id}`);
    } catch (issue) { setError(issue.message); }
  }
  return <div className="page-stack">
    <div className="page-intro with-action"><div><span className="eyebrow">Operaciones</span><h1>Bandeja de incidentes</h1><p>Consulta reportes y coordina la atención.</p></div>
      {session?.user?.roles?.some((role) => ['Operador', 'SuperAdministrador'].includes(role)) &&
        <button className="button primary" onClick={() => setShowForm((value) => !value)}>+ Registrar llamada</button>}</div>
    {showForm && <Panel title="Nuevo reporte por llamada" eyebrow="Registro telefónico">
      <form className="form-grid" onSubmit={createPhone}>
        <Field label="Institución"><select required value={institutionId} onChange={(e) => { setInstitutionId(e.target.value); setSiteId(''); }}><option value="">Seleccionar</option>
          {(institutions.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Sede"><select required value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="">Seleccionar</option>
          {(sites.data ?? []).filter((item) => item.institutionId === institutionId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Categoría"><select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Seleccionar</option>
          {(categories.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Descripción"><textarea required maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Teléfono de quien llamó (opcional)"><input type="tel" maxLength={20} placeholder="Para devolver la llamada" value={callerContact} onChange={(e) => setCallerContact(e.target.value)} /></Field>
        <Field label="Latitud (opcional)"><input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} /></Field>
        <Field label="Longitud (opcional)"><input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} /></Field>
        <Notice kind="error">{error}</Notice><button className="button primary">Guardar reporte</button>
      </form></Panel>}
    <Panel title="Reportes visibles" eyebrow="Bandeja" action={<button className="button ghost" onClick={incidents.reload}>Actualizar</button>}>
      <div className="filters"><DistrictField value={districtId} onChange={setDistrictId} /><Field label="Estado"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option>{statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></Field>
        <label className="check"><input type="checkbox" checked={exception} onChange={(e) => setException(e.target.checked)} /> Solo excepciones</label></div>
      <ErrorBoundaryContent error={incidents.error} loading={incidents.loading}>
        {incidents.data?.length ? <div className="table-wrap"><table><thead><tr><th>Incidente</th><th>Estado</th><th>Verificación</th><th>Prioridad</th><th>Fecha</th></tr></thead><tbody>
          {incidents.data.map((item) => <tr key={item.id} className="incident-list-row">
            <td><Link className="incident-list-link" to={`/incidentes/${item.id}`}>
              <strong>{item.categoryName?.trim() || categories.data?.find((category) => category.id === item.categoryId)?.name || 'Categoría no disponible'}</strong>
              <small>{item.reference}</small>
            </Link>{item.exception && <Pill tone="warn">Sin cobertura</Pill>}</td>
            <td><Pill>{statusLabels[item.status] ?? item.status}</Pill></td>
            <td>{verificationLabels[item.verificationStatus] ?? item.verificationStatus}</td>
            <td><PriorityBadge priority={item.priority} /></td>
            <td>{friendlyDate(item.createdAt)}</td>
          </tr>)}
        </tbody></table></div> : <Empty />}
      </ErrorBoundaryContent>
    </Panel>
  </div>;
}

export function IncidentDetail() {
  const { id } = useParams();
  return <IncidentWorkspace key={id} id={id} />;
}

function IncidentWorkspace({ id }) {
  const { api } = useSession();
  const operations = useIncidentOperations(id);
  const incident = operations.detail;
  const categories = useRemote('/catalog/categories');
  const suggestions = useRemote(`/ops/incidents/${id}/suggestions`);
  const sites = useRemote('/admin/sites');
  const institutions = useRemote('/admin/institutions');
  const [siteId, setSiteId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verification, setVerification] = useState(null);
  const [controlOpen, setControlOpen] = useState(false);
  const [priority, setPriority] = useState(null);
  const [pending, setPending] = useState({});
  const pendingActions = useRef(new Set());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const assignments = operations.assignments ?? [];
  const operators = useDispatchOperators(id, [siteId, ...assignments.map((item) => item.siteId)]);
  const selectedOperators = operators.bySite[siteId];
  const selectedSite = sites.data?.find((site) => site.id === siteId);
  const recommended = suggestions.data?.suggestions?.find((item) => item.siteId === siteId);
  const evidence = incident?.evidence ?? [];
  const evidenceIds = evidence.map((photo) => photo.id).join(',');
  const [evidenceUrls, setEvidenceUrls] = useState({});
  const [evidenceError, setEvidenceError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const urls = [];
    setEvidenceUrls({});
    setEvidenceError('');
    Promise.all(evidence.map(async (photo) => {
      const url = await api.getEvidence(id, photo.id);
      if (cancelled) URL.revokeObjectURL(url);
      else urls.push(url);
      return [photo.id, url];
    })).then((entries) => { if (!cancelled) setEvidenceUrls(Object.fromEntries(entries)); })
      .catch((issue) => { if (!cancelled) setEvidenceError(issue.message || 'No se pudieron cargar las fotografías.'); });
    return () => { cancelled = true; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [api, id, evidenceIds]);

  function chooseSite(value) {
    setSiteId(value);
    setOperatorId('');
    setReason('');
  }
  async function perform(key, path, body, { method = 'POST', collapse = false } = {}) {
    if (pendingActions.current.has(key)) return;
    pendingActions.current.add(key);
    setPending((value) => ({ ...value, [key]: true }));
    setError('');
    setSuccess('');
    try {
      await api.request(path, { method, body: JSON.stringify(body) });
      if (!mounted.current) return;
      setSuccess('Cambio guardado.');
      if (collapse) setControlOpen(false);
      await operations.reload({ force: true });
      if (mounted.current) await suggestions.reload();
    } catch (issue) {
      if (!mounted.current) return;
      setError(issue.status === 409 ? `La atención cambió. ${issue.message} Revisa los datos actualizados antes de confirmar.` : issue.message);
      if (collapse) setControlOpen(true);
      if (issue.status === 409) await operations.reload({ force: true });
    } finally {
      pendingActions.current.delete(key);
      if (mounted.current) setPending((value) => ({ ...value, [key]: false }));
    }
  }
  async function assign(event) {
    event.preventDefault();
    if (!selectedSite) return setError('Selecciona una sede.');
    await perform('dispatch', `/ops/incidents/${id}/assignments`, {
      institutionId: selectedSite.institutionId, siteId, operatorUserId: operatorId || null, reason: recommended ? null : reason,
    });
  }
  const siteName = (value) => sites.data?.find((site) => site.id === value)?.name ?? 'Sede no disponible';
  const institutionName = (value) => institutions.data?.find((item) => item.id === value)?.name ?? 'Institución no disponible';
  const sortedAssignments = [...assignments].sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed')
    || new Date(a.assignedAt) - new Date(b.assignedAt) || a.id.localeCompare(b.id));
  const canDispatch = incident && !['resolved', 'closed'].includes(incident.status);
  const controlPending = pending.verification || pending.startVerification;
  const selectedVerification = verification ?? (incident?.verificationStatus === 'pending' ? 'verified' : incident?.verificationStatus) ?? 'verified';
  return <div className="page-stack">
    <Link className="text-link" to="/incidentes">← Volver a bandeja</Link>
    <div className="page-intro with-action"><div><span className="eyebrow">Detalle operativo</span><h1>{incident?.reference ?? 'Incidente'}</h1><p>Seguimiento y asignaciones de las instituciones autorizadas.</p></div>
      <button className="button ghost" disabled={operations.refreshing} onClick={() => operations.reload()}>Actualizar</button>
    </div>
    {operations.lastUpdated && <small>Última actualización · {friendlyDate(operations.lastUpdated)}{operations.refreshing && ' · Actualizando…'}</small>}
    {Object.entries(operations.errors).map(([key, message]) => <Notice kind="error" key={key}>No se pudo actualizar {({ detail: 'el reporte', assignments: 'las asignaciones', history: 'el historial' })[key]}. {message}</Notice>)}
    <Notice kind="error">{error}</Notice><Notice kind="success">{success}</Notice>
    {operations.loading && <div className="loading">Cargando reporte…</div>}
    {incident && <>
      <div className="detail-grid incident-detail-grid">
        <Panel title="Reporte" eyebrow="Información">
          <div className="incident-indicators"><Pill>{statusLabels[incident.status] ?? incident.status}</Pill><PriorityBadge priority={incident.priority} /></div>
          <div className="kv">
            <span>Fuente</span><strong>{sourceLabels[incident.source] ?? incident.source}</strong>
            <span>Categoría</span><strong>{categories.data?.find((item) => item.id === incident.categoryId)?.name ?? 'Categoría no disponible'}</strong>
            <span>Contacto</span><strong>{incident.callerContact ? <a href={`tel:${incident.callerContact.replace(/[^\d+]/g, '')}`}>{incident.callerContact} · Llamar</a> : 'No proporcionado'}</strong>
          </div>
          <p className="description">{incident.description}</p>
          <IncidentTriage incident={incident} />
        </Panel>
        <Panel title="Ubicación del reporte">
          <Suspense fallback={<p>Cargando ubicación…</p>}><IncidentLocation key={id} location={incident.location} /></Suspense>
        </Panel>
      </div>
      <Panel title="Fotografías" eyebrow="Evidencia del reporte">
        <Notice kind="error">{evidenceError}</Notice>
        {evidence.length ? <div className="evidence-grid">{evidence.map((photo, index) => <figure className="evidence-card" key={photo.id}>
          {evidenceUrls[photo.id] ? <img src={evidenceUrls[photo.id]} alt={`Fotografía ${index + 1} del reporte`} /> : <div className="loading">Cargando fotografía…</div>}
          <figcaption>{photo.mediaType} · {friendlyDate(photo.uploadedAt)}</figcaption>
        </figure>)}</div> : <Empty>Este reporte todavía no tiene fotografías.</Empty>}
      </Panel>
      <section className="panel incident-control-panel" aria-labelledby="incident-control-title">
        <div className="panel-heading">
          <h2 id="incident-control-title">Control · Verificar y priorizar</h2>
          <button className="button ghost" aria-expanded={controlOpen} aria-controls="incident-control" onClick={() => setControlOpen((value) => !value)}>{controlOpen ? 'Replegar control' : 'Abrir control'}</button>
        </div>
        <div id="incident-control" hidden={!controlOpen}>
          <form className="incident-control-form" onSubmit={(event) => {
            event.preventDefault();
            const selectedPriority = priority ?? incident.priority;
            perform('verification', `/ops/incidents/${id}/verification`, {
              verificationStatus: selectedVerification, reason: note,
              ...(priorityLabels[selectedPriority] ? { priority: selectedPriority } : {}),
            }, { method: 'PATCH', collapse: true });
          }}>
            <Field label="Resultado"><select value={selectedVerification} onChange={(event) => setVerification(event.target.value)}>{['verified', 'unverifiable', 'false', 'duplicate'].map((value) => <option key={value} value={value}>{verificationLabels[value]}</option>)}</select></Field>
            <Field label="Prioridad"><select value={priority ?? incident.priority ?? ''} onChange={(event) => setPriority(event.target.value)}>
              <option value="" disabled>Sin prioridad informada</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></Field>
            <Field label="Motivo"><input required maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
            <div className="incident-control-actions">
              <button className="button secondary" disabled={controlPending}>Guardar verificación</button>
              {incident.status === 'reported' && <button type="button" className="button ghost" disabled={controlPending} onClick={() => perform('startVerification', `/ops/incidents/${id}/status`, { status: 'verifying', note }, { method: 'PATCH', collapse: true })}>Iniciar verificación</button>}
            </div>
          </form>
        </div>
      </section>
      <Panel title="Derivación sugerida" eyebrow="Cobertura y reglas">
        <Notice kind="error">{suggestions.error}</Notice>
        {suggestions.error && <button className="button ghost" onClick={suggestions.reload}>Reintentar sugerencias</button>}
        {suggestions.data?.exception && <Notice kind="warn">Sin cobertura sugerida. Selecciona una sede y registra el motivo de la corrección.</Notice>}
        <Notice kind="error">{sites.error || institutions.error}</Notice>
        {(sites.error || institutions.error) && <button className="button ghost" onClick={() => Promise.all([sites.reload(), institutions.reload()])}>Reintentar sedes</button>}
        {canDispatch ? <div className="dispatch-layout">
          <div className="dispatch-suggestions">
            <div className="suggestions">{(suggestions.data?.suggestions ?? []).map((item) => <button key={item.siteId} className="suggestion" aria-pressed={siteId === item.siteId} onClick={() => chooseSite(item.siteId)}>
              <span className="dispatch-institution">{item.institutionName}</span>
              <strong>{item.siteName}</strong>
              <small className="dispatch-rule">{item.reason}</small>
            </button>)}</div>
          </div>
          <form className="dispatch-form" onSubmit={assign}>
            <div className="dispatch-fields">
              <Field label="Sede responsable"><select required value={siteId} onChange={(event) => chooseSite(event.target.value)} disabled={pending.dispatch || sites.loading}>
                <option value="">Seleccionar sede</option>{(sites.data ?? []).filter((site) => site.active !== false).map((site) => <option key={site.id} value={site.id} disabled={assignments.some((item) => item.siteId === site.id)}>{institutionName(site.institutionId)} · {site.name}</option>)}
              </select></Field>
              <Field label="Operador"><select value={operatorId} onChange={(event) => setOperatorId(event.target.value)} disabled={!siteId || !selectedOperators || Boolean(selectedOperators.error) || pending.dispatch}>
                <option value="">{siteId && !selectedOperators ? 'Cargando operadores…' : 'Operador pendiente'}</option>{(selectedOperators?.data ?? []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select></Field>
            </div>
            {selectedOperators?.error && <Notice kind="error">{selectedOperators.error} <button type="button" className="text-button" onClick={() => operators.retry(siteId)}>Reintentar operadores</button></Notice>}
            {selectedOperators && !selectedOperators.error && selectedOperators.data.length === 0 && <p>Esta sede no tiene operadores activos. Puedes confirmar con operador pendiente.</p>}
            {!recommended && <Field label="Motivo de corrección"><textarea required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>}
            <div className="dispatch-actions"><button className="button primary" disabled={pending.dispatch || !siteId || assignments.some((item) => item.siteId === siteId)}>Confirmar asignación</button></div>
          </form>
        </div> : <p>El incidente está finalizado.</p>}
      </Panel>
    </>}
    <Panel title="Asignaciones visibles" eyebrow="Atención multiinstitución">
      {operations.assignments === null ? <p>{operations.errors.assignments ? 'Asignaciones no disponibles.' : 'Cargando asignaciones…'}</p> : sortedAssignments.length ? <div className="cards">{sortedAssignments.map((assignment) => {
        const operator = operators.bySite[assignment.siteId];
        return <article className="mini-card assignment-card" key={assignment.id} aria-label={`Asignación de ${siteName(assignment.siteId)}`}>
          <span className="eyebrow">{institutionName(assignment.institutionId)}</span>
          <div className="row-between"><strong>{siteName(assignment.siteId)}</strong><Pill>{statusLabels[assignment.status] ?? assignment.status}</Pill></div>
          <p>{assignment.operatorUserId ? operator?.data.find((person) => person.id === assignment.operatorUserId)?.name ?? (operator ? 'Operador no disponible' : 'Cargando operador…') : 'Operador pendiente'}</p>
          <small>Asignada · {friendlyDate(assignment.assignedAt)}</small>
          {assignment.closedAt && <small>Cerrada · {friendlyDate(assignment.closedAt)}</small>}
          {nextStatus[assignment.status] && <button className="button secondary" disabled={pending[assignment.id]} onClick={() => perform(assignment.id, `/ops/incidents/${id}/status`, { assignmentId: assignment.id, status: nextStatus[assignment.status], note: note || `Paso a ${statusLabels[nextStatus[assignment.status]]}` }, { method: 'PATCH' })}>Pasar a {statusLabels[nextStatus[assignment.status]]}</button>}
        </article>;
      })}</div> : <Empty>Este incidente todavía no tiene asignaciones visibles.</Empty>}
    </Panel>
    <Panel title="Historial" eyebrow="Línea de tiempo">
      {operations.history === null ? <p>{operations.errors.history ? 'Historial no disponible.' : 'Cargando historial…'}</p> : operations.history.length ? <ol className="timeline">{operations.history.map((item) => {
        const assignment = assignments.find((value) => value.id === item.assignmentId);
        return <li key={item.id}><strong>{readableEvent(item.eventType)}</strong>
          {item.assignmentId && <span>{assignment ? `${institutionName(assignment.institutionId)} · ${siteName(assignment.siteId)}` : 'Atención institucional'}</span>}
          {['status.changed', 'assignment.status', 'incident.status', 'verification', 'verification.changed', 'incident.verification', 'priority', 'incident.priority'].includes(item.eventType)
            && <span>{readableValue(item.previousValue)} → {readableValue(item.newValue)}</span>}
          {item.eventType === 'duplicate.linked' && <span>{item.linkedIncidentReference ? `Reporte principal ${item.linkedIncidentReference}` : 'Referencia del reporte principal no disponible'}</span>}
          <small>{friendlyDate(item.createdAt)}{item.actorName ? ` · ${item.actorName}` : ''}{item.note ? ` · ${item.note}` : ''}</small>
          {readableEvent(item.eventType) === 'Evento no reconocido' && <details><summary>Referencia técnica</summary><code>{item.eventType}</code></details>}
        </li>;
      })}</ol> : <Empty>Los cambios del reporte aparecerán aquí cuando comience su atención.</Empty>}
    </Panel>
  </div>;
}
