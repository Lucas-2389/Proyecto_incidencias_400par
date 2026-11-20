# App Android ciudadana — 1.0.5+6

## Interfaz actualizada

El tema común en `lib/core/app_theme.dart` unifica el acento azul, fondos neutros, bordes de tarjetas, foco de formularios y estados de los controles. Inicio ofrece Crear reporte y acceso directo a Teléfonos de emergencia; las tarjetas abren Mapa, Contactos, Alertas y la presentación. El formulario explica Describe → Ubica → Foto opcional → Envía, y los marcadores agrupados del mapa muestran un símbolo de capas y el número de reportes. Centrar zona permite volver al distrito elegido.

El reporte y la fotografía siguen disponibles sin cuenta. Perfil conserva el acceso opcional existente. Las referencias de sedes revisadas del panel institucional siguen bajo autenticación y no se incorporan a la API pública por esta mejora visual. Por eso el APK no incluye automáticamente el padrón municipal administrativo.

La versión release usa la URL de producción centralizada existente. Para ver datos exclusivos de tu MySQL local, compilar con las opciones de desarrollo de esta guía. El build local se verifica con Flutter 3.38.3 / Dart 3.10.1 y JDK 17; `pub get` ajusta seis dependencias transitivas a las versiones fijadas por ese SDK, sin añadir librerías de aplicación. Usar el mismo SDK al reproducir la compilación.

Validación del 19/11/2026: `flutter pub get` completado; `flutter analyze --no-pub` sin observaciones; `flutter test --no-pub` con 47 pruebas aprobadas y dos omitidas por requerir integración real. Incluye navegación de invitado, contactos, formularios de reporte, foto y pendientes, mapa público, perfil y triaje. La prueba nueva comprueba la navegación directa a contactos en un ancho de 360 px. Las comprobaciones no sustituyen la prueba manual de cámara/GPS en un teléfono. ADB no detectó dispositivos al preparar esta actualización.

## Uso actual

Mapa, Contactos y Alertas consultan los cinco distritos metropolitanos por nombre desde `GET /territory/districts?scope=ayacucho-metropolitan`. El mapa representa los contornos de `GET /territory/districts/boundaries?scope=ayacucho-metropolitan`, destaca el distrito elegido y lo encuadra incluso sin reportes. Los límites son referenciales del INEI. Los filtros operan sobre el distrito original del reporte y los puntos publicados siguen siendo aproximados.

Contactos consulta teléfonos nacionales y locales del distrito seleccionado. Guarda la última lista nacional completa y su fecha para usarla sin conexión. Una corrección, desactivación o lista nacional vacía reemplaza la copia anterior al completar la consulta. La primera apertura sin datos guardados usa los teléfonos de respaldo. Pulsar Llamar abre el marcador para confirmar la llamada. Alertas permite elegir el distrito por nombre y combina sus publicaciones locales con las generales.

La app ofrece **Inicio**, **Reportar**, **Mapa**, **Contactos**, **Alertas**, **Conoce la app** y **Perfil**. Las vistas públicas están disponibles inmediatamente. La sesión guardada se recupera en segundo plano y habilita **Mis reportes**.

En **Perfil** puedes registrarte o iniciar sesión. **Datos personales** permite guardar nombre y teléfono opcional. El correo se muestra como dato de consulta. El teléfono se completa en nuevos reportes y puede cambiarse o borrarse para cada envío, conservando el valor de reportes anteriores. **Seguridad** permite cambiar la contraseña con la contraseña actual y una nueva de 12 a 128 caracteres, con confirmación. Al completar el cambio debes ingresar de nuevo en tus dispositivos.

1. En **Reportar**, elige categoría y describe un caso ficticio para probar el piloto.
2. Usa GPS o marca el lugar en el mapa; añade una referencia de calle y, si deseas, un teléfono de contacto.
3. Toma una foto o elige una de la galería, opcionalmente. No necesitas una cuenta.
4. Envía y conserva la referencia de recepción. Un envío pendiente todavía no fue recibido. Si la foto falla, el reporte confirmado se conserva y la app permite reintentar.
5. **Contactos** muestra 105, 116, 106 y 100 incluso sin Internet y abre el marcador, nunca llama automáticamente. SAMU tiene cobertura según región. Serenazgo depende de la municipalidad. Los contactos del piloto requieren Internet.
6. **Conoce la app** explica el flujo y la diferencia entre reporte preliminar y denuncia formal. El piloto no despacha ayuda real.

