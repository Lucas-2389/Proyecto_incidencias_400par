# Design

## Context

Ver `proposal.md` para la motivación. `report.dart` consulta categorías y envía descripción, contacto, ubicación y foto. La API ya valida `subcategoryId`, `affectedPeople` y los tres booleanos anulables, y `PendingReport` serializa el cuerpo completo.

`map_view.dart` consume `/public/heatmap`. `apps/api/src/geospatial/router.js` agrupa celdas públicas y reserva `/ops/map` a roles institucionales con ámbito. Sus filtros actuales exigen fechas y limitan consultas a 90 días y 5000 filas. `mine.dart` abre detalles privados autorizados por propietario. SharedPreferences y Material Icons están disponibles.

La capacidad principal `geospatial-views` aún vive como delta en `operational-mvp`. Allí se exige agregación pública, también descrita en RF-33, RF-34, RF-35 y RN-11 del SRS y en el apartado geoespacial del SDD. La decisión confirmada por el usuario incorpora un mapa móvil de incidentes con ubicación aproximada. La capacidad nueva `public-incident-map` define ese contrato individual y exige documentar la excepción móvil antes de entregar la implementación.

## Goals / Non-Goals

El diseño integra captura clínica con el flujo actual de envío y reintentos, define una proyección pública comprobable en servidor y permite favoritos locales sin depender de una sesión. La entrega de aplicación corresponde a una fase posterior mediante apply.

Los límites de implementación abarcan captura, consulta pública y almacenamiento local. La sincronización de favoritos entre dispositivos, notificaciones push de reportes ajenos y nuevas reglas clínicas quedan fuera del cambio.

## Decisions

### Captura clínica con categorías por código estable

Usar `medical_emergency` y `traffic_accident` para activar el bloque después del selector y antes de descripción. La selección por nombre o identificador fijo haría depender la interfaz de etiquetas o seeds. El filtro genérico por especialidad ampliaría la visibilidad más allá de las dos categorías confirmadas.

Mostrar una tarjeta con las tres preguntas visibles, controles Sí, No y No sé y selección inicial desconocida. Usar `bool?` y conservar `false` al construir el cuerpo. El subtipo opcional consulta `/catalog/categories/{id}/subcategories`, con opciones de la categoría elegida. Para tránsito se emplean Colisión, Atropello y Volcadura cuando estén activos, y para emergencia médica sus subtipos configurados. Reutilizar `subcategoryId` impide asociar una subcategoría médica a tránsito.

Ofrecer No sé, 0, 1, 2 y 3 o más para afectados. No sé representa cantidad desconocida, mientras 0, 1 y 2 envían su valor explícito. La opción 3 o más abre una entrada de cantidad exacta y exige un entero mínimo de 3. Mantener la ayuda sobre la persona principal junto a las observaciones y la descripción. Todo el bloque es opcional, incluida la selección de subtipo.

Al cambiar de categoría restablecer los cinco datos y descartar respuestas tardías de carga de subtipos. Al confirmar o guardar un pendiente, limpiar el formulario. Ante un fallo de envío conservar la edición. El cuerpo serializado de `PendingReport` conserva los valores enviados y la clave original durante reintentos.

### API pública individual y proyección explícita

Añadir `GET /public/incidents` y `GET /public/incidents/{id}` al módulo geoespacial. Cada objeto contendrá solo `id`, `reference`, `categoryId`, `districtId`, `status`, `createdAt` y `location` con `latitude`, `longitude`, `approximate=true` y `cellSizeDegrees=0.01`. El listado devuelve `{ incidents, from, to }`, con fechas efectivas UTC. El detalle devuelve el objeto público.

El listado combina filtros `categoryId`, `districtId`, `from` y `to`. Sin fechas, el servidor fija ahora y siete días anteriores. Una sola fecha produce 422. Aplicar las reglas actuales de intervalo creciente, máximo 90 días y máximo 5000 incidentes elegibles. Consultar 5001 para detectar exceso y devolver `QUERY_LIMIT`. Los límites se aplican después de excluir sensibles. El detalle por identificador aplica visibilidad en cada consulta y permite recuperar favoritos antiguos sin depender del intervalo de listado.

Filtrar sensibilidad en SQL con la categoría y la subcategoría, incluidas categorías sensibles distintas de violencia. Seleccionar solo columnas requeridas. El detalle sensible o inexistente devuelve el mismo 404. Establecer `Cache-Control: no-store` en las respuestas individuales públicas para reducir la persistencia de incidentes reclasificados. Mantener el almacenamiento de respuestas públicas únicamente en memoria durante la vista, invalidándolo cuando una nueva consulta responde 404.

Se eligen rutas públicas específicas porque `/ops/map` entrega datos de atención bajo autorización institucional, y `/incidents/{id}` contiene descripción, evidencia e historial de propietario. Sus comprobaciones de acceso continúan vigentes. `/public/heatmap` conserva compatibilidad para los consumidores existentes y la app móvil deja de consultarlo.

### Posición aproximada determinista en el servidor

