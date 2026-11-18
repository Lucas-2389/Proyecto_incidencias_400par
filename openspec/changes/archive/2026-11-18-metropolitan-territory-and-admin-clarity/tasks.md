# Tasks

## 1. Paquete territorial y compatibilidad del esquema

- [x] 1.1 Obtener la cartografía distrital publicada por el INEI y extraer los cinco UBIGEO del diseño. Entregar paquete WGS84, metadatos, fecha y checksum y verificar que contiene exactamente las cinco geometrías válidas con sus extensiones.
- [x] 1.2 Añadir migraciones aditivas para versión territorial, correspondencias antiguas y condición de resolución de ubicaciones. Verificar su aplicación mediante `npm run db:migrate:test` y las FK de incidentes, sedes, sectores, contactos y alertas en MySQL de prueba.
- [x] 1.3 Ampliar territorio con consulta del ámbito metropolitano y geometrías versionadas manteniendo los contratos de catálogo actuales. Verificar los cinco nombres y códigos, filtros generales anteriores y respuesta cartográfica con pruebas del módulo territorial y contrato OpenAPI.
- [x] 1.4 Actualizar `packages/contracts/openapi.yaml` y documentar en `apps/api/README.md` la fuente, orden de coordenadas y comandos territoriales. Verificar `npm run contract:check` y que los ejemplos consultan catálogo y límites correctamente.

## 2. Carga y resolución de datos existentes

- [x] 2.1 Implementar carga con simulación, aplicación explícita, equivalencias de códigos conocidos y activación de versión consistente. Verificar bases con un distrito DEMO, cinco distritos DEMO y catálogo real previo y comprobar que una fuente incompleta conserva la versión activa.
- [x] 2.2 Resolver puntos interiores, exteriores, fronterizos y solapados con condición explícita y reutilizar esa resolución al registrar incidentes desde móvil y panel. Verificar un caso interior por distrito y los casos ambiguos en MySQL espacial.
- [x] 2.3 Preparar y aplicar reclasificación de ubicaciones existentes y correspondencias declaradas de contactos, alertas y sectores. Verificar el informe de cambios y pendientes, integridad de FK e identidades de incidentes, sedes, cuentas e historial.
- [x] 2.4 Coordinar carga y nuevas escrituras mediante la versión territorial y sus bloqueos. Verificar una activación concurrente con registro de incidente, una interrupción y su reanudación, repetición de carga y reversión de lote en una base de prueba.
- [x] 2.5 Adaptar `seed-demo.js` para reutilizar territorios canónicos disponibles y conservar datos sintéticos identificados. Ampliar `seed-demo.test.js` y verificar que repetir el seed conserva cuentas, claves, sedes y catálogo sin duplicar distritos.
- [x] 2.6 Documentar en `apps/api/README.md` actualización, simulación, informe y reversión. Verificar los comandos sobre una copia de prueba del estado antiguo y registrar que el catálogo final devuelve los cinco distritos.

## 3. Filtros de API y consultas operativas

- [x] 3.1 Añadir distrito a listados operativos y de sedes y aplicarlo en las consultas antes de límites y paginación. Verificar combinación con estado y ámbito autorizado, incluyendo un incidente válido situado después del límite de una consulta sin filtro.
- [x] 3.2 Aplicar distrito a sedes e incidentes de `/ops/map` y comprobar métricas de `/ops/stats`. Ampliar pruebas geoespaciales para los cinco distritos, muestras vacías y sedes de otros ámbitos.
- [x] 3.3 Verificar que `/public/incidents` filtra por el distrito original antes de aproximar coordenadas. Ampliar `public-map-api.test.js` y `public-map-mysql.test.js` con una posición aproximada que cruza una frontera y un caso sensible excluido.
- [x] 3.4 Actualizar OpenAPI de filtros, aliases de transición y condiciones territoriales. Verificar `npm run contract:check` y las pruebas de contratos de organización y geoespacial.

## 4. Filtros y límites en el panel

