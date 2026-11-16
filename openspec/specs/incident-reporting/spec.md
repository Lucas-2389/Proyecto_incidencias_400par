# incident-reporting Specification

## Purpose

Ofrecer una clasificación compartida de incidentes que permita seleccionar subtipos y reconocer las especialidades que pueden intervenir en cada caso.

## Requirements

### Requirement: Clasificación compartida por especialidad
El catálogo SHALL representar cada tipo de incidente mediante un código estable compartido entre especialidades. Las relaciones de derivación SHALL permitir que una categoría o subcategoría corresponda a PNP, SAMU, Bomberos y Municipalidad/Serenazgo.

#### Scenario: Incidente atendido por varias especialidades
- **WHEN** un accidente de tránsito corresponde a PNP y SAMU
- **THEN** ambos usan el mismo identificador de categoría y sus reglas de derivación respectivas

#### Scenario: Subtipos configurados
- **WHEN** se consulta una categoría con subcategorías activas
- **THEN** el cliente recibe sus subtipos con códigos estables y una relación inequívoca con la categoría

### Requirement: Consulta de catálogo por especialidad
Las consultas públicas de categorías y subcategorías SHALL aceptar el filtro opcional `institutionType`, basado en reglas activas. Los valores admitidos SHALL corresponder a los tipos institucionales existentes. Al omitir el filtro SHALL conservarse la consulta actual.

#### Scenario: Categorías para SAMU
- **WHEN** se consulta el catálogo con `institutionType=samu`
- **THEN** se devuelven una sola vez las categorías activas con reglas aplicables a SAMU, incluidas reglas de sus subcategorías activas

#### Scenario: Subcategorías con regla general
- **WHEN** una regla activa de SAMU se aplica a toda la categoría y se consultan sus subcategorías con ese filtro
- **THEN** se devuelven todos sus subtipos activos

#### Scenario: Regla específica de subtipo
- **WHEN** una especialidad solo tiene una regla activa para un subtipo de una categoría
- **THEN** la consulta filtrada incluye ese subtipo y excluye los subtipos sin regla aplicable

#### Scenario: Consulta anterior
- **WHEN** un cliente consulta el catálogo sin filtro
- **THEN** recibe el mismo formato de lista y los campos previamente publicados

#### Scenario: Especialidad inválida
- **WHEN** se envía un tipo institucional desconocido
- **THEN** la API responde 422

### Requirement: Continuidad del catálogo inicial
La actualización del catálogo MUST conservar los identificadores, códigos y referencias históricas existentes. Las subcategorías iniciales SHALL poder cargarse repetidamente sin duplicarse. La categoría seleccionada SHALL validar la pertenencia del subtipo.

#### Scenario: Actualización de datos previos
- **WHEN** se actualiza y vuelve a cargar el catálogo en una base que contiene reportes
- **THEN** sus referencias siguen siendo válidas y los códigos iniciales mantienen sus identificadores

#### Scenario: Subtipo de otra categoría
- **WHEN** se crea un reporte con una subcategoría ajena a su categoría
- **THEN** la API responde 422

#### Scenario: Clasificación sensible
- **WHEN** se consulta o usa un subtipo marcado como sensible
- **THEN** conserva su indicador de sensibilidad y los controles existentes que lo utilizan
