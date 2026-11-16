# Proposal

## Why

La app dispone de autenticación, perfil y bandeja propia, pero su navegación solo expone vistas públicas y el envío de reportes siempre omite la sesión. Conectar la identidad con el envío y el seguimiento permite al ciudadano consultar sus reportes y su evolución desde el móvil.

## What Changes

- Enviar Bearer en `submitReport` cuando `signedIn` sea verdadero y omitir Authorization para invitados, conservando referencia, idempotencia y permisos de fotografía.
- Conectar `ProfileScreen` y `MineScreen` en el shell, convertir el Chip de la AppBar en acceso interactivo a Perfil y actualizar la navegación al cambiar la sesión.
- Mostrar estado y línea de tiempo del reporte propio, con recarga manual de bandeja y detalle mediante pull-to-refresh.
- Ampliar el detalle ciudadano existente con un historial de creación y cambios de estado autorizado para el propietario. El detalle actual carece de historial y el endpoint operativo exige roles institucionales.
- Actualizar `widget_test.dart` con navegación verificable y ajustar la prueba de API que actualmente exige omitir Authorization incluso después de iniciar sesión.
- Preparar la entrega local con móvil y panel conectados a la misma API y con las migraciones aplicadas en la base de aplicación. La configuración del APK y el esquema local son dependencias del recorrido de registro y reporte.

## Capabilities

### New Capabilities

- `citizen-mobile` — Identidad del envío móvil, acceso a Perfil y Mis reportes, seguimiento privado y actualización manual. Esta capacidad aparece como delta pendiente en `operational-mvp`, pero todavía carece de spec principal. Este cambio reutiliza su nombre y añade requisitos específicos que deben reconciliarse al sincronizar ambos cambios.

### Modified Capabilities

## Impact

- Flutter en `apps/mobile/lib/core/api.dart`, `apps/mobile/lib/app.dart` y `apps/mobile/lib/screens/mine.dart`, reutilizando `screens/profile.dart`.
- Pruebas en `apps/mobile/test/widget_test.dart`, `guest_api_test.dart` y las pruebas móviles de seguimiento pertinentes.
- Ampliación aditiva de `GET /incidents/{id}` en `apps/api/src/incidents/queries.js`, contrato `packages/contracts/openapi.yaml` y pruebas API de propiedad y filtrado del historial.
- Coordinación con los deltas `citizen-mobile` e `incident-lifecycle` del cambio activo `operational-mvp`.
- Entorno local de ejecución, compilación Android de desarrollo, túnel USB ADB al puerto 3000 y aplicación de la migración existente `012_medical_triage.sql` en `incidencias`.
