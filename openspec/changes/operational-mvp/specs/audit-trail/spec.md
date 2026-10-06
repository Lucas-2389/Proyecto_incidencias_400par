# Spec Delta

## Purpose

Conservar evidencia de acciones administrativas y operativas críticas para reconstruir quién cambió qué y cuándo.

## ADDED Requirements

### Requirement: Registro de acciones críticas
El sistema SHALL registrar actor, acción, entidad, fecha/hora y cambios relevantes al administrar cuentas, sedes, reglas, recursos, asignaciones, estados y evidencias.

#### Scenario: Cambio de estado
- **WHEN** un Operador cambia el estado de una incidencia
- **THEN** se guarda un registro de auditoría con actor, incidencia, estado anterior, nuevo y fecha

#### Scenario: Acción rechazada
- **WHEN** un usuario intenta una operación administrativa fuera de su ámbito
- **THEN** se registra el intento relevante sin incluir contraseñas ni tokens

### Requirement: Consulta acotada de auditoría
Solo usuarios autorizados SHALL consultar el registro y cada consulta SHALL respetar el ámbito institucional.

#### Scenario: Administrador de institución
- **WHEN** consulta auditoría de su institución
- **THEN** ve solo eventos permitidos de ese ámbito

#### Scenario: Conservación tras cierre
- **WHEN** una incidencia se cierra
- **THEN** sus eventos de auditoría permanecen consultables por los roles autorizados
