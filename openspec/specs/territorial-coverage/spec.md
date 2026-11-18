# territorial-coverage Specification

## Purpose

Proporcionar una división territorial compartida y verificable para resolver ubicaciones y consultar información de los cinco distritos metropolitanos de Ayacucho.

## Requirements

### Requirement: Catálogo metropolitano compartido
El sistema SHALL publicar un catálogo metropolitano único con Ayacucho 050101, San Juan Bautista 050110, Carmen Alto 050104, Jesús Nazareno 050115 y Andrés Avelino Cáceres Dorregaray 050116. SHALL identificar departamento Ayacucho y provincia Huamanga y permitir distinguir el ámbito metropolitano de otros territorios configurados.

#### Scenario: Catálogo completo sin incidentes
- **WHEN** una pantalla solicita los distritos del ámbito metropolitano
- **THEN** recibe los cinco distritos con identificadores estables, nombres y UBIGEO, aunque alguno carezca de incidentes

#### Scenario: Relación con la municipalidad provincial
- **WHEN** se elige el distrito donde se ubica la sede central de la Municipalidad Provincial de Huamanga
- **THEN** el catálogo ofrece Ayacucho y conserva Huamanga como provincia

### Requirement: Cartografía distrital verificable
Cada distrito metropolitano SHALL disponer de su polígono o multipolígono referencial validado, procedente de la cartografía publicada por el INEI. SHALL conservar fuente, fecha o versión y fecha de incorporación y publicar geometría y extensión para su representación en ambos mapas.

#### Scenario: Consulta de límites
- **WHEN** se consulta la cartografía metropolitana
- **THEN** se reciben las cinco geometrías en WGS84, sus extensiones y su procedencia, identificadas como referenciales

#### Scenario: Fuente incompleta o inválida
- **WHEN** una carga carece de alguno de los cinco distritos o contiene geometría inválida
- **THEN** se informa la causa y la versión territorial activa sigue disponible íntegramente

### Requirement: Resolución territorial explícita
El sistema SHALL resolver el distrito de una ubicación válida mediante los polígonos activos. Un punto interior con coincidencia única SHALL recibir ese distrito. Los puntos sin coincidencia, en frontera compartida o con solapamiento SHALL conservar sus coordenadas y una condición explícita pendiente de revisión.

#### Scenario: Incidente dentro de un distrito
- **WHEN** se registra un incidente desde móvil o desde el panel con un punto interior inequívoco
- **THEN** el servidor conserva el distrito resuelto y ese incidente aparece bajo el mismo distrito en todas las consultas

#### Scenario: Punto ambiguo o exterior
- **WHEN** la coordenada cae sobre una frontera compartida, en un solapamiento o fuera de los polígonos activos
- **THEN** el reporte se conserva con distrito pendiente y la respuesta distingue el motivo

#### Scenario: Coordenada inválida
- **WHEN** se envía una coordenada fuera del rango geográfico permitido
- **THEN** la API rechaza la solicitud mediante un error de validación

### Requirement: Actualización territorial repetible
La actualización SHALL admitir bases con un distrito DEMO, cinco distritos DEMO o catálogo real existente. SHALL reconciliar referencias antiguas y conservar las identidades de incidentes, sedes, cuentas e historial. Repetir o reanudar una carga SHALL producir un catálogo canónico sin duplicados.

#### Scenario: Base antigua y segunda ejecución
- **WHEN** se actualiza una base con un distrito DEMO y se repite la carga
- **THEN** ambas ejecuciones terminan con los cinco distritos canónicos y referencias válidas, sin duplicar registros relacionados

#### Scenario: Reclasificación de ubicaciones
- **WHEN** se activa una nueva versión y se procesan incidentes existentes
- **THEN** sus coordenadas determinan la clasificación vigente y se conserva un resumen auditable de cambios y casos pendientes

#### Scenario: Asociaciones territoriales declaradas
- **WHEN** un contacto, alerta o sede tiene una asociación antigua que requiere reconciliación
- **THEN** se aplica una correspondencia verificada o se informa el caso pendiente, conservando el registro

### Requirement: Semántica territorial transversal
Los filtros SHALL usar el distrito del incidente para reportes y métricas, el de ubicación para sedes y el declarado para contactos y alertas. El historial SHALL usar el distrito del objeto o incidente relacionado cuando sea resoluble. Toda consulta institucional SHALL aplicar además los permisos del actor.

#### Scenario: Información del distrito seleccionado
- **WHEN** el usuario selecciona un distrito en una consulta territorial
- **THEN** los resultados usan esa semántica y los registros de distrito desconocido quedan identificados al consultar sin filtro

#### Scenario: Cobertura institucional que cruza distritos
- **WHEN** una sede atiende una zona de otro distrito
- **THEN** su cobertura mantiene sus reglas de atención y el incidente conserva el distrito de su ubicación
