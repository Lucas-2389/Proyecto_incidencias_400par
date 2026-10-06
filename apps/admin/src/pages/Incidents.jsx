import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../session';
import { Empty, ErrorBoundaryContent, Field, Notice, Panel, Pill, friendlyDate, useRemote } from '../ui';

const statuses = ['reported', 'verifying', 'assigned', 'en_route', 'attending', 'resolved', 'closed'];
const nextStatus = { reported: 'verifying', assigned: 'en_route', en_route: 'attending', attending: 'resolved', resolved: 'closed' };

export function IncidentList() {
  const { api } = useSession();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [exception, setException] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const categories = useRemote('/catalog/categories');
  const sites = useRemote('/admin/sites');
  const institutions = useRemote('/admin/institutions');
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (exception) params.set('exception', 'true');
  const incidents = useRemote(`/ops/incidents?${params}`);
  async function createPhone(event) {
    event.preventDefault(); setError('');
    try {
      const receipt = await api.request('/ops/incidents/phone', { method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ institutionId, siteId, categoryId: Number(categoryId), description,
          ...(latitude && longitude ? { location: { latitude: Number(latitude), longitude: Number(longitude) } } : {}) }) });
      setShowForm(false); await incidents.reload(); navigate(`/incidentes/${receipt.id}`);
    } catch (issue) { setError(issue.message); }
  }
  return <div className="page-stack">
    <div className="page-intro with-action"><div><span className="eyebrow">Operaciones</span><h1>Bandeja de incidentes</h1><p>Consulta reportes y coordina la atención.</p></div>
      <button className="button primary" onClick={() => setShowForm((value) => !value)}>+ Registrar llamada</button></div>
    {showForm && <Panel title="Nuevo reporte por llamada" eyebrow="Registro telefónico">
      <form className="form-grid" onSubmit={createPhone}>
        <Field label="Institución"><select required value={institutionId} onChange={(e) => { setInstitutionId(e.target.value); setSiteId(''); }}><option value="">Seleccionar</option>
          {(institutions.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Sede"><select required value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="">Seleccionar</option>
          {(sites.data ?? []).filter((item) => item.institutionId === institutionId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Categoría"><select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Seleccionar</option>
          {(categories.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Descripción"><textarea required maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Latitud (opcional)"><input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} /></Field>
        <Field label="Longitud (opcional)"><input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} /></Field>
        <Notice kind="error">{error}</Notice><button className="button primary">Guardar reporte</button>
      </form></Panel>}
    <Panel title="Reportes visibles" eyebrow="Bandeja" action={<button className="button ghost" onClick={incidents.reload}>Actualizar</button>}>
      <div className="filters"><Field label="Estado"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <label className="check"><input type="checkbox" checked={exception} onChange={(e) => setException(e.target.checked)} /> Solo excepciones</label></div>
      <ErrorBoundaryContent error={incidents.error} loading={incidents.loading}>
        {incidents.data?.length ? <div className="table-wrap"><table><thead><tr><th>Referencia</th><th>Estado</th><th>Verificación</th><th>Prioridad</th><th>Fecha</th><th></th></tr></thead><tbody>
          {incidents.data.map((item) => <tr key={item.id}><td><strong>{item.reference}</strong>{item.exception && <Pill tone="warn">Sin cobertura</Pill>}</td><td><Pill>{item.status}</Pill></td><td>{item.verificationStatus}</td><td>{item.priority}</td><td>{friendlyDate(item.createdAt)}</td><td><Link to={`/incidentes/${item.id}`}>Abrir →</Link></td></tr>)}
        </tbody></table></div> : <Empty />}
      </ErrorBoundaryContent>
    </Panel>
  </div>;
}

export function IncidentDetail() {
  const { id } = useParams();
  const { api } = useSession();
  const detail = useRemote(`/incidents/${id}`);
  const suggestions = useRemote(`/ops/incidents/${id}/suggestions`);
  const assignments = useRemote(`/ops/incidents/${id}/assignments`);
  const history = useRemote(`/ops/incidents/${id}/history`);
  const sites = useRemote('/admin/sites');
  const units = useRemote('/resources/units');
  const people = useRemote('/resources/personnel');
  const users = useRemote('/admin/users');
  const [siteId, setSiteId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [unitIds, setUnitIds] = useState([]);
  const [personnelIds, setPersonnelIds] = useState([]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verification, setVerification] = useState('verified');
  const selectedSite = (sites.data ?? []).find((site) => site.id === siteId);
  const recommended = suggestions.data?.suggestions?.find((item) => item.siteId === siteId);
  const refresh = async () => Promise.all([detail.reload(), suggestions.reload(), assignments.reload(), history.reload(), units.reload(), people.reload()]);
  async function perform(path, body, method = 'POST') {
    setError(''); setSuccess('');
    try { await api.request(path, { method, body: JSON.stringify(body) }); await refresh(); setSuccess('Cambio guardado.'); }
    catch (issue) { setError(issue.message); }
  }
  async function assign(event) {
    event.preventDefault();
    if (!selectedSite) return setError('Selecciona una sede.');
    await perform(`/ops/incidents/${id}/assignments`, { institutionId: selectedSite.institutionId, siteId,
      operatorUserId: operatorId || null, unitIds, personnelIds, reason: recommended ? null : reason });
  }
  function toggle(idValue, values, setter) { setter(values.includes(idValue) ? values.filter((item) => item !== idValue) : [...values, idValue]); }
  return <div className="page-stack"><Link className="text-link" to="/incidentes">← Volver a bandeja</Link>
    <div className="page-intro"><span className="eyebrow">Detalle operativo</span><h1>{detail.data?.reference ?? 'Incidente'}</h1><p>Seguimiento y asignaciones de las instituciones autorizadas.</p></div>
    <ErrorBoundaryContent error={detail.error} loading={detail.loading}>
      <div className="detail-grid"><Panel title="Reporte" eyebrow="Información"><div className="kv"><span>Estado</span><Pill>{detail.data?.status}</Pill><span>Fuente</span><strong>{detail.data?.source}</strong><span>Categoría</span><strong>{detail.data?.categoryId}</strong><span>Prioridad</span><strong>{detail.data?.priority ?? '—'}</strong><span>Ubicación</span><strong>{detail.data?.location ? `${detail.data.location.latitude}, ${detail.data.location.longitude}` : 'No disponible'}</strong></div><p className="description">{detail.data?.description}</p></Panel>
        <Panel title="Verificar y priorizar" eyebrow="Control"><div className="stack"><Field label="Resultado"><select value={verification} onChange={(e) => setVerification(e.target.value)}>{['verified', 'unverifiable', 'false', 'duplicate'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Motivo"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field><button className="button secondary" onClick={() => perform(`/ops/incidents/${id}/verification`, { verificationStatus: verification, reason: note }, 'PATCH')}>Guardar verificación</button>
          {detail.data?.status === 'reported' && <button className="button ghost" onClick={() => perform(`/ops/incidents/${id}/status`, { status: 'verifying', note }, 'PATCH')}>Iniciar verificación</button>}</div></Panel></div>
    </ErrorBoundaryContent>
    <Notice kind="error">{error}</Notice><Notice kind="success">{success}</Notice>
    <Panel title="Derivación sugerida" eyebrow="Cobertura y reglas">
      {suggestions.data?.exception && <Notice kind="warn">Sin cobertura sugerida. Selecciona una sede y registra el motivo de la corrección.</Notice>}
      <div className="suggestions">{(suggestions.data?.suggestions ?? []).map((item) => <button key={item.siteId} className="suggestion" onClick={() => setSiteId(item.siteId)}><strong>{item.institutionName}</strong><span>{item.siteName}</span><small>{item.reason}</small></button>)}</div>
      <form className="form-grid" onSubmit={assign}>
        <Field label="Sede responsable"><select required value={siteId} onChange={(e) => { setSiteId(e.target.value); setOperatorId(''); setUnitIds([]); setPersonnelIds([]); }}><option value="">Seleccionar sede</option>{(sites.data ?? []).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></Field>
        <Field label="Operador"><select value={operatorId} onChange={(e) => setOperatorId(e.target.value)}><option value="">Sin operador</option>{(users.data ?? []).filter((user) => user.siteId === siteId && user.role === 'Operador').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
        <Field label="Unidades disponibles"><div className="choice-list">{(units.data ?? []).filter((unit) => unit.siteId === siteId && unit.status === 'available').map((unit) => <label key={unit.id}><input type="checkbox" checked={unitIds.includes(unit.id)} onChange={() => toggle(unit.id, unitIds, setUnitIds)} /> {unit.code} · {unit.type}</label>)}</div></Field>
        <Field label="Personal"><div className="choice-list">{(people.data ?? []).filter((person) => person.siteId === siteId && person.active).map((person) => <label key={person.id}><input type="checkbox" checked={personnelIds.includes(person.id)} onChange={() => toggle(person.id, personnelIds, setPersonnelIds)} /> {person.name}</label>)}</div></Field>
        {!recommended && <Field label="Motivo de corrección"><textarea required value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
        <button className="button primary">Confirmar asignación</button>
      </form>
    </Panel>
    <Panel title="Asignaciones" eyebrow="Atención multiinstitución"><div className="cards">
      {(assignments.data ?? []).map((assignment) => <article className="mini-card" key={assignment.id}><div className="row-between"><strong>{(sites.data ?? []).find((site) => site.id === assignment.siteId)?.name ?? assignment.siteId}</strong><Pill>{assignment.status}</Pill></div><small>{friendlyDate(assignment.assignedAt)}</small>
        {nextStatus[assignment.status] && <button className="button secondary" onClick={() => perform(`/ops/incidents/${id}/status`, { assignmentId: assignment.id, status: nextStatus[assignment.status], note: note || `Paso a ${nextStatus[assignment.status]}` }, 'PATCH')}>Pasar a {nextStatus[assignment.status]}</button>}</article>)}
    </div></Panel>
    <Panel title="Historial" eyebrow="Línea de tiempo">{history.data?.length ? <ol className="timeline">{history.data.map((item) => <li key={item.id}><strong>{item.eventType}</strong><span>{item.previousValue ?? '—'} → {item.newValue ?? '—'}</span><small>{friendlyDate(item.createdAt)} · {item.note}</small></li>)}</ol> : <Empty />}</Panel>
  </div>;
}
