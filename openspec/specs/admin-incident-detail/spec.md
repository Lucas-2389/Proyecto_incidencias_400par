# admin-incident-detail Specification

## Purpose

Presentar a los usuarios institucionales el contexto del reporte, sus observaciones de triage y su ubicación para coordinar la atención y confirmar acciones operativas.

## Requirements

### Requirement: Triage rápido en la información del reporte
La información del reporte SHALL mostrar el triage disponible con conciencia, respiración y sangrado como Sí, No o No informado, subtipo legible y cantidad de afectados. SHALL conservar el significado de las respuestas negativas y de la cantidad cero. Las observaciones SHALL identificarse como correspondientes a la persona principal descrita en el reporte.

#### Scenario: Valores conocidos y desconocidos
- **WHEN** un reporte contiene conciencia falsa, respiración verdadera, sangrado desconocido y tres afectados
- **THEN** la información muestra No, Sí, No informado y tres afectados junto a la descripción de la persona principal

#### Scenario: Solo respuestas negativas
- **WHEN** las tres observaciones valen falso y la cantidad de afectados vale cero
- **THEN** se muestra el triage con sus tres respuestas No y cero afectados

#### Scenario: Subtipo disponible
- **WHEN** el reporte tiene subtipo y el catálogo contiene su nombre
- **THEN** la información muestra ese nombre

#### Scenario: Reporte histórico sin triage
- **WHEN** todas las observaciones, el subtipo y la cantidad de afectados son desconocidos o están ausentes
- **THEN** la información indica que el triage no fue informado

#### Scenario: Subtipo fuera del catálogo activo
- **WHEN** el reporte referencia un subtipo cuyo nombre no está disponible en el catálogo
- **THEN** la información conserva los demás datos e indica Subtipo no disponible

### Requirement: Ubicación del reporte en minimapa
El detalle autorizado SHALL mostrar un minimapa con un marcador en las coordenadas del reporte cuando sean válidas, junto a la referencia de ubicación disponible. SHALL distinguir ubicaciones ausentes y errores de carga cartográfica.

#### Scenario: Reporte geolocalizado
- **WHEN** el detalle contiene latitud y longitud válidas
- **THEN** el minimapa se centra en ese punto y muestra su marcador y referencia

#### Scenario: Cambio de incidente
- **WHEN** el usuario navega desde un detalle hacia otro con coordenadas diferentes
- **THEN** el minimapa muestra la ubicación del nuevo incidente

#### Scenario: Sin ubicación
- **WHEN** el reporte carece de ubicación válida
- **THEN** el detalle indica Ubicación no disponible y omite el marcador

#### Scenario: Cartografía no disponible
- **WHEN** falla la carga de la cartografía de un punto válido
- **THEN** el detalle conserva la referencia y coordenadas legibles y permite seguir consultando el reporte

### Requirement: Control replegable tras confirmación
El panel Verificar y priorizar SHALL ubicarse después de Fotografías y permitir expandirse y replegarse mediante un control accesible. SHALL iniciarse replegado al abrir un incidente y replegarse tras confirmar correctamente una acción del propio panel. El resultado SHALL permanecer visible y el panel SHALL poder reabrirse.

#### Scenario: Distribución del detalle
- **WHEN** se abre un incidente en escritorio
- **THEN** Información y triage aparecen a la izquierda, la ubicación en una tarjeta a la derecha y Control replegado después de Fotografías

#### Scenario: Verificación confirmada
- **WHEN** el usuario guarda correctamente la verificación
- **THEN** el panel se repliega, muestra el resultado de la operación y permite volver a expandirse

#### Scenario: Inicio de verificación
- **WHEN** se confirma correctamente Iniciar verificación
- **THEN** el panel se repliega y el estado actualizado del incidente permanece visible

#### Scenario: Acción rechazada
- **WHEN** la validación o la API rechaza una acción del panel
- **THEN** el panel permanece abierto con sus valores y un mensaje que permite corregir el problema

#### Scenario: Recuperación de lectura fallida
- **WHEN** la API confirma la acción pero falla la recarga posterior del reporte
- **THEN** la pantalla informa la confirmación y el fallo de actualización, permite reintentar la lectura y evita inducir un reenvío de la acción confirmada

### Requirement: Prioridad reconocible y editable
El panel SHALL mostrar la prioridad mediante una insignia con texto y color consistentes en bandeja y detalle. Alta y Crítica SHALL incluir un indicador de alerta. El control SHALL mostrar la prioridad actual y permitir guardar su cambio con motivo, conservando el resultado de verificación seleccionado.

#### Scenario: Cambio de prioridad
- **WHEN** un usuario cambia la prioridad a Crítica e indica el motivo en Control
- **THEN** se guarda la prioridad junto con el resultado de verificación seleccionado y el detalle muestra la insignia Prioridad crítica

### Requirement: Organización visual de Cobertura y reglas
La tarjeta Derivación sugerida SHALL presentar las sedes sugeridas y el formulario de asignación en áreas diferenciadas. Cada sugerencia SHALL mostrar institución, sede destacada y motivo de la regla con separación visual. El formulario SHALL agrupar Sede responsable y Operador y ubicar Confirmar asignación al pie, separado de los campos y mensajes.

#### Scenario: Distribución en escritorio
- **WHEN** el usuario abre un incidente con sugerencias en una pantalla con espacio para dos columnas
- **THEN** ve las sugerencias a la izquierda y el formulario a la derecha, con institución, sede y motivo diferenciados y la confirmación al pie del formulario

#### Scenario: Sede seleccionada
- **WHEN** el usuario selecciona una sede sugerida
- **THEN** la sugerencia presenta la señal visual de selección y los controles muestran los valores correspondientes

### Requirement: Distribución adaptable de la tarjeta
Cobertura y reglas SHALL apilar sugerencias y formulario cuando el ancho disponible sea reducido. En pantalla compacta SHALL apilar Sede responsable y Operador y presentar la confirmación al ancho disponible. Cuando no existan sugerencias, el formulario SHALL aprovechar el área completa.

#### Scenario: Pantalla compacta
- **WHEN** el detalle se consulta en una pantalla compacta
- **THEN** las sugerencias, el formulario y sus campos se presentan en una columna y la confirmación es alcanzable sin desbordamiento horizontal

#### Scenario: Ausencia de sugerencias
- **WHEN** el incidente admite asignación y carece de sedes sugeridas
- **THEN** el formulario ocupa el área disponible y muestra los avisos de cobertura que correspondan

### Requirement: Continuidad operativa de los controles reorganizados
La reorganización visual SHALL conservar selección de sede y operador, motivo de corrección cuando corresponda, mensajes de error y reintento, estados de carga y deshabilitación y confirmación de asignación. Un incidente finalizado SHALL mostrar el estado informativo vigente.

#### Scenario: Asignación desde el formulario reorganizado
- **WHEN** el usuario selecciona una sede y confirma una asignación válida
- **THEN** se aplica el flujo vigente de asignación con los valores elegidos y sus validaciones

#### Scenario: Error al consultar operadores
- **WHEN** falla la consulta de operadores de la sede seleccionada
- **THEN** se muestra el error con su acción de reintento y el selector conserva el estado de deshabilitación correspondiente

#### Scenario: Incidente finalizado
- **WHEN** el incidente está finalizado
- **THEN** la tarjeta informa esa condición según el comportamiento operativo vigente
