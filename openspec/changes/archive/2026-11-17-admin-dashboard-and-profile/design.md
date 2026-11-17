# Design

## Context

La motivación está en `proposal.md`. Dashboard consulta `/ops/incidents`, presenta seis filas con referencia y prioridad textual y abre el detalle desde Ver reporte. `PriorityBadge` y sus estilos ya resuelven las cuatro prioridades en bandeja y detalle. El listado operativo devuelve `categoryId` y aplica el ámbito antes de devolver resultados.

Shell muestra nombre, códigos de roles y Salir. No existe una ruta de perfil institucional. `/auth/me` consulta id, nombre, correo y teléfono y permite editar nombre y teléfono. `/auth/password/change` valida la contraseña actual, cambia el hash y aumenta la versión de credenciales en una transacción que revoca tokens de renovación y recuperación. La política vigente acepta 12 a 128 caracteres. Las membresías activas se obtienen durante la autenticación con institución, sede y rol, pero carecen de nombres legibles.

La prueba ciudadana de perfil verifica exactamente los cuatro campos publicados. El cliente administrativo mantiene la sesión en memoria y su renovación puede terminar después de cerrar sesión. Se requiere diseño porque el cambio cruza interfaz, contratos de API y ciclo de sesión.

## Goals / Non-Goals

### Goals

- Reutilizar componentes, validaciones y operaciones autenticadas existentes.
- Incorporar nombres de categoría y asignaciones mediante ampliaciones compatibles de consulta.
- Hacer verificables los estados de interacción y el aislamiento de datos al cambiar o cerrar una sesión.

### Non-Goals

El cambio de correo con verificación y las preferencias de notificaciones quedan para propuestas posteriores.

## Decisions

### 1. Bloques recientes como enlaces completos

Sustituir las filas del panel Incidentes recientes por una lista compacta de bloques, cada uno con un `Link` real a `/incidentes/:id` que cubra todo el bloque. Incluir categoría destacada, referencia secundaria, estado e insignia de prioridad, con distribución adaptable. Un enlace proporciona navegación con Enter, apertura en otra pestaña y semántica accesible. La alternativa de una fila con manejador de clic exige replicar estas interacciones y complica la accesibilidad. Evitar controles interactivos anidados dentro del enlace.

Reutilizar `PriorityBadge` y sus estilos. Verificar que su estado desconocido presenta Por confirmar como exige la nueva especificación. Mantener los textos y alertas como señales adicionales al color. Reutilizar los estados de carga y error y el componente de vacío del proyecto.

En la bandeja, mantener la tabla con estado, verificación, prioridad y fecha. La primera columna mostrará categoría y referencia dentro de un enlace nativo cuyo pseudoelemento cubra toda la fila. La fila será el contenedor posicionado y tendrá respuesta visual al pasar el cursor y al enfocar el enlace. Retirar la columna de Abrir. Usar `categoryName` de la API y, para respuestas anteriores, resolver el nombre con el catálogo ya cargado, con Categoría no disponible como último recurso.

El resaltado al pasar el cursor se expresará mediante el fondo de la fila. Categoría y referencia conservarán su presentación sin subrayado. La regla específica `.table-wrap .incident-list-link:hover` prevalecerá sobre el estilo general de enlaces de tablas. El foco de teclado seguirá indicando la fila completa mediante el contorno del enlace extendido.

Permitir que las tarjetas reduzcan su ancho con `min-width: 0` y que los encabezados con acciones se distribuyan en varias líneas. La revisión a 375 px detectó que el ancho mínimo de la tabla extendía la tarjeta y recortaba el encabezado. El desplazamiento horizontal se limitará al contenedor de la tabla, con título, filtros y acciones ajustados al ancho de pantalla.

### 2. Nombre de categoría desde el listado operativo

Ampliar la consulta de `listOperational` con un LEFT JOIN al catálogo y devolver `categoryName` nullable. La unión recuperará también categorías inactivas para preservar la lectura de reportes históricos. Conservar identidad, filtros, ámbito, orden y campos existentes. El frontend usará Categoría no disponible si el nombre está ausente o vacío.

La alternativa de resolver nombres desde el catálogo público añadiría otra consulta y perdería nombres históricos cuando el catálogo solo publica elementos activos. Esta ampliación no requiere una migración.

### 3. Perfil propio y contexto institucional

Agregar `/perfil` y `/perfil#seguridad` con los mismos roles institucionales admitidos por Dashboard. Organizar la página en Datos personales, Información institucional y Seguridad, con acceso a Cerrar sesión. El menú de cabecera usará un botón desplegable y enlaces/botones nativos con estado expandido, Escape, cierre exterior y retorno de foco. Emplear un mapa de etiquetas para los roles técnicos.

