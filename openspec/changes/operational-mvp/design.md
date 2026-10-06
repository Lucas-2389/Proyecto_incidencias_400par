# Design

## Context

Véase `proposal.md` para el motivo. La Iteración 0 ya provee `apps/api` con Express 5, `mysql2/promise`, configuración de `apps/api/.env`, pool y health checks. MySQL 9.7.2 corre mediante `compose.yaml` en Docker; desde Windows se usa `127.0.0.1:3307` y la cuenta `incidencias_app`. `apps/admin` y `apps/mobile` solo contienen README. El contrato `packages/contracts/openapi.yaml` adelanta algunas rutas bajo `/api/v1`, pero debe completarse y alinearse con los comportamientos de las 14 specs de este cambio. El SDD exige un monolito modular, MySQL GIS, Android Flutter y panel React. Los datos y coberturas de Ayacucho serán demostrativos.

## Goals / Non-Goals

**Goals:**

- Un flujo demostrable Flutter → API → MySQL → panel React → seguimiento Flutter, incluidas fotos, GPS, despacho y auditoría.
- Límites de seguridad aplicados en API, migraciones reproducibles y contratos/pruebas por módulo.
- Proceso API sin sesiones en memoria, configuración por entorno y adaptadores sustituibles para fotos, correo de recuperación y push.

**Non-Goals:**

- Alta disponibilidad operativa, almacenamiento de fotos compartido entre réplicas, despliegue público, integraciones institucionales oficiales y validación legal de datos reales.
- Enlace de geolocalización para llamadas, GPS continuo de unidades, IA de clasificación y exportación Power BI.

## Decisions

### 1. Arquitectura y dependencias

Mantener `apps/api` como monolito Express por dominios: `auth`, `institutions`, `territory`, `resources`, `incidents`, `dispatch`, `evidence`, `geospatial`, `public`, `notifications` y `audit`. Cada dominio tendrá rutas, validación, servicio y repositorio; los servicios reciben dependencias (pool, reloj, adaptadores) para probarse sin servidor. `src/app.js` monta `/api/v1` y mantiene `/api/health` fuera del versionado; `src/server.js` conserva inicio/cierre ordenado del pool. Las reglas de negocio viven en servicios y la autorización se aplica antes de acceder a repositorios. Se descartan microservicios y lógica repartida entre clientes: aumentarían despliegue y riesgo de permisos inconsistentes.

### 2. Migraciones y datos

Usar migraciones SQL versionadas y un ejecutor de Node que registre versión/checksum en `schema_migrations`, con una sola ejecución por entorno y fallo visible. MySQL no garantiza reversión global de DDL: cada migración debe ser pequeña, probada sobre una base desechable y documentar reversión mediante respaldo o migración correctiva. La cuenta `incidencias_app` jamás será `root`; sus permisos de migración se documentarán y podrán separarse en producción. Los seeds de demo serán comandos explícitos e idempotentes, no parte del arranque normal ni de `docker compose up`; los usuarios demo recibirán contraseñas de ejemplo generadas localmente, fuera de Git. No modificar el volumen existente de forma destructiva.

Modelo propuesto (nombres definitivos sujetos a la primera migración; claves y relaciones sí son decisiones):

| Área | Tablas principales | Claves, índices y reglas |
| --- | --- | --- |
| Identidad | `users`, `roles`, `user_roles`, `refresh_tokens`, `password_reset_tokens` | Correo único; hash de contraseña y de tokens; rol y estado; tokens con expiración. |
| Territorio | `departments`, `provinces`, `districts`, `sectors` | FK jerárquicas, códigos estables; geometrías SRID 4326 cuando estén disponibles. |
| Instituciones | `institutions`, `sites`, `site_coverage_zones`, `institution_memberships` | Tipo, estado y contacto; sede con POINT; una o varias coberturas POLYGON/MULTIPOLYGON SRID 4326; membresías por rol/sede. |
| Recursos | `personnel`, `units` | FK sede; código único por institución; estados e índices por sede/estado. |
| Reglas | `incident_categories`, `incident_subcategories`, `routing_rules` | Catálogo editable; prioridad y tipo institucional por regla, con vigencia/estado. |
| Reporte | `incidents`, `incident_locations`, `client_requests`, `incident_duplicates` | Código público único; fuente `MOBILE_APP` o `PHONE`; punto final SRID 4326, precisión y hora; clave de idempotencia y huella de contenido únicas por ámbito. |
| Atención | `institution_assignments`, `unit_assignments`, `personnel_assignments`, `incident_history` | Relaciones N:M; FK; hitos con actor/hora; reservas activas sin ocupación incompatible. |
| Evidencia | `evidence` | Solo metadatos y clave de objeto; índice por incidencia; sin BLOB. |
| Información | `directory_entries`, `alerts`, `notifications`, `audit_logs` | Vigencia, destinatario, zona, estado de lectura; auditoría inmutable a nivel de aplicación. |

