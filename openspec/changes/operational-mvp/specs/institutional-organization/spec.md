# Spec Delta

## Purpose

Administrar instituciones, sedes y cuentas institucionales para operar el piloto de Ayacucho y ampliar la cobertura mediante datos.

## ADDED Requirements

### Requirement: Instituciones y sedes
La plataforma SHALL permitir gestionar instituciones activas de tipo PNP, SAMU, Bomberos y Municipalidad/Serenazgo, con una o más sedes y ubicación.

#### Scenario: Alta institucional
- **WHEN** un SuperAdministrador crea una institución y una sede con datos válidos
- **THEN** ambas quedan disponibles en el catálogo autorizado con su relación y ubicación

#### Scenario: Nueva localidad
- **WHEN** se añade una sede en otro distrito configurado
- **THEN** el sistema la admite sin cambios de código ni recompilación de clientes

### Requirement: Gestión de cuentas institucionales
La plataforma SHALL permitir cuentas individuales de administrador y operador vinculadas a instituciones y sedes.

#### Scenario: Alta por administrador institucional
- **WHEN** un AdministradorInstitucional crea un Operador en su institución y sede permitida
- **THEN** la nueva cuenta queda vinculada a ese ámbito y no hereda acceso global

#### Scenario: Intento fuera de ámbito
- **WHEN** un AdministradorInstitucional intenta crear o modificar una cuenta de otra institución
- **THEN** la operación se rechaza y no altera la otra cuenta

### Requirement: Estado y visibilidad institucional
Las instituciones y sedes SHALL tener estado operativo configurable y las listas SHALL respetar el ámbito del solicitante.

#### Scenario: Sede inactiva
- **WHEN** una sede se desactiva
- **THEN** deja de recibir nuevas derivaciones automáticas y conserva su historial

#### Scenario: Listado acotado
- **WHEN** un AdministradorInstitucional consulta sedes
- **THEN** ve solo las que su ámbito le permite administrar
