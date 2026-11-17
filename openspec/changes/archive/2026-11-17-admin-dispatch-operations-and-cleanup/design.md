# Design

## Context

La motivación está en `proposal.md`. El panel utiliza React Router, React Leaflet y `useRemote`. `App.jsx` importa `Organization` y `Resources` del mismo módulo. `MapView.jsx` consulta tanto `/ops/map` como `/public/heatmap` aunque solo esté activo un modo. El mapa operativo requiere `from` y `to`, admite un máximo de 90 días y rechaza consultas de más de 5000 incidentes.

`GET /incidents/{id}` ya devuelve `subcategoryId`, `affectedPeople`, los tres booleanos clínicos anulables y coordenadas autorizadas. El catálogo expone `/catalog/categories/{id}/subcategories` y `/territory/districts`. `Incidents.jsx` todavía consulta unidades, personal y `/admin/users`. Esta última ruta excluye al rol Operador, aunque ese rol puede confirmar asignaciones.

El POST de asignaciones admite arreglos de recursos omitidos, protege la unicidad incidente/sede y bloquea la fila del incidente. El avance de asignación calcula el estado global con la etapa mínima, pero el alta solo actualiza el global desde Reportado o En verificación. El GET de asignaciones devuelve `operatorUserId`, estado y fechas, con filtrado por membresías. Su respuesta carece de nombres de recursos asignados. El historial operativo incluye `assignmentId`.

## Goals / Non-Goals

### Goals

Aplicar las cuatro especificaciones del cambio mediante componentes y contratos existentes, con una consulta adicional de operadores de alcance operativo. Concentrar el seguimiento concurrente en cada asignación y conservar la atomicidad entre estado agregado, asignaciones e historial.

### Non-Goals

La eliminación física de tablas y reservas de recursos, el rediseño móvil, la captura de un cuestionario clínico nuevo y la incorporación de transporte de eventos en tiempo real quedan fuera del alcance de este cambio.

## Decisions

### 1. Retiro de navegación y montaje de recursos

Quitar las entradas `/unidades` y `/personal`, sus rutas y la importación `Resources` de `App.jsx`. Conservar `Organization`, que comparte el archivo `Resources.jsx`, y aprovechar el fallback existente hacia `/` para enlaces antiguos. La limpieza se limita a importaciones, controles, consultas y estilos que queden sin uso por este cambio. Los consumidores de la API de recursos siguen cubiertos por su contrato existente.

### 2. Mapa operativo único y filtros por catálogo

Eliminar `mode`, la consulta de calor, su selector y el renderizado condicional asociado. Reutilizar los marcadores por categoría, agrupación por zoom, leyenda y sedes actuales. El primer filtro tendrá etiqueta Tipo de incidente y transmitirá `categoryId`. El segundo será un selector con los nombres de `/territory/districts`, ordenados por nombre y con Todos los distritos. Añadir el código territorial entre paréntesis únicamente a los nombres repetidos para distinguir sus opciones, conservando el identificador del distrito como valor enviado.

Los filtros se alinean en una cuadrícula con Tipo de incidente, Distrito, Desde (opcional) y Hasta (opcional), controles de igual altura y columnas de fecha más estrechas. El periodo aplicado y Actualizar aparecen debajo. En pantallas pequeñas se apilan Tipo y Distrito, seguidos de las fechas en dos columnas. En anchos intermedios la cuadrícula distribuye los cuatro filtros en dos filas.

Los valores vacíos de ambas fechas aplican `currentRange(7)` y muestran Últimos 7 días junto al intervalo efectivo. El intervalo predeterminado debe permanecer estable entre renders y renovarse en una nueva consulta explícita, evitando cambios continuos de URL. Al personalizar, se requiere el par completo. Interpretar cada día en America/Lima y transmitir el inicio de Desde y el inicio exclusivo del día posterior a Hasta. Así se incluye todo el último día, incluso milisegundos finales. Validar el intervalo efectivo antes de consultar, incluido el máximo de 90 días. Conservar los filtros ante error y ofrecer reintento.

Se elige resolver la opcionalidad en el cliente porque el endpoint compartido también atiende estadísticas y ya valida fechas obligatorias. Cambiar ese contrato ampliaría el trabajo a consumidores ajenos a esta pantalla.