- [ ] 4.1 Actualizar `MapView.jsx` para solicitar el catálogo metropolitano, dibujar límites referenciales, encuadrar selección y conjunto y conservar el contorno sin reportes. Verificar los cinco distritos, Todos y un fallo recuperable de geometrías mediante pruebas del componente y revisión visual.
- [x] 4.2 Añadir distrito a Dashboard y bandeja, enviando el mismo filtro a métricas e incidentes recientes. Verificar intersección con filtros vigentes, límite de seis recientes, muestras vacías y descarte de respuestas tardías con pruebas React.
- [x] 4.3 Aplicar selección de distrito y agrupación institucional a las sedes de `Resources.jsx`, mostrando estado territorial y discrepancias al editar ubicación. Verificar sedes conocidas y pendientes con roles de superadministrador y administrador institucional.
- [x] 4.4 Actualizar los apartados afectados de la guía del panel y verificar `npm run test` y `npm run build` desde `apps/admin`, además de la lectura de nombres largos y controles por teclado.

## 5. Auditoría e historial comprensible

- [x] 5.1 Incorporar tipos y acciones canónicos y equivalencias históricas para instituciones, sedes, usuarios, contactos y eventos operativos. Verificar que filtros y etiquetas reconocen los valores guardados por las versiones anteriores.
- [x] 5.2 Integrar auditoría transaccional de cuentas, sedes y contactos con estados permitidos anteriores y posteriores y excluir esas escrituras del middleware genérico. Verificar reversión ante fallo de auditoría, un solo evento por cambio y ausencia de contraseña, hash y tokens.
- [x] 5.3 Enriquecer `/admin/audit` con nombres y contexto autorizado e incorporar búsqueda, acción, fechas, sede y distrito. Verificar búsquedas y enlaces de objetos ajenos, eventos con datos faltantes y compatibilidad del arreglo y campos existentes.
- [x] 5.4 Añadir navegación estable con límite de instantánea y cabeceras de continuidad documentadas. Verificar más de 50 eventos, inserción de un evento entre páginas y filtros combinados manteniendo resultados coherentes.
- [x] 5.5 Actualizar `History.jsx` con resúmenes legibles, campos modificados, filtros, paginación y referencias técnicas desplegables. Verificar un cambio de teléfono, usuario antiguo, entidad no disponible y estado vacío o error con pruebas React.
- [x] 5.6 Alinear métricas de Historial por fecha, institución y distrito y explicar periodo y fórmula del promedio. Verificar una muestra de varias asignaciones y una sin asignaciones, diferenciando los filtros propios de auditoría.
- [x] 5.7 Actualizar la línea de tiempo de `Incidents.jsx` y sus etiquetas para creación, derivación, estados, prioridad, verificación y duplicados. Verificar eventos conocidos, desconocidos y asignaciones fuera de la vista sin ampliar acceso.
- [x] 5.8 Actualizar OpenAPI y documentación de auditoría y ampliar `alerts-notifications-audit.test.js` con compatibilidad histórica, permisos y fallos transaccionales. Verificar contrato y las pruebas focalizadas de API y React.

## 6. Usuarios con acceso por sede

- [x] 6.1 Ajustar `/admin/users` para comprobar sede activa dentro del alta y validar todas las membresías y roles afectados al editar cuentas. Ampliar `institutions-api.test.js` con múltiples membresías, ámbitos cruzados, desactivación y reversión consistente con auditoría.
- [x] 6.2 Incorporar listado y formulario de usuarios en cada sede de Instituciones con institución y sede precargadas y roles permitidos. Verificar creación, edición de nombre y cambio de estado por ambos roles administrativos y restricción del operador.
- [x] 6.3 Añadir el paso Crear usuario tras guardar sede y recuperación sobre el identificador confirmado. Verificar fallo posterior al alta de sede, correo duplicado, doble pulsación y respuesta perdida sin duplicar cuenta ni sede.
- [x] 6.4 Documentar el flujo de acceso institucional y verificar en integración que un usuario creado desde el panel inicia sesión y consulta únicamente su ámbito autorizado.

## 7. Contactos y selección territorial móvil

