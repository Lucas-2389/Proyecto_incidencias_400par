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
