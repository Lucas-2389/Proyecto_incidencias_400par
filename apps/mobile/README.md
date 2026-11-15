# App Android ciudadana — 1.0.4+5

## Uso actual

La app abre sin registro ni inicio de sesión. **Inicio**, **Reportar**, **Mapa**, **Contactos**, **Alertas** y **Conoce la app** son las secciones disponibles. No se muestran Perfil ni Mis reportes privados. Las clases antiguas de cuenta se conservan como código legado sin rutas en la app; no se eliminan cuentas ni datos del servidor.

1. En **Reportar**, elige categoría y describe un caso ficticio para probar el piloto.
2. Usa GPS o marca el lugar en el mapa; añade una referencia de calle y, si deseas, un teléfono de contacto.
3. Toma una foto o elige una de la galería, opcionalmente. No necesitas una cuenta.
4. Envía y conserva la referencia de recepción. Un envío pendiente todavía no fue recibido. Si la foto falla, el reporte confirmado se conserva y la app permite reintentar.
5. **Contactos** muestra 105, 116, 106 y 100 incluso sin Internet y abre el marcador, nunca llama automáticamente. SAMU tiene cobertura según región. Serenazgo depende de la municipalidad. Los contactos del piloto requieren Internet.
6. **Conoce la app** explica el flujo y la diferencia entre reporte preliminar y denuncia formal. El piloto no despacha ayuda real.

## Seguridad

No se restauran sesiones al iniciar. POST de reporte usa `auth: false` explícito. La foto utiliza un permiso temporal limitado al reporte, guardado en FlutterSecureStorage; las fotos siguen privadas. No se proporciona historial ni estado privado a un invitado. La referencia de envío no es una credencial de acceso. No hay contraseñas en el APK.

La cuenta institucional se utiliza en la web, con autenticación y autorización del backend. Quitar el login ciudadano de la interfaz no elimina la protección de la API ni las cuentas existentes.

## Configuración y comandos

URL centralizada: `lib/core/config.dart`, producción HTTPS a `https://gestion-incidencias-200e.onrender.com/api/v1`. Desarrollo requiere `--dart-define=APP_ENV=development --dart-define=API_BASE_URL=https://<servidor>/api/v1`.

```powershell
flutter pub get
flutter analyze
flutter test
flutter test --dart-define=RUN_LIVE_API=true test/live_api_test.dart
flutter build apk --release
```

La prueba remota optativa crea un reporte DEMO claramente identificado y sube un PNG de prueba; no borra datos. APK: `build/app/outputs/flutter-apk/app-release.apk`. La firma actual es de prueba para instalación directa, no para Google Play. No desinstalar para actualizar: usar `adb install -r` conservando pendientes.

Permisos Android existentes: Internet, red y ubicación. Cámara/galería se abren con el selector del sistema; el GPS puede denegarse y se permite elegir el punto manualmente. Las pruebas automatizadas no certifican una captura manual de cámara en el dispositivo.

## Documentación vigente

- [Diseño vigente: flujo, interfaz y fotos de invitado](../../docs/01-entrega/SDD.md).
- [Antecedentes y resultados por versión](../../docs/04-historial/EVOLUCION_MOVIL.md).

Las guías anteriores de login ciudadano describen versiones previas. Esta versión sustituye ese recorrido.
