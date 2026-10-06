# Spec Delta

## Purpose

Resolver la división territorial y las zonas de atención a partir de coordenadas válidas, usando datos ampliables para todo el Perú.

## ADDED Requirements

### Requirement: Jerarquía territorial configurable
El sistema SHALL representar departamento, provincia, distrito y sector, y SHALL permitir añadir territorios sin modificar el código.

#### Scenario: Datos piloto
- **WHEN** se consulta una coordenada dentro de las zonas demostrativas de Ayacucho
- **THEN** se identifica el territorio configurado y los datos están marcados como DEMO

### Requirement: Resolución geográfica
El sistema SHALL validar latitud y longitud WGS84 e identificar el territorio que contiene el punto cuando exista cobertura geográfica cargada.

#### Scenario: Punto dentro de polígono
- **WHEN** se registra un punto válido dentro de un distrito configurado
- **THEN** la incidencia conserva la coordenada y el distrito resuelto

#### Scenario: Punto sin polígono
- **WHEN** el punto válido queda fuera de zonas configuradas
- **THEN** el reporte se conserva y su territorio queda pendiente para revisión, sin inventar un distrito

#### Scenario: Coordenadas inválidas
- **WHEN** se envía una latitud o longitud fuera de rango
- **THEN** la API rechaza la solicitud con error de validación

### Requirement: Cobertura por sede
Cada sede SHALL poder tener varias zonas de cobertura y el sistema SHALL distinguir las sedes que cubren una coordenada de las que no la cubren.

#### Scenario: Cobertura coincidente
- **WHEN** una coordenada cae en dos coberturas activas
- **THEN** ambas sedes pueden ser candidatas de derivación

#### Scenario: Sede fuera de cobertura
- **WHEN** la sede no cubre la coordenada
- **THEN** no se propone automáticamente como sede responsable
