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

### Inventario de las 124 municipalidades de Ayacucho

Fuente base: [Directorio Nacional INEI 2026](https://www.gob.pe/institucion/inei/informes-publicaciones/8058591-directorio-nacional-de-gobiernos-regionales-municipalidades-provinciales-distritales-y-de-centros-poblados-2026), publicado el 24/04/2026 con información al 13/03/2026. Se extrajeron UBIGEO, distrito, provincia y dirección municipal del Excel de Ayacucho. Se excluyeron deliberadamente las columnas de coordenadas de la capital legal del distrito y los datos personales de autoridades. El archivo JSON conserva URL y checksum SHA-256 del ZIP oficial y de las páginas consultadas; no se versiona el archivo binario descargado.

El cruce con fichas de sedes de gob.pe se realizó el 19/11/2026. El inventario versionado `apps/api/data/ayacucho-municipalities.json` contiene 124 municipalidades en 11 provincias, con 111 fichas de sedes utilizables y 13 direcciones sustentadas únicamente en el directorio INEI. Se conserva la dirección INEI junto a la publicada en gob.pe para revisar discrepancias. Una fecha de consulta no equivale a fecha de actualización ni confirma que la oficina continúe operando.

Resultado: 35 sedes centrales publican un enlace con coordenadas extraíbles. De ellas, 33 coinciden con el interior del distrito regional y se cargaron como referencias revisadas. Los puntos publicados para María Parado de Bellido y Samugari no coinciden con el distrito declarado en la cartografía disponible; se conservan como conflicto, sin marcador. Las otras 89 municipalidades no tienen coordenadas extraíbles de su ficha seleccionada. En total, 91 de las 124 municipalidades quedan pendientes de ubicación. No se sustituyen sus puntos por una plaza o capital distrital. El registro también puede contener otras fichas previas de sedes secundarias, PNP o Bomberos; sus cantidades no forman parte de estos 124 municipios.

Preparación local, después de aplicar la migración 015:

```powershell
# Vista previa: no escribe datos
node apps/api/scripts/import-ayacucho-municipalities.js
# Carga auditada: indicar un SuperAdministrador activo de la base local
node apps/api/scripts/import-ayacucho-municipalities.js --apply-local --reviewer-email=superadmin@demo.invalid
```

El comando requiere desarrollo, host local, base `incidencias` y usuario `incidencias_app`. Es idempotente y conserva revisiones existentes. No importa cuentas, recursos ni incidentes; no envía notificaciones ni permite usar Aiven. El revisor identifica al responsable local de esta importación documental; no representa conformidad de la municipalidad.

Para ver el resultado: Mapa → Actualizar → Municipalidades. No hace falta activar simulaciones. Provincia de referencia filtra los marcadores; Centrar zona ajusta explícitamente el encuadre. Instituciones → Referencias institucionales permite buscar nombre/dirección/UBIGEO y filtrar revisadas o pendientes. Para revisar fuentes futuras, abrir el `sourceUrl` de cada ficha, comprobar la identidad y dirección, extraer exclusivamente el enlace del edificio, actualizar fecha/checksum y contrastar la geometría antes de registrar una nueva revisión.

### Registro documental separado

Referencias de seguridad y respuesta aportadas y confirmadas por el usuario el 19/11/2026, revisadas mediante la API con método `user_report`:

| Referencia | Coordenadas aportadas | Observación |
| --- | --- | --- |
| Bomberos Ayacucho, ficha existente N.º 63 | -13.147844714758861, -74.22351278465743 | Distrito Ayacucho; la dirección histórica previa no confirma el punto actual. |
| Segunda referencia de Bomberos | -13.168346742331178, -74.2004461 | Distrito Andrés Avelino Cáceres Dorregaray; nombre y número pendientes, sin atribuir una compañía concreta. |
| PNP Ayacucho Central | -13.1638933636342, -74.2271857026688 | Distrito Ayacucho; ubicación aportada por usuario. |
| Comisaría PNP de Carmen Alto | -13.177005094404521, -74.22128986394388 | Identidad PNP confirmada por usuario; dirección postal pendiente. |

Los cuatro puntos pasaron el contraste distrital. Las dos fichas nuevas son referencias documentales, no crean instituciones operativas, cuentas ni recursos. El popup identifica la procedencia del usuario. Los datos originales se conservan en `ayacucho-site-candidates.json`, incluidas coordenadas precisas y el nombre pendiente de la segunda referencia de Bomberos; se muestran al activar PNP o Bomberos sin habilitar simulaciones. SAMU no se modifica con estos aportes.

Correcciones adicionales aportadas por el usuario (19/11/2026), guardadas con método `user_report` y auditoría:

| Sede | Latitud aportada | Longitud aportada |
| --- | --- | --- |
| Huamanga | -13.160276699263768 | -74.22480844940415 |
| San Juan Bautista | -13.166252053301704 | -74.22363181349309 |
| Carmen Alto | -13.183738663692202 | -74.2216403306851 |
| Jesús Nazareno | -13.147328628752078 | -74.21290134232872 |

Los cuatro puntos pasaron el contraste interior del distrito regional correspondiente. Se conservan con su precisión original en `userLocationCorrection`; MySQL almacena siete decimales según el esquema. Las fuentes institucionales originales permanecen como antecedentes y `locationHold` impide reactivarlas automáticamente tras retirar una revisión. La ubicación del edificio procede del usuario y no se presenta como comprobación institucional independiente. Con Cáceres, el estado local vigente es de 34 marcadores municipales: 29 de enlaces institucionales contrastados y cinco corregidos por el usuario. Quedan 90 municipios sin marcador.

La captura posterior de Google Maps aportada por el usuario muestra **-13.161545, -74.213056** en la ficha de la municipalidad de Cáceres. Se sustituyó mediante revisión auditada la transcripción previa (-13.1617, -74.2106), separada unos 267 metros. Se mantiene el método `user_report` y la procedencia de la captura; no se atribuye la discrepancia al proveedor de teselas. El punto original de gob.pe permanece como evidencia histórica cuestionada y no se reactiva automáticamente.

Corrección aportada posteriormente por el usuario: se registró explícitamente el punto **-13.1617, -74.2106** para Andrés Avelino Cáceres Dorregaray mediante la API auditada, con método `user_report`. La API confirmó pertenencia al interior del distrito; esto no verifica el edificio. El popup y la ficha señalan que es una ubicación indicada por un usuario, sin confirmación institucional independiente. El JSON conserva `userLocationCorrection` separada del punto original y mantiene `locationHold` para que el importador no restablezca automáticamente el enlace cuestionado. La revisión actual se conserva en futuras importaciones. El total vuelve a 33 marcadores municipales: 32 de enlaces institucionales contrastados y uno indicado por el usuario.

Corrección posterior por observación del usuario (19/11/2026): se retiró la revisión del punto de Andrés Avelino Cáceres Dorregaray mediante la API auditada. El usuario señaló que se muestra sobre el parque; [Jornada](https://jornada.com.pe/mientras-se-remodela-el-parque-de-las-banderas-vecinos-denuncian-robos-y-consumo-de-licor/) describe el local frente al parque y un directorio externo publica otra posición. Esto exige comprobar el edificio, sin sustituirlo automáticamente por ese punto externo. La ficha conserva la dirección, el enlace institucional y el conflicto mediante `locationHold`, que impide reactivarlo en el importador aunque esté dentro del distrito. Resultado vigente: 32 sedes municipales con marcador y 92 pendientes en el inventario de 124; las cifras anteriores documentan la carga inicial. La pertenencia distrital es una comprobación territorial, no una verificación del edificio.

Actualización del 19/11/2026: se incorporó la Sede Central de la Municipalidad Distrital Andrés Avelino Cáceres Dorregaray, Jr. Los Rosales 205, Urbanización Jardín. La [página institucional de sedes](https://www.gob.pe/institucion/muniandresavelinocaceresdorregaray/sedes) enlaza el [punto -13.162306, -74.213347](https://maps.google.com/maps?daddr=-13.162306,-74.213347&ll=). Se registró su revisión mediante la API autenticada y auditada en el entorno local, con coincidencia distrital 050116. La referencia al Parque de las Banderas no sustituye al punto del edificio. No se modificaron coordenadas de sedes DEMO ni se certificó disponibilidad operativa. El archivo de candidatos conserva la procedencia; volver a ejecutar el preparador en una base nueva crea la ficha pendiente y requiere registrar la revisión explícita.

Instituciones y Directorio incorporan fichas pendientes con fuentes y notas. Solo una ubicación revisada por el superadministrador puede aparecer como referencia cartográfica; no se convierte automáticamente en sede operativa. El mapa señala cantidad de pendientes y permite abrir su revisión. Los grupos de incidentes muestran alerta de prioridad alta/crítica y el popup identifica simulaciones. Véase el [procedimiento de evaluación local](../03-validacion/EVALUACION_MAPA.md) para la migración 015, preparación idempotente y ocho escenarios ficticios.

Probar cambio de tipo durante una petición pendiente, regreso a todos los tipos, activación combinada y ocultación de sedes, selección de provincia, sombreado al entrar/salir y ausencia de acceso anónimo a las sedes. Ejecutar las pruebas del panel, backend, build y validación OpenAPI.

Comprobaciones locales del 19 de noviembre de 2026:

- Backend: 61 pruebas aprobadas, 0 fallidas y 30 omitidas (integraciones optativas no habilitadas). Los nuevos tests HTTP cubren cartografía, procedencia y acceso a sedes.
- Panel, revisión final: 67 pruebas aprobadas. Se cubre la continuidad de la instancia del mapa durante una consulta de categoría pendiente, categorías con datos, botones de sedes, recursos y rutas administrativas recuperadas.
- HTTP con MySQL local real: health y database health 200, referencia regional 200, sedes sin sesión 401 y sedes con administrador municipal 200. Hay 19 sedes de simulación, no un padrón oficial.
- Las 124 geometrías pasaron `ST_IsValid` mediante consultas SELECT, sin importación ni escritura de cartografía en MySQL.
- Primera verificación con Edge/Playwright (plugin Browser no disponible): 124 polígonos renderizados, activación de 16 sedes municipales, ocultación y selección de Huamanga. Al pulsar Inundación se conservó el elemento Leaflet y el desplazamiento varió menos de 5 píxeles; no hubo errores JavaScript. Se capturaron vistas de escritorio y de 390 píxeles. La revisión posterior reduce el hover a 0.12, con etiqueta de 10 píxeles y ancho máximo de 145 píxeles. Esto no certifica disponibilidad de las teselas externas ni corrección legal de los límites.
- Recorrido posterior en Edge: cuatro entidades activadas, 19 sedes de referencia, un tipo de incidente con datos en el periodo local, desplazamiento de 0 píxeles al filtrar, etiqueta distrital de 10 píxeles, edición y reinicio de formularios de recursos, punto de sede seleccionado en mapa, cancelación de cierre de sesión y Perfil conservado. Sin errores JavaScript.
