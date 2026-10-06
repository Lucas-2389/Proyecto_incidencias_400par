# Spec Delta

## Purpose

Ofrecer mapas operativos y agregados espaciales útiles sin revelar ubicaciones exactas de incidentes sensibles al público.

## ADDED Requirements

### Requirement: Mapa institucional autorizado
La API SHALL entregar puntos exactos de incidentes y sedes solo dentro del ámbito permitido al usuario institucional.

#### Scenario: Operador de sede
- **WHEN** un Operador solicita el mapa de su ámbito
- **THEN** recibe únicamente incidentes y sedes autorizados con coordenadas necesarias para atenderlos

#### Scenario: Usuario sin permiso
- **WHEN** un usuario sin rol operativo solicita puntos privados
- **THEN** la API deniega el acceso

### Requirement: Mapa público agregado
La vista pública MUST presentar concentraciones agregadas por celda o zona y MUST ocultar coordenadas exactas y datos personales de casos sensibles.

#### Scenario: Celda con pocos eventos
- **WHEN** una celda no alcanza el umbral mínimo configurado de eventos
- **THEN** la respuesta pública suprime o agrupa la celda sin permitir inferir un caso individual

#### Scenario: Violencia sensible
- **WHEN** el agregado incluye violencia familiar, sexual u otra categoría sensible
- **THEN** la respuesta pública no contiene el punto exacto, descripción, foto ni identidad del reportante

### Requirement: Filtros del mapa de calor
El sistema SHALL admitir filtros por tipo, categoría, fecha, franja horaria, distrito e institución, respetando la visibilidad del solicitante.

#### Scenario: Consulta filtrada
- **WHEN** se solicita un intervalo válido y un distrito configurado
- **THEN** los conteos reflejan solo los incidentes permitidos que cumplen los filtros

#### Scenario: Intervalo inválido
- **WHEN** el fin precede al inicio o se excede el rango permitido
- **THEN** la API devuelve error de validación

### Requirement: Estadísticas operativas espaciales
Un usuario institucional SHALL poder consultar agregados de su ámbito con mayor detalle que el público, sin ampliar sus permisos de lectura.

#### Scenario: Filtro institucional
- **WHEN** un AdministradorInstitucional filtra el mapa de calor por su institución
- **THEN** recibe solo conteos del ámbito que administra