### 3. Presentación fiel del triage existente

Añadir el bloque Triage rápido dentro de Información del reporte. Detectar información por valores distintos de `null` o `undefined` en los campos clínicos, `affectedPeople` y `subcategoryId`. Resolver cada booleano mediante comparación explícita para preservar `false` y mostrar cero afectados cuando corresponda. Usar Sí, No y No informado. Identificar las observaciones como relativas a la persona principal descrita.

Consultar subcategorías de la categoría del reporte para resolver el nombre. Mostrar Subtipo no disponible si el valor histórico carece de nombre activo, conservando los demás datos. Ante ausencia total mostrar Triage no informado. La API carece de un indicador de cuestionario completado, por lo que la visualización se basa en los campos efectivamente disponibles. La carga o error del catálogo tendrá tratamiento independiente del detalle.

### 4. Minimapa privado dentro del detalle

Incorporar un componente de ubicación con React Leaflet y `OSM_TILE_URL`, reutilizando la configuración e iconos existentes. Presentarlo en una tarjeta propia a la derecha de Información y triage en escritorio, y debajo de ellos en pantallas pequeñas. Cargarlo de forma diferida para mantener el detalle textual disponible durante la carga. Validar coordenadas finitas y sus rangos, admitiendo cero, y centrar el mapa en el reporte actual al cambiar de incidente. Dimensionarlo mediante estilos responsivos. Mostrar referencia y coordenadas también como texto, con estado de error cartográfico cuando fallen las teselas. Un reporte sin ubicación tendrá su estado vacío propio.

### 5. Sede y operador mediante un contrato operativo

Retirar de `IncidentDetail` los controles, estados, consultas y recargas de unidades y personal. Cada confirmación enviará `institutionId`, `siteId`, `operatorUserId` opcional y `reason` cuando la sede no sea sugerida. La normalización existente de recursos omitidos a `[]` cubre esta solicitud. El formulario permite agregar sucesivamente otras sedes, cada una con su confirmación independiente. La concurrencia corresponde a las atenciones coexistentes y a las acciones de varias sesiones.

Añadir `GET /ops/incidents/{id}/operators?siteId={siteId}` en el módulo operativo. Exigir autenticación, rol operativo, ámbito del incidente y `hasInstitutionScope` para la sede solicitada. Validar `siteId`, institución y sede activas. Consultar usuarios activos con membresía activa y rol Operador para esa sede, devolver `[{ id, name }]` sin duplicados y ordenar por nombre. El POST conserva su validación de elegibilidad al confirmar.

El selector se habilita al elegir sede, limpia el operador al cambiarla y presenta carga, error con reintento o lista vacía. Cancelar o descartar respuestas tardías de la sede anterior. Sin selección se envía `null`, conforme al comportamiento actual. En las tarjetas resolver el nombre usando consultas elegibles por sedes visibles, compartiendo la respuesta de la sede seleccionada y evitando recargarlas con cada ciclo de estado. Para un operador histórico ausente mostrar Operador no disponible. Para `null` mostrar Operador pendiente.

La ruta nueva evita depender de la administración de usuarios en un flujo operativo. Documentar solicitud, proyección mínima y respuestas 200, 401, 403, 404 y 422 en OpenAPI. Para institución y sede, reutilizar `/admin/institutions` y `/admin/sites`, cuyas lecturas ya admiten al Operador.

### 6. Tarjetas, historial y consistencia transaccional

Presentar una tarjeta por `assignment.id`, con nombres institucionales, sede, operador, estado y fechas. Ordenar las abiertas antes de las cerradas y conservar orden estable por fecha e identificador en cada grupo. Cada botón usa la transición vigente y su `assignmentId`. Etiquetar el bloque Asignaciones visibles. La cabecera usa el estado del detalle porque las tarjetas pueden representar una vista parcial. En el historial unir `assignmentId` con las asignaciones visibles, usando una etiqueta genérica para eventos cuya asignación carezca de visibilidad.

