# Spec Delta

## Purpose

Sugerir y registrar atención institucional según el tipo de incidente y su ubicación, con corrección humana y varias entidades participantes.

## ADDED Requirements

### Requirement: Sugerencia determinística
El sistema SHALL sugerir instituciones y sedes activas a partir de reglas configurables de categoría/subcategoría y cobertura territorial.

#### Scenario: Incendio cubierto
- **WHEN** un incendio cae en la cobertura de una sede de Bomberos configurada
- **THEN** la sugerencia incluye esa sede y explica la regla aplicada

#### Scenario: Accidente con varias instituciones
- **WHEN** una regla de accidente grave requiere SAMU, PNP y Bomberos con cobertura
- **THEN** la sugerencia puede contener sedes de las tres instituciones

#### Scenario: Sin cobertura
- **WHEN** ninguna sede aplicable cubre el punto o el territorio es desconocido
- **THEN** el incidente entra en una bandeja de excepción para revisión humana

### Requirement: Asignación institucional múltiple
Un usuario autorizado SHALL poder confirmar o corregir la derivación y asignar varias instituciones o sedes al mismo incidente.

#### Scenario: Corrección manual
- **WHEN** un Operador autorizado cambia una sugerencia por una sede válida distinta e indica motivo
- **THEN** se guarda la asignación corregida y la decisión queda trazada

#### Scenario: Ámbito no autorizado
- **WHEN** se intenta asignar una sede fuera de los permisos del usuario
- **THEN** la API rechaza la asignación

### Requirement: Asignación de operador y recursos
Un usuario autorizado SHALL poder vincular operador, personal y unidades disponibles a la atención de una institución.

#### Scenario: Asignación completa
- **WHEN** se confirma una atención con recursos disponibles del ámbito correspondiente
- **THEN** las relaciones quedan persistidas y los recursos dejan de figurar disponibles para otra atención incompatible

#### Scenario: Conflicto concurrente
- **WHEN** dos solicitudes intentan reservar la misma unidad para atenciones incompatibles
- **THEN** solo una puede confirmarse y la otra recibe conflicto
