# admin-navigation Specification

## Purpose

Organizar el acceso al panel institucional alrededor del seguimiento de incidentes y la administración institucional autorizada.

## Requirements

### Requirement: Navegación administrativa simplificada
El panel SHALL retirar los enlaces y pantallas de Unidades y Personal para todos los roles. SHALL conservar los accesos autorizados a Dashboard, Incidentes, Mapa, Instituciones, Directorio e Historial.

#### Scenario: Menú administrativo
- **WHEN** un superadministrador o administrador institucional abre el panel
- **THEN** el menú excluye Unidades y Personal y permite acceder a las demás secciones correspondientes a su rol

#### Scenario: Enlaces anteriores a recursos
- **WHEN** se abre directamente `/unidades` o `/personal`
- **THEN** la aplicación aplica su redirección de ruta desconocida y evita montar una pantalla de recursos

#### Scenario: Organización institucional
- **WHEN** un administrador autorizado abre Instituciones
- **THEN** puede consultar la organización institucional y sus sedes

#### Scenario: Acceso de operador
- **WHEN** un operador abre el panel e intenta acceder a una sección reservada a administración
- **THEN** conserva el acceso a sus operaciones y recibe la restricción de acceso correspondiente para la sección administrativa
