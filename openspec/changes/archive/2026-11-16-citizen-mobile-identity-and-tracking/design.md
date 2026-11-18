# Design

## Context

La motivación está en `proposal.md`. `ApiClient` ya extiende `ChangeNotifier`, expone `signedIn`, agrega Bearer en `request` cuando `auth` está habilitado y renueva tokens ante 401. `submitReport` fuerza `auth: false`. La API de creación ya distingue invitado y Ciudadano mediante Authorization y registra `reporter_user_id`.

`CitizenShell` escucha cambios de API, ofrece seis vistas públicas y muestra un Chip estático. `ProfileScreen` implementa ingreso, registro y cierre de sesión. `MineScreen` consulta reportes y notificaciones, pero su refresh solo espera los reportes. `ReportDetail` obtiene un único Future durante build y muestra el estado sin historial ni recarga.

`GET /incidents/{id}` aplica autenticación y ámbito antes de ejecutar `incidentDetail`. Su respuesta carece de historial. `/ops/incidents/{id}/history` devuelve eventos internos y exige roles institucionales. `incident_history` ya conserva creación y transiciones. El contrato está en `packages/contracts/openapi.yaml`.

## Goals / Non-Goals

### Goals

Reutilizar el estado de sesión, los formularios y los controles de autorización existentes. Entregar un contrato ciudadano aditivo y una navegación comprobable desde los puntos de entrada reales. Mantener las consultas y el indicador de recarga ligados al ciclo de vida de cada pantalla.

### Non-Goals

El alcance se limita al ingreso explícito y seguimiento mediante recarga manual. Restauración automática al arrancar, notificaciones push, recuperación de contraseña y rediseño general de navegación quedan para cambios propios.

## Decisions

### 1. Reutilizar la autenticación del cliente

Pasar `auth: signedIn` desde `submitReport` a `request`, manteniendo `Idempotency-Key` y `clientRequestId`. La cabecera Bearer se construye en un único lugar. Conservar extracción y almacenamiento seguro de `guestEvidenceToken`. Un error de autenticación sigue el mecanismo existente de renovación y error, sin fallback automático a invitado para la misma operación. La alternativa de armar Authorization en `submitReport` duplicaría la lógica existente.

La prueba `guest_api_test.dart` actualmente inicia sesión y exige ausencia de Bearer. Sustituir esa expectativa por casos separados de invitado y ciudadano, y conservar las comprobaciones de idempotencia y separación del permiso de foto.

### 2. Integrar destinos en el shell existente

Conservar los índices públicos 0 a 5 porque `HomeScreen.onNavigate` ya los usa. Agregar destinos explícitos para Perfil y Mis reportes con títulos e iconos correspondientes y un método central para seleccionar destino. El menú ofrece Perfil a ambos estados y Mis reportes a ciudadanos autenticados. La AppBar usa `ActionChip`, con etiqueta Sin cuenta o nombre/Ciudadano, y abre Perfil.

Reutilizar `ProfileScreen` como contenido del shell. El listener de API actualiza las opciones al completar ingreso o registro. Tras logout o invalidación, volver a Inicio si estaba seleccionada una vista privada, desmontar sus datos y retirar rutas de detalle privadas del Navigator. Comparar identidad además de `signedIn` para que la bandeja se recargue si cambia la cuenta. Evitar construir `MineScreen` para invitados. La API mantiene el control definitivo de propiedad.

Se considera innecesario introducir un router externo para estos destinos. Ocultar la entrada privada se complementa con la validación central y la limpieza de rutas al cambiar la sesión.

### 3. Agregar una proyección ciudadana del historial al detalle

Ampliar `incidentDetail` con `history`, un arreglo de eventos de creación (`created`) y transición global de estado (`status.changed`), literales usados por `incidents/report.js` y `dispatch/lifecycle.js`. Ordenar por `created_at` e `id` para resolver empates. Proyectar únicamente `eventType`, `previousValue`, `newValue` y `createdAt` en ISO UTC. Comprobar que los valores de transición correspondan a estados válidos. Usar el ámbito existente y verificar que, para el rol ciudadano, el reporte pertenece al usuario autenticado.

Las notas, actores y eventos de asignación o duplicado permanecen en los contratos operativos. La alternativa de consumir la ruta `/ops` desde Flutter requeriría permisos institucionales e introduciría datos internos. Inventar hitos a partir del estado actual produciría fechas sin respaldo.

La implementación verificó que los avances por asignación solo guardaban `assignment.status` y que el despacho inicial guardaba `assignment.confirmed` o `assignment.corrected`. Registrar además `status.changed` cuando cambie el estado global en `dispatch/assignments.js` y `dispatch/lifecycle.js`, dentro de sus transacciones existentes, permite consultar los hitos ciudadanos sin confundir avances de una institución con el estado agregado. Los reportes históricos muestran los eventos globales disponibles.

