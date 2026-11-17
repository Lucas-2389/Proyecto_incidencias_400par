import { priorityLabels } from './incidentLabels';

export default function PriorityBadge({ priority }) {
  const label = priorityLabels[priority];
  const urgent = priority === 'high' || priority === 'critical';
  return <span className={`priority-badge priority-badge--${label ? priority : 'unknown'}`}>
    {urgent && <span className="priority-alert" aria-hidden="true">!</span>}
    {label ? `Prioridad ${label.toLocaleLowerCase('es')}` : 'Prioridad no informada'}
  </span>;
}
