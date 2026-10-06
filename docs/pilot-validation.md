# Validación del piloto operacional DEMO

Fecha de ejecución: 2026-10-06. Cambio OpenSpec: `operational-mvp`. Esta evidencia corresponde a bases `_test` aisladas y datos ficticios de Ayacucho; la base operativa `incidencias` no recibió migraciones ni seeds.

## Comprobaciones ejecutadas

| Comprobación | Resultado observado |
| --- | --- |
| `docker compose ps` | MySQL 9.7.2 en `127.0.0.1:3307`, contenedor `healthy`. |
| `db:migrate:test` sobre `incidencias_full_test` | `0/10` migraciones nuevas; checksums ya aplicados. |
| Seeds de referencia y DEMO sobre esa base | 4 roles, 16 categorías, 4 instituciones y 3 incidentes DEMO. |
| `RUN_MYSQL_INTEGRATION=1`, `DB_TEST_NAME=incidencias_full_test`, `npm --prefix apps/api test` | 57/57 pruebas aprobadas, 0 omitidas. Incluye health checks, autenticación, RBAC, GIS, fotos, idempotencia, concurrencia, auditoría y rollback. |
| `npm --prefix apps/admin test` y `npm --prefix apps/admin run build` | 4/4 pruebas aprobadas y build Vite completo. |
| `flutter analyze --no-pub` y `flutter test --no-pub` en `apps/mobile` | Sin problemas de análisis y 6/6 pruebas aprobadas. GPS, ubicación manual, referencia, foto pendiente y navegación. |
| `npm --prefix apps/api run contract:check` | OpenAPI válido: 58 rutas, 4 roles. |
| `openspec validate operational-mvp --strict` | Cambio válido. |
| API real en puerto 3107 contra `incidencias_full_test` | `/api/health` devolvió `ok`; `/api/health/database` devolvió `connected`; catálogo 23 entradas y directorio público 6 en esta base de pruebas. |
| `flutter build apk --debug --no-pub` | No ejecutó compilación: `No Android SDK found`. `flutter devices` detectó Windows, Chrome y Edge, sin Android; `flutter emulators` no encontró AVD. |

Las pruebas de health checks simularon MySQL inaccesible y credenciales erróneas y comprobaron HTTP 503 genérico sin exponer la contraseña; la suite integrada también rechazó acceso cruzado y foto inválida. Las pruebas Flutter simularon pérdida y retorno de red con el mismo `clientRequestId`, sin crear un segundo pendiente. Los logs HTTP omiten cuerpos, consultas, tokens y encabezados.

## Recorrido HTTP integrado

Se creó `incidencias_e2e2_test` como base vacía separada. `incidencias_app` recibió permisos solo para esa base. Se aplicaron 10/10 migraciones y el seed DEMO explícito: 4 instituciones y 3 incidentes iniciales. Una contraseña DEMO y un `JWT_SECRET` aleatorios se guardaron exclusivamente en `apps/api/.local/e2e-credentials.json`, ignorado por Git. El backend usó `incidencias_app`, no `root`. La base `incidencias_e2e_test` también quedó migrada y sembrada tras un primer intento: login respondió 503 porque faltaba `JWT_SECRET`; no se borró ni se reutilizó para el segundo intento.

`node apps/api/scripts/pilot-http-flow.js`, con `DB_TEST_NAME=incidencias_e2e2_test` y esas dos variables locales, verificó por HTTP:

1. Login ciudadano y SuperAdministrador DEMO, categoría de incendio y tres reportes con coordenadas, precisión y `clientRequestId` distintos. La corrección de ubicación en la interfaz Flutter se verificó por prueba de widget.
2. Reenvío idéntico de uno de los reportes con la misma referencia, sin duplicarlo.
3. Foto PNG válida adjunta tras confirmar; reporte visible solo en el historial propio.
4. Sugerencia de Bomberos, verificación, asignación de sede, Operador, unidad y personal.
5. Estados `reported → verifying → assigned → en_route → attending → resolved → closed`; detalle ciudadano final `closed` y avisos internos.
6. Bandeja institucional, mapa con puntos autorizados, mapa de calor público agregado, directorio nacional DEMO y auditoría de estados.

Salida observada: referencia `INC-2026-E6A5D564AA9C`, estado `closed`, 1 evidencia, 10 avisos, 9 incidentes visibles en mapa operativo, 1 celda pública, 1 contacto y 6 eventos de auditoría para el incidente. La interfaz React tiene pruebas de flujo independientes; este recorrido usó sus endpoints, sin controlar una sesión visual de React. La app Flutter tiene pruebas de interacción, pero tampoco participó como cliente Android real en este recorrido.

El recorrido se repitió sin reiniciar ni vaciar la base y volvió a cerrar otro incidente (`INC-2026-DAAC155DA7D1`); quedaron 1 evidencia, 1 celda pública, 1 contacto y 6 eventos de auditoría asociados a ese segundo incidente.

## Pendiente para cerrar las 105 tareas

La tarea 12.3 permanece abierta: ejecutar de principio a fin **en Android**, conectando la app Flutter, API, MySQL y panel React, y confirmar visualmente el retorno al móvil. El equipo usado carece de Android SDK y de emulador o dispositivo Android configurado. Se necesitan esas herramientas para compilar APK y hacer la demostración. No se considera terminado el MVP por el recorrido HTTP ni por las pruebas de widgets.

Comprobación adicional del equipo HP Laptop 15-dy5xxx: Windows informa `HypervisorPresent=True` y la distribución WSL 2 `docker-desktop` funciona. Aunque `Win32_Processor.VirtualizationFirmwareEnabled` devolvió `False`, esos dos resultados indican que no conviene cambiar la BIOS preventivamente. Cuando se instale Android Studio/SDK al final, ejecutar `flutter doctor -v`, crear un AVD y probar `flutter emulators` y `flutter run`; revisar BIOS/UEFI solo si el emulador reporta un problema concreto de aceleración.

No se ejecutó `openspec archive`; no se alteró el volumen ni se eliminó ninguna base. Antes de usar datos reales o despliegue público siguen pendientes la validación legal, límites oficiales, almacenamiento compartido de fotos y prueba de carga; son riesgos posteriores al piloto descritos en el SDD.
