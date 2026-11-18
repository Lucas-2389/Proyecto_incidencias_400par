# Design

## Context

La motivación y el alcance funcional se describen en `proposal.md`. El proyecto utiliza React con react-leaflet, Flutter con flutter_map y una API Express sobre MySQL 8 con geometrías SRID 4326.

La investigación encontró los siguientes puntos de integración.

- `territory/router.js` publica el catálogo completo y resuelve puntos con `ST_Intersects`, eligiendo actualmente la primera coincidencia. `incident_locations` conserva el distrito calculado durante el registro.
- La API local consultada devolvió un único distrito `DEMO-AYA-CENTRO`. `seed-demo.js` ya define cinco distritos con rectángulos sintéticos y solo añade límites cuando todavía faltan. Repetir esa carga amplía datos de prueba pero requiere un proceso específico para incorporar cartografía verificada.
- `MapView.jsx` y `map_view.dart` ya consultan distritos y envían `districtId`. La consulta de sedes en `/ops/map` todavía omite ese filtro. El mapa móvil publica posiciones aproximadas a celdas de 0,01 grados.
- `History.jsx` consume un arreglo de auditorías y muestra referencias técnicas. La API entrega `beforeData` y `afterData`, pero el middleware genérico almacena pocos campos posteriores, omite datos anteriores y escribe después de la mutación de dominio.
- El directorio público entrega nacionales y locales del distrito solicitado. `directory.dart` solicita sin distrito y descarta los nacionales recibidos, mientras sus tarjetas nacionales proceden de una lista incorporada.
- `/admin/users` ya lista, crea y actualiza usuarios. El alta usa una transacción para cuenta, rol y membresía. La edición elige una membresía mediante `LIMIT 1`, lo que requiere tratar explícitamente cuentas con varios ámbitos antes de exponerla en la interfaz.
- `operational-mvp` contiene antecedentes de `territorial-coverage`, `audit-trail` y `emergency-directory` pendientes de sincronizar. `mobile-report-triage-and-map` está completo en tareas y contiene la especificación del mapa público todavía pendiente de archivo. Se conservarán sus límites de privacidad y se reconciliarán los requisitos compartidos antes de sincronizar este cambio.

## Goals / Non-Goals

### Objetivos de diseño

- Mantener una identidad territorial estable compartida por todos los consumidores y una cartografía con procedencia y versión.
- Conservar compatibilidad con registros antiguos y contratos públicos existentes mediante ampliaciones de campos, filtros y metadatos.
- Hacer verificable la relación entre una escritura confirmada y su auditoría, y entre una versión territorial activa y la clasificación de sus ubicaciones.
- Mantener separados el distrito físico del incidente, el distrito de una sede, su cobertura de atención y los permisos de cada cuenta.

### Límites de diseño

La cartografía se utiliza con el carácter referencial comunicado por sus publicadores. La gestión de usuarios se apoya en correo y contraseña y en los dos roles institucionales ya administrables. Las selecciones territoriales se conservan dentro de cada pantalla durante sus recargas. La sincronización automática de la selección entre todas las pantallas queda fuera del alcance acordado.

## Decisions

### 1. Catálogo canónico y ámbito metropolitano explícito

Se reutilizarán `departments`, `provinces`, `districts` y `district_boundaries`. El catálogo canónico tendrá departamento 05, provincia 0501 y los cinco UBIGEO indicados en `territorial-coverage/spec.md`. La Municipalidad Provincial de Huamanga seguirá siendo una institución y el selector territorial mostrará Ayacucho.

`GET /territory/districts` conservará su arreglo y sus filtros existentes. Se añadirá `scope=ayacucho-metropolitan` para que los consumidores del piloto soliciten los cinco distritos canónicos. El catálogo general seguirá permitiendo consultar otros territorios. La pertenencia al ámbito se mantendrá como datos de referencia, evitando listas duplicadas de nombres en React y Flutter.

Se añadirá una consulta pública de geometrías, por ejemplo `GET /territory/districts/boundaries?scope=ayacucho-metropolitan`, con GeoJSON, extensión, UBIGEO, versión, fuente y condición referencial. Cada cliente podrá dibujar los cinco contornos desde la misma respuesta. El identificador interno seguirá siendo el valor de `districtId` y UBIGEO será su identidad externa.

Se consideró añadir cinco opciones directamente a cada selector. El catálogo compartido permite resolver también incidentes, sedes y filtros de API, además de hacer visible una carga incompleta.

