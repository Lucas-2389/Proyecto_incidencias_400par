# admin-dashboard Specification

## Purpose

Permitir reconocer incidentes del ámbito institucional y abrirlos desde el Dashboard y la bandeja mediante controles accesibles, categorías y prioridades legibles.

## Requirements

### Requirement: Identificación y apertura en la bandeja de incidentes
La bandeja SHALL mostrar la categoría como nombre principal y la referencia como dato secundario, conservando estado, verificación, prioridad, fecha y filtros. Toda la fila SHALL abrir el detalle mediante un enlace accesible por teclado y con foco visible. SHALL retirarse Abrir y su columna. Si falta el nombre en la respuesta, SHALL utilizar el catálogo disponible o mostrar Categoría no disponible.

#### Scenario: Reporte reconocible y accesible
- **WHEN** un usuario consulta la bandeja y activa una fila con clic o su enlace con Enter
- **THEN** ve categoría y referencia, abre el detalle del incidente correspondiente y puede distinguir el foco de teclado

#### Scenario: Clasificación ausente
- **WHEN** un reporte carece de nombre de categoría en la respuesta y el catálogo
- **THEN** la fila muestra Categoría no disponible y conserva su referencia y acceso al detalle

### Requirement: Resaltado visual de la fila de incidente
La bandeja SHALL indicar la fila bajo el cursor mediante un cambio de color de fondo, manteniendo categoría y referencia sin subrayado. El enlace SHALL conservar el acceso al detalle y un contorno de foco visible para la navegación por teclado.

#### Scenario: Cursor sobre el identificador
- **WHEN** el usuario pasa el cursor sobre la categoría o la referencia de un incidente
- **THEN** la fila cambia de color y ambos textos se presentan sin subrayado

#### Scenario: Foco sobre la fila
- **WHEN** el usuario alcanza el enlace de un incidente mediante teclado
- **THEN** el foco identifica la fila completa y Enter permite abrir el detalle

### Requirement: Prioridad consistente en Dashboard
El Dashboard SHALL mostrar Baja en gris, Normal en azul, Alta en ámbar y Crítica en rojo, con texto e indicador de alerta para Alta y Crítica, coherentes con bandeja y detalle. Una prioridad ausente o desconocida SHALL mostrarse como Por confirmar con apariencia neutra.

#### Scenario: Prioridades reconocibles
- **WHEN** el Dashboard recibe incidentes con las cuatro prioridades conocidas
- **THEN** cada incidente muestra su etiqueta y color correspondientes y Alta y Crítica incluyen alerta

#### Scenario: Prioridad desconocida
- **WHEN** un incidente carece de prioridad o presenta un valor desconocido
- **THEN** su bloque muestra Por confirmar y permite abrir el reporte

### Requirement: Apertura desde el bloque completo
Cada bloque de incidente reciente SHALL permitir abrir su detalle autorizado al hacer clic en cualquier parte o activarlo por teclado, con foco visible y nombre accesible. El Dashboard SHALL retirar Ver reporte y la columna Acción.

#### Scenario: Apertura por clic
- **WHEN** el usuario hace clic en el título, referencia, estado, prioridad o espacio libre de un bloque
- **THEN** se abre el detalle del incidente correspondiente

#### Scenario: Apertura por teclado
- **WHEN** el usuario alcanza un bloque con Tab y lo activa con Enter
- **THEN** el foco es visible y se abre el detalle correspondiente

### Requirement: Categoría como nombre del incidente
El Dashboard SHALL mostrar el nombre de la categoría como título principal y la referencia como dato secundario. La consulta operativa SHALL proporcionar categoryName además de sus campos existentes, incluyendo categorías inactivas vinculadas a reportes históricos. Si el nombre falta, SHALL mostrar Categoría no disponible y conservar la referencia.

#### Scenario: Reporte identificado por categoría
- **WHEN** el listado operativo contiene un reporte con categoría identificable
- **THEN** devuelve categoryName y el Dashboard muestra ese nombre destacado con la referencia debajo

#### Scenario: Categoría histórica
- **WHEN** un reporte pertenece a una categoría desactivada
- **THEN** el reporte conserva su nombre de categoría en el listado autorizado

#### Scenario: Nombre no disponible
- **WHEN** el Dashboard recibe un reporte sin categoryName utilizable
- **THEN** muestra Categoría no disponible, su referencia y el acceso al detalle

### Requirement: Continuidad del listado reciente
El Dashboard SHALL conservar el ámbito autorizado, orden reciente y límite de seis incidentes y distinguir carga, error y lista vacía. Las nuevas etiquetas SHALL respetar los permisos existentes de consulta y apertura.

#### Scenario: Sin reportes
- **WHEN** la consulta termina correctamente sin incidentes visibles
- **THEN** se informa que no hay incidentes recientes

#### Scenario: Error de consulta
- **WHEN** falla la carga de incidentes recientes
- **THEN** se muestra un error de lectura sin presentar el resultado como lista vacía

#### Scenario: Ámbito institucional
- **WHEN** un operador consulta incidentes recientes
- **THEN** obtiene hasta seis incidentes de su ámbito ordenados del más reciente al más antiguo y el detalle aplica la autorización vigente
