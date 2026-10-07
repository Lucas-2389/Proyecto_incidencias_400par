# Spec Delta

## Purpose

Definir el comportamiento de la API cuando se configura para una instalación HTTPS con panel web en otro origen, sin exponer secretos ni datos privados por respuestas o caché.

## ADDED Requirements

### Requirement: Configuración de producción válida
La API SHALL validar su ambiente, URL pública, orígenes web permitidos y almacén de fotos antes de aceptar solicitudes; SHALL rechazar configuraciones de producción incompletas o inseguras sin imprimir secretos.

#### Scenario: Producción configurada
- **WHEN** `APP_ENV=production` y se proporcionan `JWT_SECRET`, `PUBLIC_API_URL` HTTPS, `CORS_ORIGINS` HTTPS y `EVIDENCE_DIR` absoluto
- **THEN** la API acepta la configuración con la cuenta MySQL de aplicación no root

#### Scenario: Configuración insegura
- **WHEN** la URL pública o un origen usan HTTP, falta un valor obligatorio o el directorio de fotos es relativo
- **THEN** la API rechaza el arranque con el nombre del ajuste inválido sin mostrar su valor secreto

#### Scenario: Modalidad de subida desconocida
- **WHEN** `UPLOAD_CONFIGURATION` no es `local`
- **THEN** la API rechaza la configuración porque V1 solo admite almacenamiento local persistente

#### Scenario: Buzón de desarrollo en producción
- **WHEN** se define `DEV_MAILBOX_DIR` con `APP_ENV=production`
- **THEN** la API rechaza el arranque porque ese buzón no es un transporte de correo de producción

### Requirement: Acceso web entre orígenes explícitos
La API SHALL permitir solicitudes CORS del panel configurado y SHALL denegar solicitudes de otros orígenes web cuando hay una lista de orígenes configurada.

#### Scenario: Preflight permitido
- **WHEN** el panel de un origen incluido en `CORS_ORIGINS` envía un preflight `OPTIONS`
- **THEN** la API responde sin ejecutar una operación de dominio e incluye el origen autorizado y los métodos y cabeceras permitidos

#### Scenario: Origen ajeno
- **WHEN** una solicitud web declara un `Origin` que no está en `CORS_ORIGINS`
- **THEN** la API responde HTTP 403 sin cabecera que autorice a ese origen a leer la respuesta

### Requirement: Encabezados HTTP básicos
La API SHALL enviar encabezados que impidan inferencia de tipo, embebido en marcos y referencia externa, y SHALL mantener las respuestas de salud y funcionales fuera de cachés compartidas.

#### Scenario: Respuesta técnica
- **WHEN** se consulta `GET /api/health`
- **THEN** la respuesta incluye encabezados de seguridad y `Cache-Control: no-store`

#### Scenario: Respuesta funcional
- **WHEN** se consulta una ruta `/api/v1`
- **THEN** la respuesta incluye encabezados de seguridad y no expone la cabecera `X-Powered-By`
