# Spec Delta

## MODIFIED Requirements

### Requirement: Filtros territoriales comprensibles
El mapa SHALL presentar los filtros en el orden Tipo de incidente, Distrito y Fechas opcionales. El tipo SHALL corresponder a una categoría del catálogo. El distrito SHALL seleccionarse por nombre desde el catálogo metropolitano compartido y SHALL incluir Todos los distritos. La selección SHALL filtrar incidentes y sedes autorizados por su distrito correspondiente.

#### Scenario: Categoría y distrito
- **WHEN** el usuario selecciona un tipo y un distrito por sus nombres
- **THEN** la consulta transmite sus identificadores y muestra únicamente los incidentes autorizados que cumplen ambos filtros y las sedes autorizadas ubicadas en ese distrito

#### Scenario: Carga fallida de distritos
- **WHEN** falla la consulta del catálogo territorial
- **THEN** la pantalla informa el error y permite reintentar sin solicitar al usuario un identificador numérico de distrito

#### Scenario: Distritos con nombres repetidos
- **WHEN** el catálogo contiene distritos con el mismo nombre
- **THEN** sus opciones incluyen el código territorial para distinguirlos y transmiten el identificador del distrito seleccionado

## ADDED Requirements

### Requirement: Límites y encuadre distritales
El mapa SHALL dibujar los cinco límites referenciales y destacar y encuadrar el distrito seleccionado. Todos los distritos SHALL encuadrar el conjunto metropolitano. El límite SHALL permanecer visible aunque la consulta carezca de incidentes. La pantalla SHALL identificar fuente y carácter referencial de la cartografía.

#### Scenario: Distrito sin reportes
- **WHEN** se selecciona un distrito sin incidentes en el periodo
- **THEN** se encuadra su polígono y se informa que no hay reportes para esos filtros

#### Scenario: Cambio rápido de distrito
- **WHEN** el usuario cambia de distrito mientras hay solicitudes pendientes
- **THEN** límites, resultados y contadores corresponden a la última selección y se descartan respuestas anteriores

#### Scenario: Fallo de cartografía
- **WHEN** falla la descarga de geometrías
- **THEN** se informa el error con reintento y los resultados conservan el filtro territorial solicitado
