# Tasks

## 1. API pública de incidentes y privacidad

- [x] 1.1 Añadir listado y detalle públicos en `apps/api/src/geospatial/router.js` con proyección explícita y exclusión SQL de sensibilidad por categoría o subcategoría. Verificar mediante pruebas HTTP que listado, acceso directo y reclasificación excluyen sensibles y que las respuestas carecen de identidad, contacto, descripción, evidencia y datos clínicos.
- [x] 1.2 Aplicar posiciones de centros de celdas fijas de 0,01 grados con índices limitados a las celdas geográficas válidas y cabeceras no-store a ambas rutas. Verificar coordenadas negativas, límites de latitud ±90° y longitud ±180° con sus centros de borde correspondientes, rangos válidos de salida, estabilidad entre filtros, igualdad de posición entre listado y detalle, ausencia de coordenadas originales y respuesta 404 indistinguible para sensible e inexistente.
- [x] 1.3 Implementar filtros combinados, fechas opcionales con siete días efectivos, intervalo máximo de 90 días y detección de más de 5000 incidentes elegibles. Verificar límites de fecha inclusivo/exclusivo, errores 422, exclusión de sensibles antes del límite y recuperación por ID de un favorito antiguo.
- [x] 1.4 Documentar ambas rutas, esquema mínimo, intervalos efectivos y errores en `packages/contracts/openapi.yaml`. Ampliar las pruebas geoespaciales y de contrato y ejecutar `npm --prefix apps/api run contract:check` y las pruebas afectadas, comprobando compatibilidad de `/public/heatmap`, `/ops/map` y acceso privado por propietario.
- [x] 1.5 Actualizar los apartados geoespaciales afectados de `docs/01-entrega/SRS.md`, `SDD.md` y el delta de `operational-mvp/specs/geospatial-views/spec.md` para reconocer el mapa público móvil individual aproximado. Verificar trazabilidad de RF-33 a RF-35 y RN-11 y ausencia de obligaciones contradictorias con `public-incident-map`.

## 2. Cuestionario rápido SAMU

- [x] 2.1 Incorporar en `report.dart` el bloque opcional por códigos `medical_emergency` y `traffic_accident`, tres respuestas anulables y ayuda sobre persona principal. Verificar en pruebas de widgets visibilidad condicional, Sí/No/No sé, valor inicial desconocido y alcance de los controles en pantalla compacta con texto ampliado.
- [x] 2.2 Cargar subcategorías activas de la categoría seleccionada y capturar cantidad exacta o desconocida reutilizando los campos del contrato. Verificar subtipos médicos y de tránsito, opciones No sé/0/1/2/3 o más, diferencia entre cero y desconocido, mínimo de 3 en la entrada exacta y rechazo de negativos, decimales y texto, limpieza al cambiar categoría, respuestas de catálogo tardías, carga vacía y fallo recuperable sin bloquear un envío sin subtipo.
- [x] 2.3 Incorporar los cinco datos al cuerpo de envío y su restablecimiento tras confirmación o guardado pendiente. Ampliar `report_test.dart` y `submission_test.dart` para comprobar `false`, `null`, envío autenticado e invitado, conservación ante fallo, reinicio con pendiente clínico y reintento del mismo contenido y clave sin duplicación.

## 3. Mapa móvil con marcadores

- [x] 3.1 Sustituir en `map_view.dart` la consulta y representación de calor por el listado público, conservando teselas y atribución configuradas. Verificar carga, vacío, fallo y reintento mediante pruebas de widgets con API simulada, y comprobar que la vista deja de solicitar `/public/heatmap` y no llama a `/ops/map`.
- [x] 3.2 Incorporar filtros Categoría, Distrito y Fechas opcionales en ese orden usando catálogos existentes. Verificar combinaciones, valores Todas/Todos, borrado de fechas, intervalo efectivo, conversión de días locales inclusivos a UTC y protección frente a respuestas tardías.
- [x] 3.3 Añadir íconos Material por código con alternativa genérica, leyenda accesible, selección de marcadores coincidentes y ficha pública. Verificar que cada incidente sea seleccionable, la ubicación se rotule aproximada y los estados de carga y error sean legibles en pantalla compacta y texto ampliado.

## 4. Favoritos locales y seguimiento público

