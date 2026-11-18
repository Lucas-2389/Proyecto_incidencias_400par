import { METROPOLITAN_DISTRICTS } from './config';
import { Field, Notice, useRemote } from './ui';

export default function DistrictField({ value, onChange, required = false, emptyLabel, label = 'Distrito' }) {
  const districts = useRemote(METROPOLITAN_DISTRICTS);
  return <div>
    <Field label={label}><select value={value} required={required} disabled={districts.loading || Boolean(districts.error)} onChange={(event) => onChange(event.target.value)}>
      <option value="">{emptyLabel ?? (required ? 'Seleccionar distrito' : 'Todos los distritos')}</option>
      {(districts.data ?? []).map((district) => <option value={district.id} key={district.id}>{district.name}</option>)}
    </select></Field>
    {districts.error && <Notice kind="error">No se pudieron cargar los distritos. <button type="button" className="text-button" onClick={districts.reload}>Reintentar distritos</button></Notice>}
  </div>;
}