Publicar el centro de una celda fija de 0,01 grados por eje. Calcular el índice como `floor(coordenada / 0.01)` y limitarlo al intervalo entero de -9000 a 8999 para latitud y de -18000 a 17999 para longitud. Obtener el centro como `(indice + 0.5) * 0.01`, con normalización a tres decimales. Así, los límites positivos de 90° y 180° corresponden a los centros válidos de 89,995° y 179,995°, y los negativos de -90° y -180° a -89,995° y -179,995°. La aproximación ronda un kilómetro por celda en Ayacucho. Esta granularidad es una decisión técnica propuesta para revisión, el usuario confirmó el uso de posición aproximada.

Calcular la posición antes de serializar y usar la misma transformación en listado y detalle. La celda es independiente de los filtros, del zoom y de la sesión, evitando que respuestas sucesivas añadan precisión. La cuadrícula conserva una relación espacial suficiente para explorar incidentes y permite representar varios en una misma celda. Se consideraron centroides distritales, que acumularían todos los casos del distrito, y desplazamientos aleatorios variables, que dificultarían selección y coherencia entre consultas.

### Interacción del mapa móvil

Reutilizar FlutterMap, teselas configuradas y atribución. Encabezar la vista con filtros Categoría, Distrito y Fechas opcionales en ese orden, con desplazamiento o adaptación en pantallas compactas. Las dos primeras selecciones parten de Todas y Todos. Los distritos proceden de `/territory/districts`. Mostrar el intervalo efectivo al consultar sin fechas.

El selector de días representa inicio y fin inclusivos en hora local. Construir el límite exclusivo como inicio del día calendario siguiente y convertir ambos a UTC. Validar antes de consultar y mostrar 422 recuperable cuando el rango supera el máximo. Asociar cada respuesta a la selección vigente para evitar que una consulta tardía sustituya marcadores actuales.

Usar íconos vectoriales Material por código de categoría y uno genérico para códigos nuevos. Añadir leyenda, etiquetas semánticas y contraste, con ficha de referencia, categoría, estado, fecha, ubicación aproximada y favorito. Para puntos coincidentes abrir una lista de incidentes seleccionables. Estados de carga, vacío y fallo deben distinguirse y mantener la acción de reintento. La ficha pública usa la proyección permitida.

### Favoritos del dispositivo y actualización pública

Agregar un repositorio pequeño sobre SharedPreferences con clave versionada `publicIncidentFavoritesV1` y una lista de identificadores únicos. Inyectarlo desde el arranque o shell para probar persistencia y reutilizar una única instancia. Serializar escrituras y confirmar el resultado de guardado antes de actualizar el estado visible. Un fallo conserva la selección previa y muestra error.

Ofrecer Favoritos desde la pantalla Mapa, con una lista desplazable y recarga manual. Los favoritos pertenecen al dispositivo y permanecen al cambiar de sesión. En cada apertura, consultar el detalle público de cada identificador con concurrencia limitada, sin guardar copias del contenido en disco. Cada fila muestra su propio estado de carga o error. Un 404 muestra No disponible, elimina datos previos de memoria y permite quitar la entrada. Un fallo de red conserva el identificador y permite reintentar. Guardar un favorito concede acceso a la misma proyección pública.

## Risks / Trade-offs

- Publicar incidentes individuales permite correlación aun con posiciones aproximadas. Mitigar con exclusión de sensibles, proyección mínima y posiciones deterministas. La aproximación espacial tiene límites frente a información externa.
- Una clasificación sensible incorrecta puede publicar un incidente elegible por error. Mantener la clasificación de categoría y subtipo como fuente de visibilidad y comprobar reclasificaciones en listado y detalle.
- Muchos favoritos generan múltiples lecturas. Limitar concurrencia y mantener errores por fila para evitar bloquear toda la lista.
- Datos locales dañados pueden impedir la lectura de favoritos. Validar el formato de identificadores, deduplicar y ofrecer recuperación con eliminación local sin tocar pendientes de envío.
- El delta previo de `operational-mvp` puede reintroducir la obligación general de agregación al archivarse. Documentar explícitamente su relación con esta capacidad y revisar coherencia de ambos cambios durante implementación y archivo.

## Migration Plan

1. Incorporar rutas públicas y contrato, verificando privacidad, filtros y compatibilidad geoespacial existente en pruebas aisladas.
2. Incorporar captura clínica y reintentos, después mapa y favoritos en Flutter. SharedPreferences inicia con lista vacía cuando falta la clave. Los pendientes anteriores siguen siendo válidos al omitir campos clínicos.
3. Actualizar los apartados afectados de SRS/SDD y reconciliar la excepción móvil en el delta geoespacial de `operational-mvp`, manteniendo trazabilidad de requisitos.
4. Desplegar API compatible antes de distribuir la app actualizada. Verificar un recorrido DEMO en entorno de desarrollo y registrar resultados de las comprobaciones.
5. Si se revierte, restaurar la vista móvil anterior y retirar las rutas nuevas cuando sus clientes hayan sido retirados. La reversión conserva reportes y pendientes, y deja inactiva la clave local de favoritos para una futura versión compatible.
