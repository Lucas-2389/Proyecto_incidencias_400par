# Spec Delta

## ADDED Requirements

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
