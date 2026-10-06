# Spec Delta

## Purpose

Proporcionar a la ciudadanía teléfonos nacionales y locales de emergencia según su territorio, administrados como datos configurables.

## ADDED Requirements

### Requirement: Directorio territorial
La plataforma SHALL ofrecer entradas activas con nombre, número, institución, sede o localidad y ámbito nacional o local.

#### Scenario: Consulta por distrito
- **WHEN** se consulta el directorio para un distrito configurado
- **THEN** se muestran números nacionales y números locales aplicables a ese distrito

#### Scenario: Localidad sin datos locales
- **WHEN** no hay contactos locales configurados
- **THEN** se mantienen visibles los contactos nacionales disponibles

### Requirement: Administración de contactos
Un usuario autorizado SHALL poder crear, corregir y desactivar entradas del directorio sin recompilar la app.

#### Scenario: Número corregido
- **WHEN** un administrador actualiza un teléfono local de su ámbito
- **THEN** la siguiente consulta muestra el valor nuevo y la modificación queda auditada

### Requirement: Llamada desde móvil
La app SHALL ofrecer una acción para iniciar llamada cuando el dispositivo la soporte, sin efectuarla automáticamente.

#### Scenario: Dispositivo compatible
- **WHEN** el ciudadano pulsa Llamar en una entrada con teléfono válido
- **THEN** se abre el marcador del dispositivo con el número seleccionado
