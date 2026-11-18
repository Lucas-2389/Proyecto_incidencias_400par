# Spec Delta

## ADDED Requirements

### Requirement: Mapa móvil por incidentes públicos
La vista Mapa SHALL presentar incidentes mediante íconos vectoriales distinguibles por categoría, con leyenda y etiquetas accesibles. SHALL representar posiciones aproximadas y abrir una ficha pública al seleccionar un marcador. La vista móvil SHALL sustituir la representación de calor por esta representación individual.

#### Scenario: Seleccionar incidente
- **WHEN** un invitado o ciudadano pulsa un marcador
- **THEN** ve referencia, categoría, estado, fecha, indicación de ubicación aproximada y acción para guardar o quitar favorito

#### Scenario: Marcadores coincidentes
- **WHEN** varios incidentes comparten una posición aproximada
- **THEN** el usuario puede seleccionar cada incidente mediante una agrupación o lista de selección

#### Scenario: Carga vacía o fallida
- **WHEN** la consulta está cargando, termina sin resultados o falla
- **THEN** la pantalla informa el estado y ofrece reintentar cuando corresponde sin presentar resultados anteriores como actuales

### Requirement: Orden de filtros del mapa móvil
La IU SHALL ordenar los filtros como Categoría, Distrito y Fechas opcionales. Categoría y Distrito SHALL permitir Todas y Todos respectivamente. Fechas SHALL poder activarse y borrarse y mostrar el intervalo efectivo de siete días cuando estén omitidas.

#### Scenario: Filtrar mapa
- **WHEN** se cambia una categoría o distrito y se aplica un intervalo válido opcional
- **THEN** se actualizan los marcadores según la combinación elegida y se conserva el orden visual de filtros

#### Scenario: Fechas completas del usuario
- **WHEN** el usuario selecciona días de inicio y fin inclusivos
- **THEN** se consulta desde el inicio del primer día hasta el inicio del día posterior al último en la zona horaria del dispositivo, con transporte de fechas en UTC

#### Scenario: Respuesta tardía
- **WHEN** una consulta anterior termina después de otra iniciada con nuevos filtros
- **THEN** la vista conserva únicamente el resultado correspondiente a la selección vigente

### Requirement: Favoritos locales de incidentes públicos
La app SHALL permitir guardar y quitar incidentes públicos ajenos como favoritos del dispositivo mediante SharedPreferences. SHALL ofrecer una lista accesible desde Mapa para invitados y ciudadanos y conservar identificadores únicos al reiniciar. SHALL almacenar únicamente el identificador público y mantener disponibles las acciones de eliminación local.

#### Scenario: Persistencia sin cuenta
- **WHEN** un invitado guarda un incidente y reinicia la app
- **THEN** el incidente permanece en Favoritos y puede quitarse sin iniciar sesión

#### Scenario: Doble pulsación o cambio de sesión
- **WHEN** se guarda repetidamente un incidente o se cambia de cuenta
- **THEN** existe una única entrada local por identificador y los favoritos del dispositivo permanecen disponibles

#### Scenario: Error de almacenamiento
- **WHEN** falla la escritura de favoritos
- **THEN** la app informa el fallo y conserva el estado persistido anterior sin confirmar un guardado o eliminación fallidos

### Requirement: Actualización pública de favoritos
La lista de favoritos y su ficha SHALL consultar el estado público vigente y permitir recarga manual. Un favorito SHALL dar acceso únicamente a la información pública permitida. La app SHALL representar un incidente retirado o sensible como No disponible y un fallo de red como fallo recuperable.

#### Scenario: Estado actualizado
- **WHEN** se abre Favoritos o se recarga después de un cambio institucional
- **THEN** se consulta el detalle público por identificador y se muestra el estado vigente incluso fuera de los filtros actuales del mapa

#### Scenario: Favorito retirado o sensible
- **WHEN** la consulta pública devuelve 404
- **THEN** se presenta No disponible, se retira el contenido previo de la ficha y se permite eliminar el identificador local

#### Scenario: Fallo de conexión
- **WHEN** falla la consulta de uno de los favoritos
- **THEN** se conserva su identificador, se indica que no pudo actualizarse y se ofrece reintentar

#### Scenario: Historial privado ajeno
- **WHEN** se abre un favorito de otro reportante
- **THEN** la app usa la consulta pública y muestra únicamente su proyección mínima, manteniendo el historial privado sujeto a propiedad
