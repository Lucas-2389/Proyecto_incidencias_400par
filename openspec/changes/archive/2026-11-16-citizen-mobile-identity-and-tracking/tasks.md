# Tasks

## 1. Identidad del envío móvil

- [x] 1.1 Cambiar `ApiClient.submitReport` para delegar con `auth: signedIn`, conservando `Idempotency-Key`, `clientRequestId` y tratamiento de `guestEvidenceToken`. Verificar con MockClient presencia de Bearer para sesión activa y ausencia para invitado.
- [x] 1.2 Actualizar `apps/mobile/test/guest_api_test.dart`, reemplazando el caso que omite una sesión activa por casos separados de invitado, ciudadano y rechazo de renovación. Verificar con `flutter test test/guest_api_test.dart` que se conserva el permiso de foto separado del comprobante y que un fallo de credenciales no reenvía como invitado.

## 2. Contrato del historial ciudadano

- [x] 2.1 Ampliar `apps/api/src/incidents/queries.js` para incluir `history` con creación y cambios globales de estado, ordenados por fecha e id y proyectados a los cuatro campos del diseño. Verificar pruebas API con eventos desordenados, empate de fecha, historial vacío y ausencia de datos operativos.
- [x] 2.2 Cubrir con pruebas API autenticación y propiedad del detalle con historial. Verificar que propietario recibe sus eventos y otro ciudadano e invitado reciben denegación sin datos del reporte.
- [x] 2.3 Actualizar `packages/contracts/openapi.yaml` con el campo aditivo y esquema de eventos ciudadanos. Verificar `npm.cmd run contract:check` desde `apps/api` y las pruebas de contrato correspondientes.

## 3. Navegación de invitado y ciudadano

- [x] 3.1 Conectar `ProfileScreen` y `MineScreen` en `apps/mobile/lib/app.dart`, agregar destinos con selección central y convertir el Chip en ActionChip de acceso a Perfil. Verificar desde `widget_test.dart` tanto el botón de AppBar como el menú Perfil, conservando accesos públicos desde Inicio y barra inferior.
- [x] 3.2 Actualizar opciones, etiqueta de cuenta y carga privada ante ingreso, registro, logout, invalidación o cambio de identidad. Retirar detalles privados abiertos al perder sesión. Verificar mediante pruebas de widgets que Mis reportes aparece tras login, desaparece al salir y Atrás no recupera seguimiento privado.
- [x] 3.3 Ajustar el caso existente de invitado en `widget_test.dart` para admitir Perfil y mantener verificaciones de reporte público, Contactos sin Internet y Conoce la app. Usar una API falsa controlable para afirmar destinos y solicitudes privadas después de acciones concretas. Verificar `flutter test test/widget_test.dart`.

## 4. Estado y línea de tiempo con recarga

- [x] 4.1 Hacer que la recarga de MineScreen espere reportes y notificaciones, permita arrastrar con contenido corto o vacío y maneje errores recuperables. Verificar pruebas de widgets con respuestas controladas, incluida una consulta que termina después de la otra.
- [x] 4.2 Convertir ReportDetail en pantalla con estado y Future almacenado, mostrando referencia, estado y eventos cronológicos con fechas, vacío y error. Verificar pruebas de widgets abriendo un reporte desde Mis reportes, incluyendo respuesta antigua sin `history`.
- [x] 4.3 Añadir pull-to-refresh al detalle para obtener conjuntamente estado e historial actualizado. Verificar con una API falsa que el gesto ejecuta otra consulta, cambia estado y eventos y termina el indicador tanto en éxito como en error, permitiendo un nuevo intento.

## 5. Verificación integrada

- [x] 5.1 Ejecutar `flutter analyze` y `flutter test` desde `apps/mobile`, y `npm.cmd test` y `npm.cmd run contract:check` desde `apps/api` con el entorno de pruebas configurado. Registrar resultados y resolver regresiones relacionadas con el cambio.
- [x] 5.2 Verificar el recorrido de ingreso, envío autenticado, aparición en Mis reportes, apertura de seguimiento, actualización institucional, recarga manual y logout. Comprobar también envío invitado y denegación de un reporte ajeno usando datos de prueba.
- [x] 5.3 Ejecutar `openspec validate citizen-mobile-identity-and-tracking --strict` y revisar la compatibilidad de los requisitos añadidos con el delta `citizen-mobile` de `operational-mvp`, conservando sus requisitos de GPS, fotos y pendientes.

## 6. Entrega local

- [x] 6.1 Compilar e instalar el APK de desarrollo con APP_ENV=development y API_BASE_URL=http://127.0.0.1:3000/api/v1. Verificado mediante compilación exitosa, instalación ADB con Success y apertura en el Samsung A34.
- [x] 6.2 Conectar el móvil por USB mediante `adb reverse tcp:3000 tcp:3000` y comprobar la API local. Verificados el túnel, `/api/health` y `/api/health/database` con respuesta 200.
- [x] 6.3 Aplicar la migración pendiente en la base de aplicación con `npm.cmd run db:migrate:app`. Verificada la aplicación de `012_medical_triage.sql` en `incidencias` y un POST local de reporte con respuesta 201.
- [x] 6.4 Enviar un reporte desde el móvil después de la corrección del esquema y verificar su referencia en el panel local tras pulsar Actualizar, con un rol autorizado y filtros compatibles. Registrar la referencia y el resultado observado.

## Resultados de verificación

- Flutter analyze sin incidencias. Suite Flutter completa con 16 pruebas aprobadas y una prueba de API remota omitida por configuración. Después se añadió el caso de registro y logout, con las 6 pruebas de widget aprobadas.
- API con RUN_MYSQL_INTEGRATION=1 en incidencias_test, 78 pruebas aprobadas y una prueba opcional de seed omitida por falta de DB_SEED_TEST_NAME. Contrato OpenAPI válido con 58 rutas y 4 roles.
- Recorridos verificados mediante widgets con API controlada y pruebas HTTP con MySQL real, incluyendo propiedad, invitado, eventos cronológicos, avance global multiinstitucional y rollback.
- Para ejecutar la integración se inició Docker Desktop y MySQL local y se preparó incidencias_test con 12 migraciones, catálogos y datos DEMO.
- OpenSpec validate --strict aprobado y requisitos compatibles con el delta ciudadano de operational-mvp.
- Se corrigió el APK que usaba una dirección de ejemplo y posteriormente apuntaba a Render, instalando la compilación local mediante USB. Las pruebas automatizadas del apartado 5 corresponden a widgets y HTTP con MySQL de test. La comprobación del apartado 6.4 cubre el recorrido en el dispositivo y panel locales.
- La base de aplicación tenía 11 migraciones. Se aplicó la migración 012 para los tres campos clínicos y se confirmó el envío HTTP local con referencia `INC-2026-5A2AAFB344E9`, identificado como DEMO técnico. El 2026-11-16 se verificó el reporte enviado desde el Samsung A34 con referencia `INC-2026-27B9980CD821` en el panel local http://127.0.0.1:5173/incidentes tras pulsar Actualizar, con rol SuperAdministrador, estado Todos y sin limitar a excepciones. La referencia apareció en la tabla de incidentes.
