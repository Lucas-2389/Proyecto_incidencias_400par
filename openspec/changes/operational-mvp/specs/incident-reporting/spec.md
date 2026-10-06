# Spec Delta

## Purpose

Recibir reportes ciudadanos y telefónicos con categoría, ubicación y trazabilidad, preservando su identidad y evitando duplicados de reintento.

## ADDED Requirements

### Requirement: Categorías configurables
La plataforma SHALL exponer categorías y subcategorías configurables de desastres, emergencias, tránsito, seguridad y violencia.

#### Scenario: Catálogo inicial
- **WHEN** un cliente consulta el catálogo
- **THEN** encuentra incendio, accidente de tránsito, emergencia médica, inundación, deslizamiento, daños por sismo, robo, asalto, agresión, pelea, vandalismo, acoso, violencia, actividad sospechosa y otros en sus familias respectivas

### Requirement: Alta de reporte móvil
La API SHALL registrar categoría, descripción, fecha/hora, posición, referencia opcional, reportante, fuente, prioridad, estado y localidad cuando se conozca.

#### Scenario: Reporte registrado
- **WHEN** un ciudadano envía un reporte válido con coordenadas y clave de idempotencia
- **THEN** recibe un código de referencia, estado Reportado y fuente `MOBILE_APP`, y el reporte queda persistido

#### Scenario: Marcador corregido
- **WHEN** la posición del incidente fue corregida por el ciudadano
- **THEN** se persiste la coordenada final seleccionada y se conserva la precisión/hora capturada cuando estén disponibles

### Requirement: Reporte invitado
La API SHALL aceptar reportes preliminares sin cuenta y marcarlos como no verificados, sin tratarlos como denuncia formal.

#### Scenario: Invitado válido
- **WHEN** un invitado envía datos mínimos válidos
- **THEN** recibe referencia de envío y el registro queda pendiente de verificación

### Requirement: Reporte telefónico
Un Operador autorizado SHALL poder crear un reporte recibido por llamada con fuente `PHONE` y localización proporcionada o pendiente de confirmar.

#### Scenario: Llamada registrada
- **WHEN** el Operador registra una llamada con categoría y descripción válidas
- **THEN** el incidente conserva su operador creador, fuente `PHONE` y datos de localización disponibles

### Requirement: Idempotencia de creación
La API MUST reconocer reintentos con la misma clave de idempotencia y el mismo contenido sin crear una segunda incidencia.

#### Scenario: Reenvío idéntico
- **WHEN** se repite la creación con la misma clave y contenido
- **THEN** se devuelve la referencia existente

#### Scenario: Clave reutilizada con otro contenido
- **WHEN** la clave ya usada llega con contenido distinto
- **THEN** se devuelve conflicto y no se altera la incidencia original
