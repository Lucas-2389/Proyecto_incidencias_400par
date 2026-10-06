# Proposal

## Why

La Iteración 0 dejó listo el entorno local, la conexión MySQL y los diagnósticos técnicos, pero todavía no existe un flujo operativo entre ciudadano, API e instituciones. Este cambio reúne las funciones mínimas del SDD para demostrar en Ayacucho un reporte geolocalizado, su derivación, atención y seguimiento antes de abordar despliegue público y escalamiento.

## What Changes

- Incorporar migraciones versionadas, datos de demostración identificados como `DEMO`, contratos HTTP y pruebas integradas sobre MySQL real.
- Incorporar identidad ciudadana e institucional, acceso por rol y ámbito, administración de instituciones, sedes, territorio, recursos y directorio.
- Registrar reportes móviles, de invitado y telefónicos con GPS corregible, fotos opcionales, idempotencia, clasificación por reglas, derivación territorial y atención por varias instituciones.
- Ofrecer seguimiento, historial, auditoría, alertas, notificaciones internas, mapa institucional y mapa de calor público agregado con protección de casos sensibles.
- Construir el panel React en `apps/admin` y la aplicación Flutter en `apps/mobile`, con el flujo de demostración extremo a extremo y una cola móvil básica para reintentos sin duplicados.
- Mantener configuración por entorno y límites modulares para un backend sin sesiones en memoria y un almacenamiento de fotos sustituible.

Quedan fuera de este cambio el despliegue público, Cloudflare, dominio, CDN, WAF, balanceador, múltiples instancias, pruebas de 5 000 usuarios, Google Play, Power BI, microservicios, integración con sistemas oficiales e IA de clasificación en producción. El envío de un enlace temporal de ubicación para llamadas queda diseñado para una etapa posterior. FCM podrá añadirse solo si la configuración y las credenciales de prueba están disponibles sin bloquear el MVP; las notificaciones internas son obligatorias.

## Capabilities

### New Capabilities

- `identity-access`: Registro, acceso, recuperación, tokens, roles y autorización por ámbito.
- `institutional-organization`: Instituciones, sedes y usuarios institucionales.
- `territorial-coverage`: División territorial y polígonos de cobertura para resolver jurisdicción.
- `operational-resources`: Personal, unidades y disponibilidad operativa.
- `incident-reporting`: Catálogos, reportes ciudadanos, invitados y telefónicos, ubicación e idempotencia.
- `incident-dispatch`: Sugerencias determinísticas, derivación y asignación múltiple.
- `incident-lifecycle`: Verificación, prioridad, estados, duplicados e historial.
- `incident-evidence`: Carga y lectura autorizada de fotografías.
- `geospatial-views`: Mapas autorizados y mapa de calor agregado.
- `emergency-directory`: Contactos nacionales y locales por territorio.
- `alerts-notifications`: Alertas públicas y notificaciones internas.
- `citizen-mobile`: Experiencia Flutter de reporte, consulta, mapa y reintentos offline básicos.
- `institutional-console`: Panel React para operación, administración y estadísticas básicas.
- `audit-trail`: Registro consultable de acciones críticas.

### Modified Capabilities

Ninguna. `local-development-environment` y `database-connectivity` siguen siendo requisitos vigentes y se reutilizan sin cambiar su comportamiento.

## Impact

- `apps/api`: módulos de dominio, validación, seguridad, migraciones, seeds, pruebas y reutilización del pool `mysql2/promise` existente.
- `apps/admin`: proyecto React institucional (la ruta real es `apps/admin`, no `apps/web`).
- `apps/mobile`: proyecto Flutter Android inicial.
- `packages/contracts/openapi.yaml`: rutas y esquemas funcionales coherentes con clientes y API.
- `README.md`, documentación local y ejemplos de configuración; `compose.yaml` y los health checks permanecen como base.
- MySQL 9.7.2 local: nuevas tablas de dominio mediante migraciones; la API usa la cuenta `incidencias_app`, nunca `root`.
