# Spec Delta

## Purpose

Adjuntar y consultar fotografías de incidentes con límites de carga y acceso según la necesidad operativa, sin guardar binarios en MySQL.

## ADDED Requirements

### Requirement: Carga controlada de fotografías
La API SHALL aceptar fotos opcionales en formatos y tamaños configurados, vinculadas a una incidencia existente y a un remitente autorizado.

#### Scenario: Foto válida
- **WHEN** el reportante adjunta una foto permitida a su incidencia
- **THEN** se conserva la foto y se registra su metadato y referencia de almacenamiento

#### Scenario: Archivo no permitido
- **WHEN** se envía un archivo demasiado grande o con contenido/tipo no admitido
- **THEN** la API lo rechaza sin publicarlo ni registrar evidencia utilizable

### Requirement: Lectura privada de evidencias
Solo el reportante autorizado y personal con necesidad operativa SHALL acceder a la foto; los datos públicos MUST omitirla.

#### Scenario: Acceso operativo
- **WHEN** un Operador autorizado consulta una foto de su ámbito
- **THEN** recibe acceso controlado y la consulta relevante queda auditada

#### Scenario: Acceso cruzado
- **WHEN** un usuario ajeno intenta obtener la foto o su clave de almacenamiento
- **THEN** el sistema deniega la lectura sin revelar la ubicación del archivo
