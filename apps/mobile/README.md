# Aplicación ciudadana Flutter

Cliente Android del piloto DEMO de Ayacucho. Usa la API `/api/v1`, MySQL a través de la API y teselas OSM con atribución. Nunca conecta directamente a MySQL. Los reportes de invitado se reciben como preliminares; el historial privado y las fotos requieren cuenta ciudadana.

## Requisitos y configuración

- Flutter 3.38 o compatible, Dart 3.10 y Android SDK con dispositivo o emulador configurado.
- API ejecutándose con migraciones y seeds de referencia en una base separada para pruebas. Consultar `apps/api/README.md`.
- Configuración única en `lib/core/config.dart`: por defecto `APP_ENV=production` conecta con `https://gestion-incidencias-200e.onrender.com/api/v1`. No se compila una contraseña en la app.
- `OSM_TILE_URL` es opcional y usa `https://tile.openstreetmap.org/{z}/{x}/{y}.png` si se omite. En un uso mayor, configurar un proveedor adecuado y respetar la política de teselas OSM.

Desde PowerShell en `apps/mobile`:

```powershell
flutter pub get
flutter analyze
flutter test
flutter devices
flutter run -d <id-android>
flutter build apk --release
```

El APK generado está en `build/app/outputs/flutter-apk/app-release.apk`. Usa HTTPS de Render, sin túnel ADB ni dependencia de la red del PC. La firma actual es la de depuración: APK para instalación y pruebas, no publicación en Google Play.

Para desarrollo, definir explícitamente una URL alcanzable desde el dispositivo en `LOCAL_API_BASE_URL` (solo configuración de la terminal):

```powershell
flutter run -d <id-android> --dart-define=APP_ENV=development --dart-define=API_BASE_URL=$env:LOCAL_API_BASE_URL
```

Desarrollo exige URL explícita; producción exige HTTPS. API_BASE_URL acepta un origen y `/api/v1`, sin usuario, contraseña, query ni fragmento. No pasar secretos con dart-define. El modo debug permite HTTP local; release usa HTTPS.

La prueba `test/live_api_test.dart` está deshabilitada en la suite normal. Para ejecutarla intencionalmente, configurar la contraseña ciudadana DEMO mediante la variable privada de proceso `MOBILE_DEMO_PASSWORD` y usar `flutter test test/live_api_test.dart --dart-define=RUN_LIVE_API=true`. Comprueba login, catálogo, alertas, directorio, mapa de calor, creación, consulta y foto. Crea un reporte técnico etiquetado DEMO en la base de producción; nunca elimina datos de dominio ni imprime credenciales. No habilitarla automáticamente en CI.

En esta estación, Gradle requiere el workaround de proceso `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:/src/nonexistent-java-sockets` para evitar un fallo de sockets Unix de Java en Windows. La ruta indicada debe permanecer inexistente; así Java usa su alternativa TCP. No es configuración de red de la app. JDK 17 configurado en Flutter y Gradle 8.14 para AGP 8.11.1. Cada compañero debe configurar su SDK/JDK local, sin versionar android/local.properties.

Android declara permisos `INTERNET`, `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION`. La app solicita el permiso de ubicación al usar GPS. Si se deniega o el GPS está apagado, se puede tocar el mapa para marcar otro lugar. El formulario pide una referencia comprensible, como calle, avenida o punto cercano; no muestra latitud y longitud al ciudadano. Se muestra precisión y hora cuando provienen del GPS. La cámara/galería la gestiona `image_picker`. Solo el manifiesto de depuración permite HTTP sin TLS para la API local. Usar HTTPS para cualquier servidor público.

## Validación contra Render (2026-10-08)

- `flutter pub get`: correcto.
- `flutter analyze`: sin incidencias.
- `flutter test`: 9 pruebas aprobadas; 1 prueba remota omitida intencionalmente.
- Prueba remota explícita: aprobada; login, consultas públicas, directorio, datos de mapa, creación/consulta de reporte y subida de PNG real.
- `flutter build apk --release`: correcto; APK de 50,2 MB en `build/app/outputs/flutter-apk/app-release.apk`, firma verificada con `apksigner`.
- Permisos del APK revisados: Internet, estado de red y ubicación aproximada/precisa. Release deshabilita tráfico HTTP sin TLS.
- No se verificaron cámara, selector de fotos ni GPS en un teléfono físico en esta ejecución. El APK está preparado para esa comprobación; la prueba remota de evidencia usa un PNG generado por la suite.

## Flujo de prueba

1. Abrir **Perfil** y registrar o iniciar sesión como ciudadano; también se puede continuar como invitado.
2. En **Reportar**, elegir categoría, describir el hecho, escribir una referencia del lugar si ayuda y ubicar el marcador mediante GPS o toque en mapa. Se puede informar un teléfono de contacto opcional para que la central devuelva la llamada. La última ubicación elegida es la enviada.
3. Enviar. La pantalla distingue **pendiente de envío** de **reporte confirmado** y muestra la referencia cuando la API responde. La app guarda `clientRequestId` junto a los pendientes y reintenta al recuperar conectividad o volver al primer plano. La API impide duplicados para ese identificador.
4. Con sesión, adjuntar una foto opcional. La foto se sube después de confirmar el reporte; si falla, la referencia sigue válida y la foto queda pendiente para reintento. Los pendientes y fotos temporales se almacenan localmente; no dejar el dispositivo compartido con datos DEMO sensibles.
5. Revisar **Mis reportes** y notificaciones propias, **Alertas**, **Directorio** con botón de llamada y **Mapa** de calor agregado. El mapa público no solicita puntos exactos.

Las pruebas automatizadas verifican navegación del invitado, validación del formulario, GPS concedido y denegado, corrección final de coordenadas, idempotencia de reintento sin red y foto fallida con referencia conservada. Ejecutarlas con los comandos anteriores. Para compilar APK o probar en dispositivo es indispensable tener Android SDK instalado y aceptado por `flutter doctor`.

En la estación de desarrollo usada para esta fase, Android SDK y el AVD `Medium_Phone_API_37.0` están instalados. El APK de depuración compiló con JDK 17, se instaló y abrió en el emulador. El AVD con Play Store mostró bloqueos de Pixel Launcher/System UI en el equipo de 8 GB. Después se instaló la app en un teléfono TECNO SPARK 20 Pro mediante ADB inalámbrico, se creó una cuenta ciudadana y se envió un reporte ficticio con GPS y foto seleccionada; la foto quedó pendiente porque la primera sesión API no tenía `EVIDENCE_DIR`. La tarea 12.3 de OpenSpec permanece abierta hasta comprobar el reintento de foto, la gestión en panel y el estado final de vuelta en Android. Ver [validación del piloto](../../docs/pilot-validation.md). En Windows con proyecto en `D:` y Pub Cache en `C:`, `android/gradle.properties` desactiva Kotlin incremental para evitar errores de rutas entre unidades.
