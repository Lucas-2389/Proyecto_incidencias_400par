# incident-dispatch Specification

## Purpose

Permitir la asignación institucional de un incidente con recursos opcionales y mantener las garantías de reserva cuando la solicitud incluye unidades o personal.

## Requirements

### Requirement: Recursos opcionales en la asignación institucional
`POST /api/v1/ops/incidents/{id}/assignments` SHALL aceptar la omisión independiente de `unitIds` y `personnelIds` y normalizar cada arreglo omitido a `[]`. SHALL conservar los campos obligatorios de institución y sede y las condiciones actuales para la corrección manual.

#### Scenario: Asignación sin recursos
- **WHEN** un usuario autorizado asigna una sede válida de un incidente atendible omitiendo ambos arreglos
- **THEN** recibe 201 con `unitIds=[]` y `personnelIds=[]` y se registra la asignación institucional

#### Scenario: Solo unidades
- **WHEN** una solicitud válida incluye unidades disponibles y omite `personnelIds`
- **THEN** se reservan las unidades y la respuesta contiene `personnelIds=[]`

#### Scenario: Solo personal
- **WHEN** una solicitud válida incluye personal disponible y omite `unitIds`
- **THEN** se reserva el personal y la respuesta contiene `unitIds=[]`

#### Scenario: Arreglos vacíos explícitos
- **WHEN** una solicitud válida contiene ambos arreglos vacíos
- **THEN** obtiene el mismo comportamiento de recursos que al omitirlos

### Requirement: Validación y consistencia de recursos suministrados
Los arreglos suministrados SHALL mantener sus validaciones de tipo, unicidad, identificadores y límite de 30 elementos. Las reservas SHALL conservar disponibilidad, pertenencia institucional, ámbito de sede y protección frente a concurrencia.

#### Scenario: Valor inválido
- **WHEN** un arreglo se envía como `null`, una cadena o contiene duplicados o identificadores inválidos
- **THEN** la API responde 422 y conserva la consistencia de la asignación

#### Scenario: Recurso ocupado
- **WHEN** una solicitud incluye un recurso ocupado o de otra sede
- **THEN** la API responde 409 y revierte la asignación y las reservas de esa solicitud

#### Scenario: Competencia concurrente
- **WHEN** dos solicitudes intentan reservar el mismo recurso en atenciones incompatibles
- **THEN** como máximo una se confirma y la otra recibe conflicto

### Requirement: Contrato de asignaciones con recursos opcionales
OpenAPI SHALL declarar ambos arreglos opcionales en la solicitud y documentar su normalización a listas vacías, límites y ejemplos con y sin recursos. La respuesta de asignación SHALL conservar los arreglos normalizados.

#### Scenario: Cliente generado desde el contrato
- **WHEN** un cliente construye una solicitud que solo contiene los campos obligatorios
- **THEN** el contrato permite enviarla y describe una respuesta con arreglos vacíos


### Requirement: Despacho administrativo directo a sede
El panel SHALL permitir confirmar una sede autorizada y un operador opcional de esa sede sin seleccionar unidades ni personal. SHALL exigir motivo al corregir la derivación sugerida y conservar la validación institucional del operador.

#### Scenario: Despacho simplificado
- **WHEN** un usuario confirma una sede sugerida y un operador activo de esa sede
- **THEN** se registra la asignación con ese operador y sin recursos seleccionados, y se actualiza su seguimiento

#### Scenario: Sin operador disponible
- **WHEN** se confirma una sede válida sin elegir operador
- **THEN** se registra la asignación institucional con operador pendiente

#### Scenario: Corrección manual
- **WHEN** el usuario elige una sede autorizada fuera de las sugerencias
- **THEN** debe proporcionar un motivo para confirmar y la decisión queda trazada

#### Scenario: Operador incompatible
- **WHEN** se intenta despachar a un operador inactivo o ajeno a la sede
- **THEN** se rechaza la solicitud sin crear la asignación

### Requirement: Consulta operativa de operadores elegibles
Los usuarios operativos autorizados SHALL poder consultar operadores activos de una sede autorizada para despachar un incidente accesible. La respuesta SHALL limitarse a identificador y nombre de usuarios con membresía activa de Operador en esa sede.

#### Scenario: Selección por operador institucional
- **WHEN** un usuario con rol Operador consulta los operadores elegibles de su sede para un incidente autorizado
- **THEN** recibe los identificadores y nombres de los operadores activos de esa sede

#### Scenario: Consulta fuera de ámbito
- **WHEN** se consulta una sede o incidente fuera del ámbito del actor
- **THEN** se deniega el acceso

#### Scenario: Sede sin operadores activos
- **WHEN** una sede autorizada carece de operadores elegibles
- **THEN** se devuelve una lista vacía y el panel permite continuar con operador pendiente

### Requirement: Participación concurrente de sedes
El sistema SHALL permitir que distintas sedes autorizadas atiendan simultáneamente el mismo incidente. Cada confirmación SHALL añadir una asignación independiente y SHALL conservar la unicidad por incidente y sede.

