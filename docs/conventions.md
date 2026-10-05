# Convenciones de implementación

## Organización

- El backend seguirá un monolito modular por dominio (`auth`, `institutions`, `territory`, `incidents`, `dispatch`, `public`, `audit`). Cada módulo concentrará rutas, validación, servicios y acceso a datos.
- El panel y la app móvil consumirán `/api/v1` conforme a `packages/contracts/openapi.yaml`.
- Los cambios de esquema de MySQL se harán mediante migraciones versionadas; no se modificará el esquema manualmente en entornos compartidos.
- Los secretos y valores por entorno irán en variables de entorno. Solo `.env.example` se versiona.

## API

- JSON en UTF-8; fechas en ISO 8601 UTC; identificadores opacos en respuestas.
- Autenticación mediante `Authorization: Bearer <token>` para rutas protegidas.
- Los errores usan `{ code, message, correlationId }`; `code` permanece estable para los clientes.
- `POST /incidents` exige `Idempotency-Key` para evitar duplicados en reintentos y sincronización offline.
- La autorización institucional comprueba rol, institución, sede y jurisdicción en el servidor; el cliente nunca define su propio ámbito de acceso.
- Las coordenadas usan WGS84: `latitude` de -90 a 90 y `longitude` de -180 a 180. MySQL almacena geometrías con SRID 4326.
- Las fotos se almacenan fuera de MySQL; las respuestas públicas no revelan su ubicación exacta ni datos sensibles.

## Calidad

- Cada iteración documentará sus pruebas y criterios de aceptación antes de darse por terminada.
- Las respuestas privadas y autenticadas deben indicar `Cache-Control: no-store` cuando se implementen.
- Toda operación administrativa y cambio de estado crítico dejará registro de auditoría cuando su módulo exista.

