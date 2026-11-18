# Spec Delta

## ADDED Requirements

### Requirement: Selección territorial móvil por nombre
Mapa, Contactos y Alertas SHALL ofrecer los cinco distritos del catálogo metropolitano compartido mediante sus nombres. Cada pantalla SHALL mantener su selección durante la recarga, permitir limpiar el filtro e informar errores recuperables del catálogo. La interacción SHALL ser accesible con texto ampliado y nombres largos.

#### Scenario: Distrito en las tres pantallas
- **WHEN** un invitado abre Mapa, Contactos o Alertas
- **THEN** puede elegir cualquiera de los cinco distritos por nombre y las consultas usan el identificador del catálogo

#### Scenario: Alerta general y distrito seleccionado
- **WHEN** se consulta Alertas con un distrito
- **THEN** se muestran sus publicaciones vigentes junto con las alertas generales aplicables

#### Scenario: Sin selección territorial
- **WHEN** se limpia el filtro
- **THEN** Mapa muestra los incidentes públicos elegibles, Contactos los nacionales y Alertas las generales, con una indicación comprensible del alcance de cada vista

### Requirement: Límites distritales en el mapa móvil
El mapa móvil SHALL representar la misma cartografía referencial que el panel, destacar y encuadrar el distrito seleccionado y encuadrar el conjunto al elegir Todos. Los filtros de categoría y fechas SHALL combinarse con el distrito y la pantalla SHALL mantener contorno y estado vacío cuando falten reportes.

#### Scenario: Filtros combinados
- **WHEN** se seleccionan distrito, categoría y periodo válidos
- **THEN** el mapa encuadra el distrito y muestra los incidentes públicos que cumplen todos los filtros

#### Scenario: Respuesta tardía o error
- **WHEN** llega una respuesta de un distrito anterior o falla la lectura actual
- **THEN** la respuesta anterior se descarta y el fallo actual se informa con opción de reintento conservando la selección

### Requirement: Distrito público calculado antes de aproximar
El filtrado público SHALL usar el distrito resuelto en el servidor mediante la ubicación original del incidente. La posición mostrada SHALL conservar la aproximación vigente y la exclusión de datos sensibles. La app SHALL explicar que los puntos son aproximados cuando su representación pueda diferir del contorno seleccionado.

#### Scenario: Marcador aproximado junto a una frontera
- **WHEN** un incidente del distrito seleccionado tiene una posición aproximada que cruza visualmente el límite
- **THEN** se conserva su pertenencia territorial y se identifica la ubicación como aproximada

#### Scenario: Incidente sensible
- **WHEN** se filtra el distrito que contiene un incidente sensible
- **THEN** ese incidente continúa excluido de las consultas públicas y su detalle mantiene las restricciones vigentes