#### Scenario: Varias instituciones
- **WHEN** se confirman sedes de Bomberos y SAMU para un mismo incidente atendible
- **THEN** ambas asignaciones coexisten con sus propios operadores y estados

#### Scenario: Confirmaciones desde sesiones diferentes
- **WHEN** dos sesiones autorizadas confirman simultáneamente sedes distintas sobre un incidente atendible
- **THEN** ambas asignaciones se conservan tras completar las transacciones

#### Scenario: Misma sede concurrente
- **WHEN** dos sesiones intentan asignar la misma sede al mismo incidente
- **THEN** se conserva una única asignación y la solicitud duplicada recibe conflicto sin escrituras parciales

### Requirement: Tarjetas de seguimiento por sede
El panel SHALL representar cada asignación visible con institución y sede legibles, operador visible o su disponibilidad, estado y fecha de asignación. SHALL permitir avanzar cada asignación mediante su siguiente transición autorizada y conservar las cerradas al final con su fecha de cierre.

#### Scenario: Avances diferentes
- **WHEN** Bomberos está En atención y SAMU está Unidad en camino
- **THEN** se muestran tarjetas con sus estados respectivos y cada acción modifica únicamente la asignación seleccionada

#### Scenario: Asignación cerrada
- **WHEN** una asignación alcanza Cerrado
- **THEN** su tarjeta permanece consultable al final, con fecha de cierre y sin otra acción de avance

#### Scenario: Identidad de operador no disponible
- **WHEN** una asignación referencia un operador que el catálogo autorizado no devuelve
- **THEN** la tarjeta indica Operador no disponible sin mostrar su identificador interno

### Requirement: Seguimiento sujeto al ámbito de asignación
El panel SHALL mostrar las asignaciones devueltas por el servicio conforme al ámbito del usuario y SHALL identificar cualquier contador como relativo a asignaciones visibles. El estado global SHALL proceder del detalle autorizado del incidente.

#### Scenario: Visión parcial
- **WHEN** un operador recibe únicamente la asignación de su sede
- **THEN** ve esa asignación y el estado global servido para el incidente aunque existan otras participaciones fuera de su ámbito

### Requirement: Estado global consistente al incorporar participantes
Al confirmar una nueva asignación, el sistema SHALL recalcular transaccionalmente el estado global según la etapa menos avanzada entre todas sus asignaciones. SHALL registrar el cambio global cuando corresponda y conservar las restricciones actuales de incidentes finalizados.

#### Scenario: Incorporación durante la atención
- **WHEN** un incidente En atención recibe una nueva asignación en estado Asignado
- **THEN** el estado global pasa a Asignado y el estado previo de las demás asignaciones se conserva

#### Scenario: Cierre con atención pendiente
- **WHEN** una asignación se cierra mientras otra sigue En atención
- **THEN** el estado global permanece En atención

#### Scenario: Falla de confirmación
- **WHEN** falla una escritura de la nueva asignación o de su cambio global
- **THEN** la transacción revierte sus escrituras de asignación, estado e historial

#### Scenario: Incidente finalizado
- **WHEN** se intenta añadir una sede a un incidente Resuelto o Cerrado
- **THEN** el servicio rechaza la confirmación conforme al ciclo de vida vigente

### Requirement: Actualización entre sesiones y recuperación de conflictos
El detalle SHALL actualizar el seguimiento periódicamente mientras esté visible y permitir actualizarlo manualmente. Ante un conflicto SHALL recargar los datos y conservar los valores editados. Una acción pendiente SHALL impedir su envío duplicado desde el mismo control.

#### Scenario: Avance desde otra sesión
- **WHEN** otra sesión avanza una asignación y el detalle permanece visible
- **THEN** el siguiente ciclo de actualización muestra el estado confirmado sin perder la edición local

#### Scenario: Acción sobre estado anterior
- **WHEN** una transición o despacho recibe 409 por un cambio concurrente
- **THEN** el panel informa el conflicto y recupera el estado actual sin reenviar automáticamente la acción

#### Scenario: Doble pulsación
- **WHEN** el usuario pulsa de nuevo un control cuya solicitud está pendiente
- **THEN** el panel mantiene un único envío para esa acción

### Requirement: Historial contextualizado por asignación
El historial operativo SHALL identificar la institución y sede de los eventos cuya asignación sea visible, y SHALL conservar la distinción entre avances de asignación y cambios globales del incidente.

#### Scenario: Cambio institucional
- **WHEN** se consulta un evento de estado vinculado a una asignación visible
- **THEN** se muestra la sede correspondiente junto al cambio, fecha y nota

#### Scenario: Asignación fuera de la vista
- **WHEN** un evento autorizado referencia una asignación que no es visible para el usuario
- **THEN** la interfaz utiliza una etiqueta genérica sin ampliar el acceso a esa asignación
