# App Android ciudadana — 1.0.4+5

## Uso actual

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

URL centralizada: `lib/core/config.dart`, producción HTTPS a `https://gestion-incidencias-200e.onrender.com/api/v1`. Desarrollo requiere `--dart-define=APP_ENV=development --dart-define=API_BASE_URL=https://<servidor>/api/v1`.

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