Extraer la tabla de etapas y el cálculo mínimo de `lifecycle.js` a un módulo de dominio compartido si hace falta para reutilizarlo sin dependencias circulares. Tanto el alta como el avance calcularán el mínimo de todas las asignaciones bajo el bloqueo existente del incidente. Al añadir una asignación guardar el global resultante y emitir `status.changed` solo si cambió. Conservar el evento de confirmación o corrección, auditoría y política vigente de notificaciones. La confirmación ocurre antes del envío best-effort existente al operador. Si falla cualquier escritura, se revierte la transacción. Resuelto y Cerrado conservan la restricción de alta vigente.

### 7. Recarga acotada y control de solicitudes

En el detalle, usar un ciclo de aproximadamente 15 segundos mientras la pestaña esté visible, además de Actualizar y recarga tras acciones o al recuperar visibilidad. El ciclo refresca detalle, asignaciones e historial. Las sugerencias se renuevan cuando una acción afecta el despacho. La evidencia depende de los identificadores existentes, evitando recargas de fotografías sin cambios. Limpiar temporizadores y listeners al salir y al cambiar `id`.

Evitar solicitudes periódicas solapadas y descartar respuestas de una consulta anterior cuando otra más reciente haya confirmado datos. Conservar la última vista durante una recarga, mostrando progreso o error local y la hora de última lectura válida. Mantener errores de lectura diferenciados de datos vacíos. La edición de sede, operador y notas se conserva durante las lecturas de seguimiento.

Cada acción mantiene estado pendiente en su control. Ante `ApiError.status === 409`, informar el conflicto, actualizar seguimiento y conservar el formulario. El mensaje de éxito corresponde a la escritura confirmada. Los errores posteriores de lectura deben permitir reintentar la consulta sin reenviar la escritura. `useRemote.reload` absorbe errores actualmente, por lo que la coordinación debe consultar el resultado de lectura o gestionar localmente las lecturas necesarias, evitando un refactor general del hook.

### 8. Repliegue del panel de Control

Ubicar Control · Verificar y priorizar inmediatamente después de Fotografías como una franja compacta. Usar un botón con `aria-expanded` y un identificador para su contenido. Inicializar replegado por incidente y distribuir los campos en una fila al abrirlo en escritorio. Guardar verificación e Iniciar verificación lo cierran únicamente después de una respuesta de escritura exitosa. Los avisos de resultado permanecen fuera del contenido replegado. Una validación o error de escritura conserva el panel abierto y la edición. El despacho y los botones de asignación mantienen su propia interacción disponible para agregar participantes y avanzar sus atenciones.

La prioridad se presenta mediante una insignia compartida en bandeja y detalle, con texto explícito, gris para Baja, azul para Normal, ámbar para Alta y rojo para Crítica. Las dos últimas incluyen alerta, y Crítica tiene mayor énfasis de borde y peso. El control incorpora el selector con el valor actual y envía `priority` con resultado y motivo mediante el PATCH existente de verificación. La edición de prioridad conserva el resultado de verificación actual.

## Risks / Trade-offs

- El refresco periódico aumenta lecturas del detalle. Mitigar pausando la pestaña oculta, reutilizando nombres de catálogos y evitando solicitudes solapadas.
- El GET de usuarios administrativos hoy produce 403 para operadores. Mitigar sustituyendo esa dependencia por la proyección operativa con ámbito de sede y pruebas de autorización reales.
- Añadir participantes puede hacer retroceder el estado global a Asignado. Mostrar los estados de cada tarjeta y comprobar historial y global en el mismo commit transaccional.
- Un catálogo activo puede carecer de nombres históricos de subtipos u operadores. Mostrar indisponibilidad explícita conservando los valores clínicos y el seguimiento.
- `operational-mvp` todavía contiene criterios de recursos y calor del panel. Actualizar durante apply sus referencias concretas y la guía de usuarios para que su futura aceptación y archivo reflejen el alcance nuevo.

## Migration Plan

Publicar primero la consulta operativa y el cálculo global de API, con su contrato y comprobaciones de integración. Después publicar el panel. Este cambio reutiliza las tablas y datos existentes. Comprobar que asignaciones históricas, incluidas las que contienen reservas, siguen avanzando y liberando recursos mediante el ciclo de vida actual. Las asignaciones ya existentes obtendrán su estado agregado al siguiente cambio operativo, conforme a la lógica transaccional compartida.

Para revertir la entrega, volver a la versión anterior de panel y API como despliegue coordinado. Los datos escritos son compatibles con el esquema actual.
