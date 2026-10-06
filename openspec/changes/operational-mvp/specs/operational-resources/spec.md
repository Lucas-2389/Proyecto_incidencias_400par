# Spec Delta

## Purpose

Mantener personal y unidades operativas por institución y sede para asignarlas con integridad durante la atención.

## ADDED Requirements

### Requirement: Catálogo de recursos
Un AdministradorInstitucional SHALL poder gestionar personal y unidades de su ámbito con código, tipo, sede, datos pertinentes y estado.

#### Scenario: Unidad creada
- **WHEN** se registra una unidad con código único, tipo, placa cuando aplica y sede válida
- **THEN** la unidad aparece en el inventario de la sede

#### Scenario: Gestión fuera de ámbito
- **WHEN** un administrador intenta modificar un recurso de otra institución
- **THEN** la API rechaza el cambio

### Requirement: Estados de unidad
Las unidades SHALL soportar Disponible, Asignada, En camino, En atención, Retornando, Mantenimiento y Fuera de servicio.

#### Scenario: Cambio operativo
- **WHEN** una unidad asignada sale hacia un incidente
- **THEN** su estado pasa a En camino y el cambio queda registrado

### Requirement: Disponibilidad de recursos
El sistema MUST impedir asignar una unidad en Mantenimiento o Fuera de servicio y MUST impedir asignaciones simultáneas incompatibles de la misma unidad o persona.

#### Scenario: Unidad indisponible
- **WHEN** se intenta asignar una unidad no disponible a otra atención activa
- **THEN** la asignación se rechaza sin crear una segunda ocupación

#### Scenario: Recurso liberado
- **WHEN** termina una atención y se libera el recurso
- **THEN** puede volver a figurar como disponible conforme al estado registrado