Actualizar OpenAPI con el arreglo y su esquema. Un arreglo vacío es válido para datos históricos sin eventos. El cliente interpreta `history` ausente como vacío para compatibilidad durante el despliegue. Mantener las comprobaciones existentes de autorización y respuestas privadas.

### 4. Controlar la recarga en bandeja y detalle

Convertir `ReportDetail` en StatefulWidget con una carga almacenada que obtiene estado e historial mediante el mismo endpoint, inicializada en `initState`. Un método async de recarga reemplaza el Future mediante `setState` y espera la solicitud, manejando fallos y verificando `mounted` cuando corresponda. Usar `RefreshIndicator` y `AlwaysScrollableScrollPhysics` para contenido corto, vacío o con error. Mantener una representación recuperable de carga, vacío y error.

La bandeja inicia reportes y notificaciones conjuntamente, espera ambas solicitudes para terminar el indicador y permite recuperar cada consulta fallida. Crear nuevas cargas al cambiar la identidad. Representar las transiciones en español con fecha y orden de servidor, admitiendo códigos desconocidos con una etiqueta legible de respaldo. Tras volver del detalle, el ciudadano puede recargar la bandeja manualmente.

## Risks / Trade-offs

- Ampliación necesaria de API para el historial ciudadano. Entregar primero la respuesta aditiva y comprobar autorización de propietario y proyección de campos antes de conectar la UI.
- `PendingReport` carece de identidad persistida y la idempotencia del servidor está separada por usuario o invitado. Un cambio de sesión entre envíos o reintentos puede cambiar el ámbito. El comportamiento solicitado evalúa `signedIn` al enviar. La garantía entre identidades requiere un cambio posterior de la cola y queda registrada como limitación de este alcance.
- Dos cambios activos usan `citizen-mobile`. Los requisitos nuevos usan nombres específicos para permitir su unión, y al sincronizar se deben conservar los requisitos de `operational-mvp` sobre GPS, fotos y pendientes.
- Una sesión puede expirar con un detalle abierto. El shell debe limpiar las rutas privadas y desmontar los datos, y las pruebas deben cubrir Atrás después de logout o invalidación.

## Migration Plan

1. Publicar la ampliación aditiva de detalle y OpenAPI, usando la tabla existente y sus controles de ámbito.
2. Entregar el cliente con identidad condicional, navegación y seguimiento actualizable.
3. Ejecutar verificación Flutter, API y contrato antes de distribuir el móvil. Revertir el cliente si falla la navegación o envío. El servidor puede conservar el campo aditivo durante esa reversión.

### Entrega y verificación local

El entorno acordado con el usuario es local. El panel usa `/api/v1` y su proxy apunta a `http://127.0.0.1:3000`. El APK de desarrollo instalado en el Samsung A34 utiliza esa misma API mediante un túnel USB. La dirección `127.0.0.1` del teléfono alcanza el puerto del equipo cuando está activo `adb reverse`. Mantener el cable conectado y restablecer el túnel si se pierde al reconectar el dispositivo.

Desde la raíz del proyecto, ejecutar los comandos ADB. Desde `apps/mobile`, compilar el APK con los parámetros indicados.

```powershell
adb reverse tcp:3000 tcp:3000
flutter build apk --debug --dart-define=APP_ENV=development --dart-define=API_BASE_URL=http://127.0.0.1:3000/api/v1
```

Para actualizar desde la raíz, usar `adb install -r apps/mobile/build/app/outputs/flutter-apk/app-debug.apk`. El manifest de debug ya habilita HTTP para desarrollo. La configuración pública de producción sigue disponible en `AppConfig`, pero la entrega local requiere los parámetros de compilación anteriores. Las cuentas y reportes creados contra Render pertenecen a ese entorno y requieren una migración explícita para incorporarlos a la base local.

Antes de verificar el envío, comprobar `/api/health` y `/api/health/database` en el puerto 3000 y ejecutar `npm.cmd run db:migrate:app` desde `apps/api`. La base `incidencias_test` utilizada por las pruebas y la base `incidencias` utilizada por la aplicación se migran por separado.

La revisión local encontró 11 migraciones en `incidencias`. Faltaban `is_conscious`, `is_breathing` y `has_bleeding`, columnas utilizadas por la API al insertar reportes. Se aplicó la migración existente `012_medical_triage.sql`. Después, una solicitud HTTP local de prueba recibió 201 y la referencia `INC-2026-5A2AAFB344E9`, con estado `reported`. El contenido identifica el reporte como DEMO técnico.

La confirmación final debe enviar un reporte desde el móvil ya actualizado y comprobar la misma referencia en la bandeja del panel local tras pulsar Actualizar, con un usuario autorizado y filtros compatibles. Esta comprobación sigue pendiente después de corregir el esquema.
