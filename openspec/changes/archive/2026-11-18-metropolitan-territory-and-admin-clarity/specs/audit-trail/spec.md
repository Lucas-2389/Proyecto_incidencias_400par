# Spec Delta

## Purpose

Permitir reconstruir las acciones administrativas y operativas mediante eventos comprensibles, filtrables y limitados al ámbito autorizado.

## ADDED Requirements

### Requirement: Eventos comprensibles
El historial SHALL mostrar fecha en hora de Perú, acción específica, nombre disponible del actor, registro afectado, institución, sede y distrito cuando sean aplicables y autorizados. SHALL ofrecer detalle de los campos modificados y enlaces a registros accesibles. Los identificadores técnicos SHALL quedar disponibles como referencia secundaria.

#### Scenario: Teléfono modificado
- **WHEN** se consulta la actualización de un contacto
- **THEN** se identifica quién lo actualizó, el nombre del contacto, fecha, ámbito y valores anterior y nuevo del teléfono

#### Scenario: Actor o registro antiguo ausente
- **WHEN** un evento carece de nombre recuperable o su objeto ya no está disponible
- **THEN** se presenta una referencia legible de disponibilidad y los datos históricos existentes, sin inventar nombres ni valores anteriores

### Requirement: Filtros y navegación de auditoría
La consulta SHALL admitir búsqueda por nombre de actor, registro o referencia de incidente, tipo, acción, institución, sede, distrito y fechas. SHALL combinar filtros, ordenar de forma estable y permitir recorrer los resultados con estado de continuidad. La API SHALL conservar los campos existentes para sus consumidores.

#### Scenario: Eventos antiguos con nombres plurales
- **WHEN** se filtran sedes, usuarios o contactos
- **THEN** se incluyen sus variantes históricas equivalentes y las acciones mantienen etiquetas específicas

#### Scenario: Más de una página
- **WHEN** hay más eventos que el tamaño de página
- **THEN** se permite avanzar y regresar con los filtros vigentes y conocer si existen más resultados

#### Scenario: Fechas inválidas y estados de lectura
- **WHEN** el periodo es inválido o falla la consulta
- **THEN** se informa el problema de forma recuperable y se distingue del estado sin coincidencias

### Requirement: Registro consistente de cambios
Las nuevas modificaciones de cuentas, sedes y contactos SHALL registrar actor, objeto, ámbito, campos permitidos anteriores y posteriores y fecha junto con el cambio persistido. El registro SHALL excluir contraseñas, hashes, tokens y secretos. Un fallo SHALL conservar consistencia entre la operación y su auditoría.

#### Scenario: Actualización rechazada o fallida
- **WHEN** una actualización falla durante su persistencia o el registro de auditoría
- **THEN** la operación termina sin un cambio confirmado que carezca de su auditoría correspondiente

#### Scenario: Alta de usuario
- **WHEN** se crea un usuario institucional con contraseña
- **THEN** se auditan identidad y membresía permitidas y se excluyen la contraseña y su hash

### Requirement: Consulta autorizada y compatibilidad histórica
La auditoría SHALL autorizar sus eventos antes de enriquecer nombres, buscar o paginar. Los filtros y enlaces SHALL respetar permisos de institución y sede. Los eventos antiguos SHALL permanecer consultables y los campos ausentes SHALL mostrarse como información no disponible.

#### Scenario: Búsqueda de un objeto ajeno
- **WHEN** un administrador busca el nombre o referencia de un registro fuera de su ámbito
- **THEN** los eventos, nombres, resultados de búsqueda y metadatos de navegación excluyen ese registro

#### Scenario: Cierre de incidente
- **WHEN** un incidente se cierra
- **THEN** sus eventos continúan disponibles para los roles autorizados

### Requirement: Indicadores con significado explícito
Los indicadores de Historial SHALL nombrar la medida y el periodo aplicado. Fecha, distrito e institución SHALL aplicarse coherentemente a sus métricas operativas. Los filtros exclusivos de auditoría SHALL identificarse como tales. Un promedio sin datos SHALL mostrarse como Sin datos.

#### Scenario: Tiempo de asignación
- **WHEN** se presenta el promedio de asignación
- **THEN** se explica que mide minutos desde el registro hasta las asignaciones visibles del conjunto de incidentes seleccionado, incluyendo cada asignación elegible

#### Scenario: Filtro por acción
- **WHEN** se elige una acción de auditoría
- **THEN** el listado aplica ese filtro y la pantalla permite reconocer el ámbito y periodo usados por los indicadores operativos
