# Mapa regional y sedes de referencia

El mapa distingue referencias geográficas y datos operativos. La capa regional cubre las 11 provincias y los 124 distritos presentes en el servicio consultado de INDECI. El ámbito operativo metropolitano sigue siendo el configurado por el proyecto; esta capa no amplía permisos, asignaciones ni notificaciones.

## Uso

Las sedes DEMO se excluyen inicialmente. Información de las referencias → Incluir sedes de simulación permite verlas con identificación explícita para pruebas. Si no existen otras sedes, el mapa informa el inventario vacío: no se crean ubicaciones reales por inferencia. Desactivar la simulación no borra registros. La ausencia de indicador DEMO tampoco equivale a validación oficial.

- Pasar el cursor por un distrito resalta su polígono y muestra el nombre.
- Seleccionar una provincia acerca la referencia territorial y filtra las sedes mostradas. No filtra ni concede acceso a incidentes de otras instituciones.
- El mapa inicia sin capas superpuestas. Los botones Reportes, Límites distritales, Municipalidad, PNP, SAMU y Bomberos permiten activar solo lo necesario. Limpiar capas las oculta todas. Las sedes coincidentes se agrupan con los símbolos de sus entidades para que no se tapen.
- Elegir una provincia o activar una capa no cambia el encuadre. Centrar zona ajusta explícitamente la vista al distrito operativo seleccionado o a la provincia/región de referencia. Sede para centrar y Ver sede acercan el mapa a una sede registrada y activan su entidad. No se inventan ni trasladan ubicaciones oficiales.
- Los botones de incidentes muestran solo categorías con reportes autorizados en el periodo y distrito consultados. La lista base se mantiene al filtrar una categoría, de modo que se pueda elegir otra sin perder los botones. No se muestran categorías vacías.
- Los marcadores identifican sedes de simulación. Una sede registrada sin indicador DEMO tampoco acredita por sí sola validación oficial de su ubicación.
- Los filtros operativos de tipo, distrito y fechas se aplican a reportes autorizados. Al cambiar de categoría se conserva el mapa, el zoom y el espacio de la página durante la consulta. Si falla la actualización, se conserva la consulta anterior con un aviso.

## Procedencia y límites

Cartografía: [servicio de límites administrativos de INDECI](https://geosinpad.indeci.gob.pe/indeci/rest/services/LimitesAdministrativos/limitesAdministrativos/MapServer/0).
El archivo `apps/api/data/ayacucho-reference.geojson` incluye URL de consulta, fecha de descarga, checksum de la respuesta y simplificación de 0.0003 grados para visualización. No se conoce por esta descarga la fecha de levantamiento de cada límite. Son límites referenciales, no una certificación legal ni coordenadas aptas para deslinde.

Actualizar explícitamente con `node apps/api/scripts/download-ayacucho-reference.js`; revisar el diff y validar geometrías antes de publicar. No descarga datos al iniciar la API ni modifica MySQL. La capa metropolitana existente conserva su fuente y versión independientes; pueden existir diferencias entre ambas cartografías.

Sedes: `GET /api/v1/ops/map/sites` consulta exclusivamente registros activos de las cuatro entidades vinculados a distritos con UBIGEO 05. No se cargó un padrón nacional ni se inventaron ubicaciones. La descarga externa de puntos consultada durante esta mejora fue rechazada por el proveedor; incorporar un inventario completo requiere una fuente pública verificable, revisión de condiciones de uso, deduplicación y validación de coordenadas. No se convierten los datos de prueba en sedes oficiales.

La capa de sedes se comparte entre perfiles operativos autenticados solo como referencia de ubicación. No expone teléfonos, correos, personal, disponibilidad de unidades ni detalles de reportes. Los controles de acceso de los incidentes permanecen en la API.

## Verificación

Probar cambio de tipo durante una petición pendiente, regreso a todos los tipos, activación combinada y ocultación de sedes, selección de provincia, sombreado al entrar/salir y ausencia de acceso anónimo a las sedes. Ejecutar las pruebas del panel, backend, build y validación OpenAPI.

Comprobaciones locales del 19 de noviembre de 2026:

- Backend: 61 pruebas aprobadas, 0 fallidas y 30 omitidas (integraciones optativas no habilitadas). Los nuevos tests HTTP cubren cartografía, procedencia y acceso a sedes.
- Panel, revisión final: 67 pruebas aprobadas. Se cubre la continuidad de la instancia del mapa durante una consulta de categoría pendiente, categorías con datos, botones de sedes, recursos y rutas administrativas recuperadas.
- HTTP con MySQL local real: health y database health 200, referencia regional 200, sedes sin sesión 401 y sedes con administrador municipal 200. Hay 19 sedes de simulación, no un padrón oficial.
- Las 124 geometrías pasaron `ST_IsValid` mediante consultas SELECT, sin importación ni escritura de cartografía en MySQL.
- Primera verificación con Edge/Playwright (plugin Browser no disponible): 124 polígonos renderizados, activación de 16 sedes municipales, ocultación y selección de Huamanga. Al pulsar Inundación se conservó el elemento Leaflet y el desplazamiento varió menos de 5 píxeles; no hubo errores JavaScript. Se capturaron vistas de escritorio y de 390 píxeles. La revisión posterior reduce el hover a 0.12, con etiqueta de 10 píxeles y ancho máximo de 145 píxeles. Esto no certifica disponibilidad de las teselas externas ni corrección legal de los límites.
- Recorrido posterior en Edge: cuatro entidades activadas, 19 sedes de referencia, un tipo de incidente con datos en el periodo local, desplazamiento de 0 píxeles al filtrar, etiqueta distrital de 10 píxeles, edición y reinicio de formularios de recursos, punto de sede seleccionado en mapa, cancelación de cierre de sesión y Perfil conservado. Sin errores JavaScript.
