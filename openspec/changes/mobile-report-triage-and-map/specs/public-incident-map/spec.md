# Spec Delta

## Purpose

Permitir localizar incidentes públicos mediante posiciones aproximadas y consultar su estado, aplicando exclusión de casos sensibles y minimización de datos personales en el servidor.

## ADDED Requirements

### Requirement: Proyección pública mínima por incidente
La API SHALL ofrecer una consulta pública por incidente con identificador, referencia, categoría, distrito cuando exista, estado, fecha de creación y posición aproximada. MUST excluir identidad, contacto, descripción, referencia textual del lugar, evidencia, observaciones clínicas, personal e información interna.

#### Scenario: Consulta pública válida
- **WHEN** un invitado consulta el mapa de incidentes
- **THEN** recibe únicamente los campos públicos permitidos de los incidentes elegibles

#### Scenario: Posición aproximada estable
- **WHEN** el mismo incidente se consulta varias veces o con distintos filtros
- **THEN** la posición publicada procede del centro de una celda fija de 0,01 grados y se identifica como aproximada
- **AND** la respuesta excluye las coordenadas originales y su precisión de captura

#### Scenario: Coordenadas en los límites geográficos
- **WHEN** un incidente elegible tiene latitud de -90° o 90°, o longitud de -180° o 180°
- **THEN** la posición aproximada usa el centro de la celda válida del borde correspondiente, con latitudes de -89,995° o 89,995° y longitudes de -179,995° o 179,995° respectivamente
- **AND** toda posición publicada conserva latitud entre -90° y 90° y longitud entre -180° y 180°

### Requirement: Exclusión pública de incidentes sensibles
El servidor MUST excluir de las consultas públicas individuales cualquier incidente cuya categoría o subcategoría esté marcada como sensible, incluidos los casos sensibles de violencia. La exclusión SHALL aplicarse también al detalle público consultado directamente por identificador.

#### Scenario: Categoría o subtipo sensible
- **WHEN** un incidente tiene una categoría sensible o una subcategoría sensible dentro de una categoría pública
- **THEN** el incidente queda ausente del mapa y su detalle público responde 404

#### Scenario: Reclasificación de un favorito
- **WHEN** un incidente antes público pasa a una clasificación sensible
- **THEN** las siguientes consultas públicas omiten el incidente y su detalle responde 404 con la misma respuesta que un identificador inexistente

### Requirement: Filtros públicos y límites de consulta
La consulta SHALL aceptar categoría y distrito opcionales, junto con fechas opcionales de inicio y fin. Al omitir ambas fechas SHALL usar los últimos siete días. SHALL exigir ambas si se proporciona alguna, validar un intervalo creciente de hasta 90 días y rechazar consultas de más de 5000 incidentes elegibles sin truncamiento silencioso.

#### Scenario: Filtros combinados
- **WHEN** se consultan categoría, distrito e intervalo válidos
- **THEN** se devuelven los incidentes públicos que cumplen todos los filtros, con inicio inclusivo y fin exclusivo sobre la fecha de creación

#### Scenario: Consulta sin fechas
- **WHEN** el cliente omite inicio y fin
- **THEN** el servidor aplica y devuelve el intervalo efectivo de los últimos siete días

#### Scenario: Consulta inválida o excesiva
- **WHEN** hay identificadores inválidos, una sola fecha, un intervalo invertido o mayor a 90 días, o más de 5000 resultados elegibles
- **THEN** la API responde 422 con un error recuperable que permite corregir o reducir la consulta

### Requirement: Seguimiento público por identificador
La API SHALL permitir consultar el estado público de un incidente elegible por identificador independientemente de los filtros y del intervalo del mapa. SHALL entregar la misma proyección mínima y aplicar en cada consulta la exclusión de sensibles.

#### Scenario: Favorito fuera del intervalo del mapa
- **WHEN** se consulta por identificador un incidente público anterior al intervalo actual
- **THEN** se obtiene su estado público vigente sin requerir ser su propietario

#### Scenario: Acceso al detalle privado
- **WHEN** un invitado o ciudadano usa un identificador público para solicitar el detalle privado de un reporte ajeno
- **THEN** se mantienen las comprobaciones existentes de autenticación y propiedad y se deniega ese acceso