## Seguridad

La restauración usa el refresh token guardado en FlutterSecureStorage y carga el perfil desde la API. Los fallos transitorios permiten reintentar desde Perfil, y las credenciales invalidadas se eliminan. POST de reporte adjunta Bearer cuando existe sesión. El invitado puede enviar y adjuntar foto mediante un permiso temporal limitado al reporte. Los datos privados se autorizan en la API y se retiran de la navegación al cerrar sesión.

La cuenta institucional se utiliza en la web con los permisos correspondientes del servidor.

## Configuración y comandos

URL centralizada en `lib/core/config.dart`. Para trabajar en local con teléfono USB se usa `http://127.0.0.1:3000/api/v1` y `APP_ENV=development`. La URL de producción es `https://gestion-incidencias-200e.onrender.com/api/v1`.

Desde la raíz del repositorio, con Docker y la API local activos, ejecutar el script que comprueba la API, prepara el túnel USB y arranca Flutter con la dirección local.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-mobile-local.ps1
```

El script admite `-DeviceId` cuando hay varios dispositivos. La dirección `192.168.1.X` es un marcador de ejemplo y la app la rechaza. Si se cambiaron los argumentos `--dart-define`, detener la ejecución anterior e iniciar otra con el script para recompilar la configuración.

```powershell
flutter pub get
flutter analyze
flutter test
flutter test --dart-define=RUN_LIVE_API=true test/live_api_test.dart
flutter build apk --release
```

Para el entorno local con teléfono conectado por USB, aplicar primero las migraciones de aplicación desde `apps/api` con `npm.cmd run db:migrate:app`. Desde `apps/mobile`, compilar con la API local.

```powershell
adb reverse tcp:3000 tcp:3000
flutter build apk --debug --dart-define=APP_ENV=development --dart-define=API_BASE_URL=http://127.0.0.1:3000/api/v1
adb install -r build/app/outputs/flutter-apk/app-debug.apk
```

Mantener el cable conectado y el puerto 3000 disponible. La base de test se prepara por separado con `npm.cmd run db:migrate:test`.

Al abrir el repositorio completo en VS Code, seleccionar **Móvil local por USB** en Ejecutar y depurar. Esa configuración fija la URL local y prepara el túnel ADB antes de iniciar Flutter. Mantener la API ejecutándose con `npm.cmd start --prefix apps/api` desde la raíz del proyecto.

La prueba remota optativa crea un reporte DEMO claramente identificado y sube un PNG de prueba; no borra datos. APK: `build/app/outputs/flutter-apk/app-release.apk`. La firma actual es de prueba para instalación directa, no para Google Play. No desinstalar para actualizar: usar `adb install -r` conservando pendientes.

Permisos Android existentes: Internet, red y ubicación. Cámara/galería se abren con el selector del sistema; el GPS puede denegarse y se permite elegir el punto manualmente. Las pruebas automatizadas no certifican una captura manual de cámara en el dispositivo.

## Documentación vigente

- [Diseño vigente: flujo, interfaz y fotos de invitado](../../docs/01-entrega/SDD.md).
- [Antecedentes y resultados por versión](../../docs/04-historial/EVOLUCION_MOVIL.md).

Los artefactos `citizen-profile-and-session` describen la edición de cuenta y continuidad de sesión de esta entrega.
# Consulta privada de fotografías

Al iniciar sesión, el icono de fotografías de la barra superior abre «Mis reportes».
Los reportes enviados sin cuenta no se asignan retroactivamente a una cuenta.
Las fotos del propio reporte pueden consultarse durante cinco días desde su subida.
La API comprueba este plazo también al descargar la imagen y envía `Cache-Control: private, no-store`.
Después del plazo la institución conserva el archivo como evidencia; no hay borrado automático.
El mapa público no expone fotografías privadas.
