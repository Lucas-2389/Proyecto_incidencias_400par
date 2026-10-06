# Spec Delta

## Purpose

Permitir al ciudadano registrar y seguir incidencias desde Android con ubicación corregible, consultas públicas y tolerancia básica a cortes de red.

## ADDED Requirements

### Requirement: Pantallas ciudadanas
La app Flutter SHALL ofrecer Inicio, Reportar, Mapa, Mis reportes, Alertas, Directorio y Perfil, con acceso adecuado a invitado y ciudadano registrado.

#### Scenario: Ciudadano autenticado
- **WHEN** un ciudadano inicia sesión
- **THEN** puede abrir las siete vistas y consultar sus propios reportes

#### Scenario: Invitado
- **WHEN** una persona continúa sin cuenta
- **THEN** puede crear un reporte preliminar y consultar contenido público sin ver reportes ajenos

### Requirement: Captura y corrección GPS
La app SHALL pedir permiso de ubicación, mostrar la posición obtenida en un mapa y permitir mover el marcador antes del envío.

#### Scenario: Permiso concedido
- **WHEN** el dispositivo entrega posición GPS
- **THEN** el marcador aparece sobre esa posición y la app muestra que puede corregirse

#### Scenario: Permiso denegado
- **WHEN** el permiso se deniega
- **THEN** la app informa el problema y permite seleccionar manualmente una ubicación válida

### Requirement: Flujo de reporte
La app SHALL permitir seleccionar categoría, revisar posición, añadir descripción y foto opcional, enviar el reporte y mostrar su código de referencia.

#### Scenario: Envío exitoso
- **WHEN** la API confirma el reporte
- **THEN** la app muestra referencia y estado y permite abrir el seguimiento posterior

### Requirement: Reintento offline básico
La app MUST conservar localmente reportes pendientes durante un corte de red y reintentarlos con el mismo identificador de cliente sin duplicarlos.

#### Scenario: Sin Internet
- **WHEN** el usuario envía un reporte sin conectividad
- **THEN** la app lo marca como pendiente local y explica que aún no fue recibido por la institución

#### Scenario: Red restablecida
- **WHEN** vuelve la conectividad y se reintenta el pendiente
- **THEN** una sola incidencia queda confirmada y el pendiente local se elimina tras recibir la referencia

### Requirement: Configuración de API por entorno
La app SHALL obtener la dirección de API desde configuración de compilación o entorno, sin depender de `localhost` fijo.

#### Scenario: API de prueba
- **WHEN** se proporciona la URL de API del entorno de prueba
- **THEN** las solicitudes se dirigen a esa URL sin cambios del código fuente
