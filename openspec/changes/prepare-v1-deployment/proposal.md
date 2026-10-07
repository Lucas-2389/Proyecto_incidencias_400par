# Proposal

## Why

El piloto ya ejecuta sus módulos en local, pero necesita una configuración verificable para un primer despliegue HTTPS con panel y API en orígenes distintos. La auditoría del repositorio y un procedimiento de instalación deben distinguir lo que está probado de lo que aún depende de infraestructura externa.

## What Changes

- Auditar archivos, documentación, secretos y artefactos generados; conservar historial SDD/OpenSpec, migraciones y pruebas, y corregir documentación desactualizada.
- Exigir configuración de producción para URL pública HTTPS, orígenes web permitidos y almacenamiento persistente de fotos; mantener configuración de desarrollo separada.
- Responder al preflight CORS del panel permitido y añadir encabezados HTTP básicos sin abrir acceso a otros orígenes.
- Proporcionar plantillas de entorno y un procedimiento V1 para VM, MySQL, React, APK y Cloudflare, con pruebas y rollback. La publicación efectiva requiere dominio e infraestructura y queda fuera de este cambio.

## Capabilities

### New Capabilities

- `production-api-runtime`: Validación de configuración de producción, CORS explícito y encabezados seguros para exponer la API mediante HTTPS.

### Modified Capabilities

Ninguna. La conectividad MySQL y el entorno de desarrollo existentes conservan sus requisitos.

## Impact

`apps/api/src/config`, `apps/api/src/http`, `apps/api/src/app.js`, plantillas `.env`, pruebas HTTP/configuración, `.gitignore`, README y `docs/DEPLOYMENT_V1.md`. No cambia el contrato funcional `/api/v1`, el esquema MySQL ni los clientes móviles. El SDD original y todo `openspec/` se conservan.
