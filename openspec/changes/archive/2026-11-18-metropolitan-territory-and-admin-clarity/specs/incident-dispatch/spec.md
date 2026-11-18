# Spec Delta

## MODIFIED Requirements

### Requirement: Historial contextualizado por asignación
El historial operativo SHALL identificar la institución y sede de los eventos cuya asignación sea visible, y SHALL conservar la distinción entre avances de asignación y cambios globales del incidente. SHALL mostrar una descripción específica por evento, actor legible autorizado cuando esté disponible, fecha, nota y valores pertinentes traducidos.

#### Scenario: Cambio institucional
- **WHEN** se consulta un evento de estado vinculado a una asignación visible
- **THEN** se muestra la sede correspondiente junto al cambio, fecha y nota

#### Scenario: Asignación fuera de la vista
- **WHEN** un evento autorizado referencia una asignación que no es visible para el usuario
- **THEN** la interfaz utiliza una etiqueta genérica sin ampliar el acceso a esa asignación

#### Scenario: Creación y confirmación
- **WHEN** se muestran creación, confirmación o corrección de una asignación
- **THEN** cada evento explica su acción y muestra los datos aplicables sin presentar una transición de valores artificial

#### Scenario: Prioridad y duplicado
- **WHEN** se muestran cambios de prioridad o vinculación de un duplicado
- **THEN** se usan prioridades legibles o la referencia del incidente relacionado si está autorizada y disponible

#### Scenario: Evento histórico desconocido
- **WHEN** aparece un evento antiguo cuyo tipo todavía carece de traducción
- **THEN** se presenta una descripción de evento no reconocido con fecha y datos disponibles y una referencia técnica desplegable