- [x] 7.1 Actualizar `Directory.jsx` con edición de campos, distrito por nombre, sede opcional y opciones según rol. Verificar alta, corrección y desactivación, pertenencia institucional y publicación del número corregido mediante las pruebas de directorio.
- [x] 7.2 Cambiar el nombre visible a Contactos de emergencia conservando `/directorio`. Verificar navegación y acceso directo en `flow.test.jsx` y documentar su finalidad en la guía del panel.
- [x] 7.3 Actualizar `map_view.dart` para solicitar el ámbito compartido, dibujar contornos y encuadrar selección y conjunto, conservando categorías y fechas. Ampliar `public_map_test.dart` con los cinco distritos, vacío, error y respuesta tardía.
- [x] 7.4 Actualizar `directory.dart` para consultar nacionales y locales por distrito, con nombres de institución y sede, sin descartar la publicación administrada. Verificar contactos de dos distritos, ausencia de locales y apertura del marcador.
- [x] 7.5 Guardar la última lista nacional confirmada y su fecha con respaldo inicial. Verificar primera apertura sin Internet, corrección, desactivación, lista confirmada vacía y fallo de red posterior mediante pruebas Flutter.
- [x] 7.6 Sustituir el identificador numérico de `alerts.dart` por selector de distrito con generales y resultados locales. Verificar los cinco distritos, limpieza, error recuperable y conservación de selección durante recarga.
- [x] 7.7 Actualizar la documentación móvil afectada y verificar `flutter analyze` y las pruebas Flutter focalizadas, además de nombres largos, texto ampliado y mensajes de ubicación aproximada.

## 8. Verificación de integración

- [x] 8.1 Ejecutar un recorrido por cada distrito desde registro móvil y telefónico hasta bandeja, Dashboard, mapas, métricas e historial. Verificar coincidencia de distrito y filtros usando referencias de incidentes y cuentas con distintos ámbitos.
- [x] 8.2 Ejecutar el recorrido sede nueva, usuario nuevo, ingreso, actualización de contacto y consulta móvil por distrito. Verificar acceso, publicación, auditoría legible y recuperación del usuario pendiente.
- [x] 8.3 Revisar correspondencia entre las nueve especificaciones, diseño y resultados obtenidos y reconciliar los requisitos superpuestos de los cambios pendientes al preparar la sincronización. Verificar `openspec validate metropolitan-territory-and-admin-clarity --strict` y registrar el resultado de contratos y comprobaciones de integración.

## Workflow follow-up

### Evidencia de implementación y verificación (2026-11-17)

- Cartografía extraída de `https://ide.inei.gob.pe/files/Distrito.rar`: cinco MultiPolygon WGS84 válidos en MySQL, códigos 050101, 050104, 050110, 050115 y 050116. El paquete conserva checksum y metadatos; distingue la referencia 2023 del portal de la fecha interna 2026-03-06 del GeoPackage. Los límites se presentan como referenciales.
- Base local `incidencias`: migración aditiva y carga explícita completadas. Catálogo y endpoint de límites devuelven los cinco distritos. Versión activa `f50ccd9c-0dd6-47c0-b042-8fba24053249`; se conservaron los 9 incidentes, 13 cuentas y 4 sedes existentes. El informe reclasificó 13 ubicaciones, modificó 3 y dejó 0 pendientes. La API local fue reiniciada y su respuesta HTTP verificada.
- API: suite general aprobada; contrato OpenAPI válido (64 rutas). Suite MySQL focalizada aprobada, 17 pruebas sin omisiones: `admin-clarity`, `metropolitan-territory`, `institutions-api`, `incident-report-api`, `alerts-notifications-audit`, `geospatial-directory-api`, `public-map-api`, `public-map-mysql` y `seed-demo`. Tras el ajuste final de visibilidad histórica se repitieron `admin-clarity` y `alerts-notifications-audit`: 3 pruebas aprobadas.
- Los recorridos 8.1 y 8.2 se verificaron automáticamente: HTTP real y MySQL para registros por canal móvil y telefónico en los cinco distritos, asignaciones, bandeja, mapas, métricas, historial, alta e ingreso de cuentas y publicación de contactos. Las pruebas React y Flutter verifican los formularios y consultas correspondientes; esto no sustituye una inspección visual en navegador o dispositivo.
- Panel: suite completa de 60 pruebas aprobada y compilación de producción aprobada. Después se añadió y aprobó la prueba de cinco contornos sin reportes, recuperación de cartografía y selección por nombre largo (suite `dispatch-interface`: 18 pruebas aprobadas). Los controles usan etiquetas y elementos nativos enfocables. `useRemote` descarta respuestas anteriores al filtro vigente.
- Móvil: `flutter analyze` sin incidencias; suite completa `flutter test --no-pub`: 46 aprobadas y 2 omitidas por requerir habilitación de entornos HTTP externos/locales. Incluye cinco contornos, texto ampliado, selección, respuestas tardías, contactos publicados, marcador, alertas y reemplazo completo de caché nacional, incluso con lista vacía.
- Correspondencia de las nueve capacidades: territorio se verifica en `metropolitan-territory` y los recorridos MySQL; Dashboard y mapa operativo en consultas MySQL y React; auditoría e historial operativo en pruebas API y React; organización institucional en permisos y recuperación de altas; navegación en `flow`; selección móvil y contactos en pruebas Flutter y API.
- `openspec validate metropolitan-territory-and-admin-clarity --strict` aprobado. `git diff --check` sin errores.
- **Pendiente de 4.1:** la implementación y sus pruebas están aprobadas, pero falta inspección visual del mapa en navegador. Computer Use detuvo el acceso porque no pudo comprobar la URL de Chrome con suficiente confianza. No se eludió esa restricción ni se marca esta tarea como terminada.

