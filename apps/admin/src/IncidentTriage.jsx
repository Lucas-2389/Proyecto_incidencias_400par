import { Notice, useRemote } from './ui';

const fields = [['isConscious', 'Está consciente'], ['isBreathing', 'Está respirando'], ['hasBleeding', 'Tiene sangrado']];

function Subcategory({ categoryId, subcategoryId }) {
  const catalog = useRemote(`/catalog/categories/${categoryId}/subcategories`);
  return <>
    <span>Subtipo</span><strong>{catalog.loading ? 'Cargando subtipo…' : catalog.data?.find((item) => item.id === subcategoryId)?.name ?? 'Subtipo no disponible'}</strong>
    {catalog.error && <Notice kind="error">{catalog.error} <button className="text-button" onClick={catalog.reload}>Reintentar subtipo</button></Notice>}
  </>;
}

export default function IncidentTriage({ incident }) {
  const hasTriage = [...fields.map(([key]) => key), 'subcategoryId', 'affectedPeople'].some((key) => incident[key] != null);
  return <section className="incident-triage" aria-label="Triage rápido">
    <h3>Triage rápido</h3>
    {hasTriage ? <>
      <p>Observaciones de la persona principal descrita en el reporte.</p>
      <div className="kv">
        {fields.map(([key, label]) => <div className="kv-pair" key={key}><span>{label}</span><strong>{incident[key] == null ? 'No informado' : incident[key] ? 'Sí' : 'No'}</strong></div>)}
        <span>Personas afectadas</span><strong>{incident.affectedPeople ?? 'No informado'}</strong>
        {incident.subcategoryId != null ? <Subcategory key={incident.categoryId} categoryId={incident.categoryId} subcategoryId={incident.subcategoryId} /> : <><span>Subtipo</span><strong>No informado</strong></>}
      </div>
    </> : <p>Triage no informado.</p>}
  </section>;
}
