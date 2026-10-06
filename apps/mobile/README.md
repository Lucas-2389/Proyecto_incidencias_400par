# Aplicación ciudadana Flutter

Cliente Android del piloto DEMO de Ayacucho. Usa la API `/api/v1`, MySQL a través de la API y teselas OSM con atribución. Nunca conecta directamente a MySQL. Los reportes de invitado se reciben como preliminares; el historial privado y las fotos requieren cuenta ciudadana.

## Requisitos y configuración

- Flutter 3.38 o compatible, Dart 3.10 y Android SDK con dispositivo o emulador configurado.
- API ejecutándose con migraciones y seeds de referencia en una base separada para pruebas. Consultar `apps/api/README.md`.
- URL de API configurada en cada ejecución mediante `--dart-define=API_BASE_URL=...`; no se compila una contraseña en la app.
- `OSM_TILE_URL` es opcional y usa `https://tile.openstreetmap.org/{z}/{x}/{y}.png` si se omite. En un uso mayor, configurar un proveedor adecuado y respetar la política de teselas OSM.

Desde PowerShell en `apps/mobile`:

```powershell
flutter pub get
flutter analyze
flutter test
flutter devices
flutter run -d <id-android> --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

`10.0.2.2` permite que el emulador Android acceda al servidor en Windows. Para un teléfono físico, usar la dirección LAN alcanzable del equipo y configurar el firewall; para un backend futuro en otra máquina, usar su URL HTTPS. La aplicación toma esta diferencia del argumento, sin fijar `localhost` en código. El servidor API local debe escuchar en una interfaz alcanzable por el dispositivo; el valor predeterminado del servidor es para desarrollo en el propio equipo.

Android declara permisos `INTERNET`, `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION`. La app solicita el permiso de ubicación al usar GPS. Si se deniega o el GPS está apagado, se puede tocar el mapa o introducir latitud y longitud manuales; se muestra precisión y hora cuando provienen del GPS. La cámara/galería la gestiona `image_picker`. Solo el manifiesto de depuración permite HTTP sin TLS para la API local. Usar HTTPS para cualquier servidor público.

## Flujo de prueba

1. Abrir **Perfil** y registrar o iniciar sesión como ciudadano; también se puede continuar como invitado.
2. En **Reportar**, elegir categoría, describir el hecho y ubicar el marcador mediante GPS, toque en mapa o coordenadas manuales. La última corrección es la enviada.
3. Enviar. La pantalla distingue **pendiente de envío** de **reporte confirmado** y muestra la referencia cuando la API responde. La app guarda `clientRequestId` junto a los pendientes y reintenta al recuperar conectividad o volver al primer plano. La API impide duplicados para ese identificador.
4. Con sesión, adjuntar una foto opcional. La foto se sube después de confirmar el reporte; si falla, la referencia sigue válida y la foto queda pendiente para reintento. Los pendientes y fotos temporales se almacenan localmente; no dejar el dispositivo compartido con datos DEMO sensibles.
5. Revisar **Mis reportes** y notificaciones propias, **Alertas**, **Directorio** con botón de llamada y **Mapa** de calor agregado. El mapa público no solicita puntos exactos.

Las pruebas automatizadas verifican navegación del invitado, validación del formulario, GPS concedido y denegado, corrección final de coordenadas, idempotencia de reintento sin red y foto fallida con referencia conservada. Ejecutarlas con los comandos anteriores. Para compilar APK o probar en dispositivo es indispensable tener Android SDK instalado y aceptado por `flutter doctor`.

En la estación de desarrollo usada para esta fase, `flutter analyze` y `flutter test` pasaron; `flutter devices` solo detectó Windows, Chrome y Edge. `flutter doctor -v` confirmó que falta Android SDK. El recorrido E2E en Android queda pendiente de disponer de ese SDK y un emulador o dispositivo.