Mantener `/auth/me` como punto de consulta y edición. Para identidades con roles institucionales, ampliar GET con `roles` y `memberships`, recuperados en servidor. Cada membresía contendrá `institutionId`, `institutionName`, `siteId`, `siteName` y `role`. Filtrar las membresías e instituciones activas como hace la autorización vigente y resolver los nombres desde los registros relacionados. Mantener la relación de cada sede con su institución. Presentar todas las asignaciones y los estados Todas las sedes, Ámbito global y Sin asignación institucional activa según corresponda.

Para cuentas exclusivamente ciudadanas, conservar exactamente la respuesta personal actual. PATCH mantendrá la lista permitida de nombre y teléfono y su respuesta personal vigente para todos los clientes. Esto permite reutilizar las rutas existentes y preserva las expectativas de la app y pruebas ciudadanas. La alternativa de una segunda API de perfil duplicaría la lectura de los mismos datos y validaciones.

### 4. Edición sincronizada con la identidad actual

Cargar datos personales desde GET y enviar únicamente name y phone a PATCH. Tras confirmar el guardado, actualizar el nombre en la sesión conservando tokens y roles. Si la cuenta cambió o cerró sesión durante la petición, descartar esa actualización. Mantener la edición ante rechazos y evitar que recargas en segundo plano sobrescriban cambios sin guardar. Rol y asignaciones se obtienen del servidor y se muestran como información de consulta.

### 5. Seguridad y cierre de sesión

Reutilizar el cambio de contraseña existente, con validación de longitud y confirmación antes del envío y control de visibilidad independiente por campo. Un resultado 204 limpia inmediatamente la sesión local y dirige a `/login` con un mensaje de éxito que no dependa del perfil desmontado. En errores de validación, mostrar el motivo y permitir corregir. Ante una respuesta perdida, informar la incertidumbre y ofrecer volver al ingreso. Evitar reenvíos automáticos de esta operación.

La opción Cerrar sesión utilizará el logout existente, con navegación explícita a `/login`. Introducir en el cliente una versión de sesión o comprobación equivalente para impedir que una renovación tardía restablezca credenciales tras cerrar o cambiar de cuenta. Aplicar el mismo criterio a las respuestas de perfil y guardado. La alternativa de esperar a que terminen todas las peticiones antes de cerrar retrasaría la salida y seguiría dependiendo de la red.

### 6. Organización visual de Cobertura y reglas

Distribuir Derivación sugerida en dos áreas alineadas al inicio. Las sedes sugeridas aparecerán a la izquierda y el formulario de asignación a la derecha. En cada sugerencia, presentar la institución como contexto, destacar el nombre de sede y separar el motivo de la regla mediante espacio y un borde superior. Mantener la señal existente de sede seleccionada.

Agrupar Sede responsable y Operador en dos columnas dentro de un formulario con fondo suave y borde. Los mensajes y el motivo de corrección ocuparán el ancho disponible. Ubicar Confirmar asignación en una franja inferior alineada a la derecha, separada por un borde. Conservar las condiciones de visibilidad, selección, carga, validación, deshabilitación y envío de los controles existentes.

Con un ancho disponible de hasta 1050 px, apilar sugerencias y formulario. Hasta 600 px, apilar también los campos y extender el botón al ancho disponible. Cuando no existan sugerencias, el formulario ocupará el área completa. Usar clases de presentación específicas para que la distribución se aplique a esta tarjeta.

## Risks / Trade-offs

- Una ampliación incondicional de GET rompería la expectativa de respuesta ciudadana exacta. Añadir contexto solo para identidades institucionales y verificar ambos contratos.
- Una categoría desactivada podría desaparecer si se usa el catálogo público activo. Resolver el nombre mediante la relación persistida del incidente.
- Varias membresías pueden confundir si se selecciona una sola. Mostrar cada asignación y su rol asociado.
- Una renovación o edición tardía puede recuperar datos de una cuenta cerrada. Verificar la identidad o versión de sesión antes de publicar resultados.
- Los bloques ocupan más alto que las filas actuales. Mantener la información compacta, el límite de seis y comprobar escritorio y pantalla compacta.
- Los estilos generales de enlaces de tabla pueden reintroducir el subrayado. Aplicar la regla específica del enlace del incidente. La revisión visual confirmó el cambio de fondo sin subrayado y el contorno de foco de toda la fila.
- El código del Dashboard y Login ya contiene ediciones locales previas. Revisarlas durante apply e integrar la implementación respetando ese trabajo.

## Migration Plan

1. Publicar las ampliaciones compatibles de API y su contrato OpenAPI.
2. Publicar la interfaz de bloques, menú y perfil junto con la protección de respuestas tardías.
3. Verificar lectura histórica, los tres roles institucionales y la continuidad ciudadana. No se requieren cambios de esquema ni recarga de datos.
4. Si se revierte el frontend, las ampliaciones de API siguen siendo compatibles. Para revertir la API, retirar primero la interfaz dependiente o mantener temporalmente sus estados de datos ausentes.