### Cierre solicitado (2026-11-18)

- La revisión visual posterior permitió observar el selector con los cinco nombres y Todos, el conjunto metropolitano, Ayacucho con 3 reportes y 4 sedes, Carmen Alto con 1 reporte y Andrés Avelino Cáceres Dorregaray sin reportes, conservando su contorno destacado y encuadrado. La recuperación del fallo de geometrías está cubierta por la prueba de componente. Queda pendiente completar la inspección visual individual de Jesús Nazareno y San Juan Bautista; por ello 4.1 sigue sin marcarse.
- En el intento final, Computer Use no pudo conectar con su servicio nativo. Se conserva el resultado real de 39/40 tareas, sin convertir la revisión parcial en una validación visual completa.
- Ante la nueva solicitud explícita de archivo, se sincronizaron las nueve capacidades: 22 requisitos añadidos y 3 modificados. Las 15 especificaciones principales pasaron la validación estricta; se verificaron los requisitos de cada delta, los escenarios anteriores, los títulos y los propósitos conservados. El archivo mantiene la advertencia de revisión visual pendiente.

### Reconciliación previa a sincronización

- `territorial-coverage` de `operational-mvp`: conservar jerarquía, resolución y cobertura por sede; los requisitos de este cambio amplían catálogo, geometría versionada y condiciones explícitas. La cobertura institucional no se reemplaza por la mera pertenencia a un distrito.
- `audit-trail` de `operational-mvp`: conservar registro crítico y consultas por ámbito; incorporar enriquecimiento, navegación y escritura transaccional como requisitos complementarios, sin duplicar eventos ni ampliar acceso.
- `emergency-directory` de `operational-mvp`: conservar publicación territorial, administración y llamada iniciada por la persona; ampliar edición, nombres y caché nacional. Mantener una sola definición de cada requisito al sincronizar.
- Mapa público de `mobile-report-triage-and-map`: conservar aproximación de coordenadas, exclusión de información sensible y favoritos; calcular el distrito antes de aproximar. La cartografía común amplía los filtros sin modificar esas garantías.
- `institutional-organization`: el seed reutiliza territorios canónicos, conserva identidades y claves y mantiene identificables los recursos sintéticos DEMO.
- La sincronización de este cambio quedó completada durante el cierre del 2026-11-18. Los otros cambios pendientes conservan su propio estado y sus deltas deben reconciliarse al archivarlos.

- Al archivar posteriormente `operational-mvp` y `mobile-report-triage-and-map`, preservar los requisitos ya sincronizados de este cambio según la reconciliación anterior.
- Se archiva por solicitud del usuario con la única advertencia de 4.1 pendiente. Completar esa inspección visual como seguimiento.