- [x] 4.1 Implementar persistencia de identificadores en SharedPreferences con clave versionada, deduplicación y escrituras serializadas, e inyectarla en la navegación móvil. Verificar reinicio, guardado y eliminación, acciones repetidas, cambios de sesión, datos locales inválidos y fallo de escritura conservando el estado anterior.
- [x] 4.2 Añadir acción de favorito a la ficha y lista accesible desde Mapa para invitados y ciudadanos. Verificar que guardar un reporte ajeno persiste únicamente su identificador y que quitarlo sigue disponible sin conexión.
- [x] 4.3 Consultar el detalle público al abrir o recargar favoritos con concurrencia limitada y error por fila. Verificar estado actualizado fuera del intervalo del mapa, fallo de red recuperable, 404 tras reclasificación con retirada de contenido previo y ausencia de solicitudes al historial privado ajeno.

## 5. Integración y revisión del cambio

- [x] 5.1 Ejecutar `flutter pub get`, `flutter analyze` y `flutter test` en `apps/mobile`, y las comprobaciones de PR de CONTRIBUTING en su orden indicado, incluido build React antes de pruebas API. Registrar resultados y cualquier integración MySQL omitida como no verificada, utilizando exclusivamente bases aisladas `_test` para integraciones.
- [x] 5.2 Verificar un recorrido DEMO local que envíe triaje, reproduzca un pendiente, filtre el mapa, guarde un favorito ajeno, actualice su estado y lo reclasifique como sensible. Comprobar en respuestas HTTP y UI la exclusión pública y la persistencia de permisos privados.
- [x] 5.3 Ejecutar `openspec validate mobile-report-triage-and-map --strict`, validar la reconciliación con `operational-mvp` y revisar `git diff --check`. Confirmar correspondencia entre las tres especificaciones, diseño, contrato y tareas completadas antes de preparar la revisión.

## Verificación de implementación del 16 de noviembre de 2026

- `flutter pub get` completado. `flutter analyze` sin avisos. Suite Flutter final con 40 pruebas aprobadas y dos pruebas optativas de red omitidas en la ejecución habitual. La prueba local se ejecutó por separado y pasó. La prueba remota de Render permanece omitida.
- Build React completado antes de la suite API. `npm --prefix apps/api test` con 58 pruebas aprobadas y 26 integraciones MySQL omitidas. `contract:check` valida 62 rutas. Administración con 7 archivos y 15 pruebas aprobadas.
- Pruebas nuevas de rutas públicas verifican proyección mínima, exclusión SQL, filtros, aproximación de coordenadas y límites. Las pruebas Flutter verifican cuestionario, pendientes clínicos persistidos, filtros y fechas, respuestas tardías, marcadores coincidentes, accesibilidad en pantalla compacta y favoritos locales.
- Tras activar Docker se verificó el acceso a `incidencias_test` por el puerto configurado 3307. Migraciones con 0 pendientes sobre 13. Ejecutadas seis pruebas con MySQL real, sin omisiones, en `public-map-mysql.test.js`, `geospatial-directory-api.test.js` e `incident-report-api.test.js` mediante `RUN_MYSQL_INTEGRATION=1`.
- El recorrido `flutter test test/local_triage_journey_test.dart --dart-define=RUN_LOCAL_TRIAGE_DEMO=true` pasó contra una API temporal en `127.0.0.1:3017` conectada a `incidencias_test`. Verificó pendiente clínico, recuperación del almacenamiento, idempotencia, filtro médico, favorito ajeno de un visitante, persistencia local, cambio de estado y retiro por sensibilidad en la ficha. El entorno de widgets simula las teselas externas. La API temporal usó `APP_ENV=development`, `PORT=3017` y `DB_NAME=incidencias_test`.
- La recuperación de caché tras una escritura rechazada por SharedPreferences está cubierta por una prueba de regresión. Las nueve pruebas de mapa y favoritos pasaron tras ese ajuste.
- `mobile-report-triage-and-map` y `operational-mvp` pasan validación OpenSpec estricta. `git diff --check` y revisión de espacios en archivos nuevos sin incidencias. Se cerraron la API temporal y los procesos huérfanos de sus pruebas. Los fixtures DEMO permanecen exclusivamente en la base aislada.