### 2. Cartografía oficial publicada y paquete reproducible

La fuente identificada es el [portal IDE del INEI](https://ide.inei.gob.pe/), que ofrece cartografía distrital anunciada como actualizada al 2023 y enlaza `https://ide.inei.gob.pe/files/Distrito.rar`. La extracción todavía está pendiente. La implementación obtendrá la publicación disponible del INEI y registrará su fecha real y metadatos junto con el archivo fuente y su checksum. Si la descarga cambia de formato o dirección, se conservará la misma exigencia de procedencia verificable.

Se extraerán exactamente los cinco UBIGEO y se convertirán a WGS84 con orden GeoJSON `[longitud, latitud]`. La validación comprobará unicidad de códigos, geometrías cerradas y válidas, extensión esperada y relaciones entre distritos vecinos. Los índices espaciales de MySQL y los constructores con `axis-order=long-lat` se reutilizarán conforme a las convenciones actuales del proyecto.

La geometría de clasificación conservará su precisión de fuente. Una representación simplificada para visualización podrá entregarse si se verifica que conserva la topología y se identifica su versión. La fuente y el carácter referencial serán visibles en los dos mapas, conforme a la [información de la SDOT-PCM](https://geosdot.servicios.gob.pe/visor/).

Se consideraron límites dibujados manualmente y servicios remotos consultados en cada apertura. Un paquete versionado permite reproducir la clasificación y consultar la plataforma cuando el proveedor cartográfico está temporalmente inaccesible.

### 3. Actualización desde bases antiguas y publicación consistente

Una migración de esquema añadirá los metadatos necesarios para lotes territoriales, correspondencias de identificadores antiguos y estado de resolución. Un comando explícito de carga admitirá simulación y aplicación, siguiendo la selección de base `--target=test|app` utilizada por los scripts actuales. La simulación informará filas afectadas, equivalencias y ambigüedades.

La reconciliación reconocerá solamente códigos DEMO conocidos y relaciones verificadas. Reutilizará el identificador de distrito antiguo cuando pueda convertirse de forma inequívoca y el UBIGEO canónico todavía no exista. Cuando ambos existan, conservará el distrito canónico y remapeará referencias mediante una tabla de correspondencias, manteniendo alias para resolver identificadores anteriores durante la transición. Se comprobarán todas las FK entrantes, incluidos contactos, alertas, sectores, sedes y ubicaciones.

Los polígonos nuevos y las clasificaciones se prepararán como un lote. Una coincidencia interior única producirá `resolved`. La ausencia de coincidencias producirá `outside_coverage`, una frontera compartida `boundary` y una superposición interior `overlap`. Las tres últimas conservarán distrito pendiente. Las ubicaciones sin coordenadas conservarán una condición diferenciada. La resolución no dependerá del orden de inserción de los distritos.

Antes de activar el lote, se verificarán los cinco distritos y se publicarán juntas la versión y sus asociaciones mediante transacción y bloqueo de la versión territorial activa. El alta de incidentes y cambios de ubicación participarán en ese bloqueo al resolver y guardar, para impedir escrituras clasificadas con una versión que cambie a mitad de la operación. Los lotes grandes prepararán resultados por bloques y verificarán modificaciones concurrentes antes de la activación.

La reclasificación automática utilizará coordenadas de incidentes y sedes. Una sede con distrito declarado discrepante conservará el dato anterior en el registro de migración y quedará pendiente hasta su corrección. Contactos y alertas utilizarán equivalencias verificadas de su territorio declarado. Un caso ambiguo mantendrá su registro y se listará en el resultado de carga.

Los seeds se adaptarán para reutilizar el catálogo canónico cuando esté cargado y evitar recrear los antiguos distritos DEMO. Las cuentas, contraseñas, identificadores de sedes y etiquetas de recursos sintéticos conservarán su comportamiento idempotente. Los sectores sintéticos seguirán identificados y se resolverán únicamente dentro de su distrito compatible.

Se consideró sustituir filas o ejecutar solamente `seed-demo`. La correspondencia explícita preserva las relaciones existentes y permite verificar y revertir una carga.

### 4. Filtros transversales con una semántica por objeto

| Consulta | Distrito utilizado |
|---|---|
| Mapas, bandeja, Dashboard y métricas | Ubicación original del incidente |
| Sedes | Ubicación de la sede |
| Contactos y alertas | Distrito declarado de publicación |
| Usuarios | Sede de la membresía consultada |
| Auditoría | Distrito del incidente u objeto relacionado, cuando sea conocido |

Se reutilizarán los filtros geoespaciales existentes y se añadirá `districtId` a listados operativos y de sedes. El filtro se aplicará antes de límites de consulta y se combinará con las autorizaciones. El Dashboard pasará el mismo distrito a indicadores y listado reciente. Cada pantalla conservará su selección durante recargas y mostrará resultados vacíos, fallos y carga de forma diferenciada.

La opción Todos eliminará la restricción de distrito conservando el ámbito de cada servicio. Así, Contactos mostrará nacionales y Alertas mostrará generales cuando falte selección, de acuerdo con sus contratos. Los registros de distrito pendiente serán visibles sin filtro territorial para los roles que ya puedan consultarlos.

En auditoría se conservará la clasificación de distrito disponible al escribir el nuevo evento. Para eventos antiguos se resolverá mediante el objeto autorizado y su correspondencia territorial vigente. Si faltan datos, se mostrará Distrito no disponible. Esa diferencia se identificará en el detalle del evento para evitar atribuir precisión histórica inexistente.

### 5. Mapas con límites compartidos y posiciones públicas aproximadas

React utilizará la capa GeoJSON de Leaflet y Flutter sus polígonos equivalentes. Se dibujarán los cinco límites con una selección destacada y encuadre mediante la extensión del distrito, incluso sin incidentes. Todos encuadrará el conjunto. Los cambios de categoría o fecha conservarán el distrito y las respuestas atrasadas se descartarán mediante el mecanismo de revisión o generación existente.

`/ops/map` filtrará tanto incidentes como sedes y aplicará los permisos institucionales. `/public/incidents` seguirá filtrando por el distrito guardado desde la coordenada original antes de aproximar la posición. El marcador público puede aparecer visualmente al otro lado de una frontera y la interfaz indicará Ubicación aproximada. Se mantendrán la exclusión de categorías sensibles y la proyección mínima de campos.

Se consideró filtrar en el cliente por el marcador aproximado. El filtro del servidor mantiene la coherencia territorial sin revelar coordenadas privadas.

### 6. Auditoría enriquecida y compatible

Se conservará el arreglo de `/admin/audit` y sus campos actuales. Se añadirán campos de presentación autorizados para actor, objeto, institución, sede, distrito y enlace permitido. Un mapa de equivalencias incluirá tipos antiguos como `sites`, `users`, `institutions`, `directory_entry` y `directory`, junto con sus acciones históricas. Los nuevos eventos usarán tipos y acciones canónicos.

La consulta incorporará `q`, `action`, `siteId`, `districtId`, `from`, `to` y navegación estable. Se mantendrán `limit` y `offset` para consumidores existentes. El panel fijará un identificador máximo de evento al abrir la primera página y lo enviará como límite de instantánea en las siguientes. Una lectura de `limit + 1` informará continuidad mediante cabeceras documentadas, expuestas por CORS cuando corresponda. La búsqueda se parametrizará y aplicará después de acotar los eventos autorizados, antes de paginar.

Para nuevas altas y modificaciones de cuentas, sedes y contactos, el escritor de auditoría participará en la transacción de dominio y recibirá estados anterior y posterior limitados a campos permitidos. El middleware genérico excluirá esas rutas ya auditadas para evitar duplicados y mantendrá los intentos rechazados pertinentes. Las lecturas conservarán la eliminación de secretos como defensa adicional.

La presentación mostrará resúmenes por tipo y cambios campo a campo. Las acciones de creación, derivación y duplicado tendrán mensajes propios. Los eventos desconocidos conservarán su referencia técnica desplegable y una descripción explícita. Los nombres de objetos desactivados se resolverán cuando el permiso lo permita.

Las métricas de Historial serán operativas. Usarán fecha, institución y distrito con su descripción visible. Los filtros de acción, búsqueda y tipo afectarán el listado de eventos y se presentarán bajo ese alcance. El promedio existente mide minutos desde el registro hasta cada asignación visible del conjunto seleccionado, por lo que se documentará esa fórmula y Sin datos para muestras vacías.

Se consideró reconstruir todos los cambios antiguos a partir de su estado actual. La consulta distinguirá datos históricos disponibles y campos desconocidos, porque muchos eventos anteriores carecen de estado previo.

### 7. Gestión de cuentas dentro de Instituciones

`Organization` agrupará instituciones y sedes y abrirá Usuarios con acceso desde una sede. Tras guardar una sede ofrecerá Crear usuario con sus identificadores precargados. Reutilizará `/admin/users` para listar, crear, cambiar nombre y activar o desactivar, limitando las opciones de rol según la sesión.

El alta de sede y el alta de usuario serán pasos confirmados independientes. Una falla del segundo conservará el identificador de sede y permitirá reintentar ese paso. La clave única de correo y el bloqueo de envíos pendientes evitarán duplicados. Tras una respuesta perdida se recargará el listado autorizado para reconocer un alta confirmada antes de repetir la operación.

La API validará pertenencia y estado de la sede dentro de la transacción del alta. Para cambios globales de cuenta, cargará y bloqueará todas las membresías activas del usuario y comprobará los ámbitos afectados y roles administrables. Una cuenta compartida solo podrá modificarse por un actor autorizado para todos los ámbitos afectados. Las operaciones de cuenta y auditoría se confirmarán juntas.

Se consideró crear siempre una cuenta automáticamente al guardar una sede. El paso explícito permite varias cuentas individuales, una sede todavía pendiente de operador y una recuperación clara ante fallos.

### 8. Contactos y alertas móviles

`Directory.jsx` incorporará edición de los campos de contacto y sede opcional, nombres de territorio y opciones ajustadas al rol. Se mantendrá `/directorio` y cambiará el texto visible a Contactos de emergencia.

`directory.dart` pedirá nacionales y locales al elegir un distrito y presentará la respuesta administrada. Guardará la última lista nacional completa confirmada en la persistencia local ya utilizada por la app, junto con fecha de actualización. Una respuesta nacional vacía será una actualización válida. Los números incorporados se utilizarán cuando todavía falte una lista confirmada. Los fallos posteriores conservarán la última lista y mostrarán su condición almacenada.

`alerts.dart` sustituirá Distrito ID por el selector compartido. Las consultas conservarán las alertas generales junto con las del distrito seleccionado. La recarga y las respuestas tardías seguirán el mismo criterio que el mapa.

## Risks / Trade-offs

- Cartografía fuente pendiente de extraer o con metadatos incompletos → Obtenerla y validar los cinco UBIGEO antes de publicar una versión, conservando la publicación activa ante error.
- Solapamientos o fronteras compartidas → Representar la ambigüedad y comprobar casos interiores, exteriores y limítrofes para cada distrito.
- Datos sintéticos ubicados fuera de su distrito declarado → Generar resultados de reclasificación y casos pendientes y mantener las identidades relacionadas.
- Activación territorial concurrente con nuevos reportes → Coordinar la versión con un bloqueo transaccional y volver a comprobar las filas modificadas durante la preparación.
- Nombres y relaciones de auditorías antiguas incompletos → Aplicar equivalencias y etiquetas de disponibilidad, conservando evidencia original.
- Cuentas con múltiples membresías → Comprobar todos los ámbitos afectados por cambios globales y cubrir las combinaciones de rol y sede en pruebas de integración.
- Caché nacional con teléfono antiguo durante una caída de red → Mostrar fecha y condición almacenada y reemplazar la lista completa tras una actualización confirmada.
- Solapamiento de requisitos en cambios pendientes → Revisar los deltas homónimos antes de sincronizar o archivar y conservar una sola definición vigente de cada requisito.

## Migration Plan

1. Aplicar migraciones aditivas en una base de prueba y obtener el paquete cartográfico con sus metadatos y checksum.
2. Ejecutar la simulación de carga sobre bases con un distrito DEMO, cinco DEMO y catálogo canónico. Verificar referencias, ambigüedades y resultados previstos.
3. Aplicar la carga y reclasificación bajo el mecanismo de versión, repetirla y probar la recuperación de una ejecución interrumpida. Registrar identificadores y asociaciones anteriores para reversión.
4. Desplegar la API compatible con consumidores actuales y ejecutar comprobaciones de contratos, ámbito y privacidad.
5. Actualizar panel y móvil con catálogo, geometrías, filtros, historial, contactos y usuarios. Verificar los flujos completos de los cinco distritos.
6. Comprobar los mismos resultados de catálogo y filtros en el entorno objetivo mediante el comando explícito de actualización y conservar su informe.

La reversión restaurará la versión territorial anterior y las asociaciones registradas por el lote en una transacción coordinada con las escrituras. Los registros creados después de la activación se resolverán con esa versión previa o quedarán pendientes cuando no exista coincidencia. Una reversión de clientes podrá usar los campos y rutas anteriores de la API. Las migraciones aditivas y los eventos auditados se conservarán para permitir volver a aplicar el cambio.