Todas las tablas funcionales tendrán PK, FK pertinentes, `created_at`/`updated_at`, restricciones e índices por consulta habitual. MySQL `POINT` y polígonos usarán SRID 4326 y se validará rango/orden de coordenadas en la API. Los índices `SPATIAL` se crearán donde MySQL los admita y la consulta GIS se probará contra la versión real. El piloto cargará polígonos ficticios claramente `DEMO`; importar límites oficiales es una operación posterior. La falta de cobertura produce bandeja de excepción, no un distrito o una sede inventados.

### 3. Identidad, autorización y privacidad

Usar bcrypt con factor de costo documentado, JWT de acceso de vida corta y refresh token opaco rotado y revocable en MySQL. El servidor calcula rol y ámbito a partir de sus datos, no confía en IDs de institución enviados por el cliente. El middleware aplica autenticación; cada servicio filtra consultas y mutaciones por institución, sede y cobertura. La matriz del anexo A del SDD gobierna permisos. Una cuenta puede tener membresías institucionales explícitas; el SuperAdministrador tiene alcance global. Recuperación: token de un solo uso, hash almacenado, expiración corta, respuesta uniforme para correos existentes o inexistentes; un adaptador de correo configurable usará un buzón de desarrollo local para la demo y permitirá sustituirlo después. Al cambiar la contraseña se revocan todos los refresh tokens y se incrementa una versión de credenciales que el middleware comprueba para invalidar JWT previos. No se registran tokens, contraseñas ni enlaces completos en logs. Limitar intentos de login, recuperación y reportes invitados. No usar cookies de sesión del servidor. Alternativa descartada: permisos decididos solo por React/Flutter o JWT de larga duración sin revocación.

### 4. Contrato HTTP y flujo de reportes

Conservar `/api/v1`, JSON UTC, identificadores opacos y errores `{ code, message, correlationId }`; en respuestas privadas usar `Cache-Control: no-store`. Completar OpenAPI antes o junto a cada endpoint, incluyendo `401/403/404/409/422/429/503` según la operación. Agrupar rutas de autenticación, catálogos, territorio, instituciones/sedes/usuarios, recursos, incidentes, fotos, operación, mapa/heatmap, directorio, alertas, notificaciones y auditoría. El contrato inicial ya contiene `/auth/register`, `/auth/login`, `/incidents`, `/incidents/mine`, `/ops/incidents`, `/ops/incidents/{id}/status`, `/ops/incidents/{id}/assignments` y rutas públicas; se completarán sin cambiar sus significados publicados. Registro por llamada será una ruta operativa protegida y siempre impondrá `source=PHONE`; la ruta móvil impondrá `source=MOBILE_APP` en el servidor.

El cliente genera `clientRequestId`/`Idempotency-Key` antes de enviar. Una transacción inserta la clave y el incidente; el conflicto concurrente devuelve la misma referencia solo si coincide la huella del contenido, y `409` si cambia. El reporte se confirma tras persistencia, sin esperar foto o notificación. La foto se sube aparte; un fallo de foto no borra el incidente. La clasificación por reglas ocurre sobre categoría y ubicación persistidas; si falla o no hay cobertura, el incidente conserva su referencia y entra en excepción. El Operador puede corregir la sugerencia con motivo y agregar varias instituciones. Alternativa descartada: IA o derivación irreversible antes de confirmar el reporte.

### 5. Operación y consistencia

Definir una máquina de estados explícita para Reportado → En verificación → Asignado → Unidad en camino → En atención → Resuelto → Cerrado, con caminos excepcionales documentados para falso, duplicado o no verificable. En cada mutación validar estado previo, rol, ámbito y motivo requerido. Actualizar estado, recursos, historial, notificaciones internas y auditoría dentro de una transacción cuando compartan MySQL. Reservar unidades/personas con bloqueo transaccional o restricción equivalente para impedir dos asignaciones activas incompatibles. Los eventos de una incidencia y sus múltiples instituciones se distinguen por asignación; el estado global se deriva de hitos acordados, sin permitir que una institución cierre unilateralmente el trabajo pendiente de otra. Registrar tiempos desde creación hasta asignación, salida, llegada y resolución. Conservar reportes duplicados enlazados, sin borrado físico por fusionar.

### 6. Fotos, mapas y canales externos

Un `EvidenceStore` define guardar, abrir de forma autorizada y eliminar. En desarrollo se usa almacenamiento local persistente fuera del árbol versionado y se guardan solo metadatos/clave en MySQL; el proceso API no guarda sesión ni estado operativo en memoria. La ruta de lectura verifica permisos antes de servir bytes. Un almacén de objetos será necesario antes de replicar instancias. Validar contenido real, MIME, cantidad y tamaño; evitar rutas aportadas por el usuario y retirar metadatos EXIF sensibles cuando corresponda. Las fotos nunca se exponen mediante URL pública estable.

Flutter y React usarán mapas OpenStreetMap mediante bibliotecas compatibles y URL de teselas configurable, con atribución. No realizar prefetch masivo del servidor público. El servidor entrega puntos exactos solo a roles operativos autorizados; la vista ciudadana recibe agregados. El mapa de calor agrupa por cuadrícula/zona e intervalo; suprime celdas bajo un umbral mínimo configurable (inicialmente 3), eleva la agregación si puede inferirse un caso sensible y nunca envía descripciones, reportantes, fotos ni puntos GPS exactos al público. Los filtros se validan y acotan para impedir consultas costosas. La API no delega la protección de datos al cliente. Alternativa descartada: descargar todos los incidentes al navegador y agregar allí.

El directorio, las alertas y las notificaciones internas se guardan en MySQL. Un adaptador `NotificationSender` permite FCM si hay proyecto y credenciales de prueba; sin ellos, las notificaciones internas siguen funcionando y la tarea principal no falla. El enlace temporal de ubicación para llamadas se documenta como futura extensión del módulo de incidentes y no se publica en este cambio.

### 7. Clientes y configuración

Crear React en la ruta existente `apps/admin` (no existe `apps/web`) con rutas protegidas y vistas por rol, formularios de administración, bandeja, mapa, despacho, historial e indicadores. La protección real queda en la API. Crear Flutter Android en `apps/mobile` con navegación corta, permiso GPS, marcador corregible, cámara/galería, seguimiento, alertas y directorio. Guardar pendientes en almacenamiento local persistente junto con `clientRequestId` y ruta temporal de foto; al confirmar, limpiar copia sensible. La app indica claramente «pendiente de envío» para no confundirlo con atención confirmada. URL de API, teselas y parámetros no secretos por entorno en React/Flutter; credenciales solo en servidor. Windows usa API y MySQL por `127.0.0.1` y puertos configurados; un futuro backend en Docker usaría `mysql:3306` por variables, sin bifurcar lógica.

### 8. Pruebas y observabilidad

Mantener pruebas Node `node --test` y añadir pruebas de módulos, HTTP e integración con MySQL real en base de pruebas separada, sin tocar el volumen `incidencias` de la Iteración 0 salvo migración prevista. Probar límites de ámbito y acceso cruzado, idempotencia concurrente, transiciones, conflictos de recursos, GIS dentro/fuera, fotos, agregados privados/públicos y health checks existentes. Añadir pruebas de componentes/flujo para React y Flutter y una demostración E2E con datos ficticios Ayacucho. Logs estructurados con `correlationId`, actor/acción no sensible, error y latencia; nunca cuerpos de reportes sensibles, tokens o contraseñas. No afirmar cumplimiento de carga de 5 000 usuarios ni de disponibilidad en producción.

## Risks / Trade-offs

- **Coberturas DEMO no oficiales** → Mostrar etiqueta DEMO, no usarlas para despacho real y mantener importación de zonas por datos.
- **Fotos en disco local no compartidas entre réplicas** → Limitar esta implementación al piloto de una instancia; mantener `EvidenceStore` para migrar a object storage antes de escalar.
- **Coordenadas y violencia sensibles** → Filtrar en API, suprimir celdas pequeñas, auditar accesos y usar solo datos ficticios en la demo.
- **Bloqueo de recursos bajo concurrencia** → Transacciones y prueba de dos asignaciones simultáneas contra MySQL real.
- **Credenciales externas FCM/correo no disponibles** → Notificación interna y buzón de desarrollo funcionales; la integración externa no bloquea la demostración local.
- **Tiles OSM públicos sin SLA** → URL configurable, atribución y uso moderado; sustituir proveedor antes de producción si aumenta el tráfico.
- **Volumen de alcance** → Implementar por fases con OpenAPI y pruebas por bloque; no declarar el MVP completo hasta pasar el recorrido extremo a extremo.
- **Esquema MySQL 9.7 y DDL no transaccional** → Probar migraciones en base aislada y respaldar antes de aplicarlas a datos persistentes.

## Migration Plan

1. Conservar el servicio MySQL y los health checks de Iteración 0; no recrear el volumen.
2. Crear y probar migraciones ordenadas sobre una base nueva de pruebas; aplicar a la base local solo después de revisar versión y respaldo pertinente.
3. Cargar seeds DEMO mediante comando explícito e idempotente y comprobar que no sobreescribe datos reales.
4. Activar módulos API por dependencias, ampliar OpenAPI y verificar rutas antes de conectar React y Flutter.
5. Ejecutar pruebas automáticas y E2E con usuarios/datos demo; documentar arranque local, limpieza de seeds y limitaciones del piloto.
6. Ante una migración fallida, detener aplicación de cambios, restaurar respaldo o ejecutar migración correctiva probada; no ejecutar `docker compose down -v` ni editar tablas manualmente.
