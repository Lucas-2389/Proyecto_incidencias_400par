# Tasks

## 1. Base de API y contrato

- [ ] 1.1 Verificar que `apps/api` conserva los dos health checks y conexión con `incidencias_app`; comprobar `npm --prefix apps/api test` y consulta real `/api/health/database`.
- [ ] 1.2 Definir comandos locales de prueba con base MySQL aislada y variables de entorno no secretas en ejemplos; comprobar que las pruebas no apuntan a `incidencias` por accidente.
- [ ] 1.3 Añadir infraestructura de migraciones versionadas con registro de versión/checksum; comprobar aplicación repetida sin cambios y error por checksum alterado.
- [ ] 1.4 Montar router `/api/v1` y manejador uniforme de errores con `correlationId`; comprobar respuestas 404 y error validado en prueba HTTP.
- [ ] 1.5 Incorporar validación de entrada, `Cache-Control: no-store` privado y logs estructurados sin secretos; comprobar con pruebas de cuerpo inválido y redacción.
- [ ] 1.6 Definir matriz de permisos API por rol/ámbito y convenciones de rutas en OpenAPI; comprobar que el contrato parsea y enumera los cuatro roles.
- [ ] 1.7 Documentar arranque y pruebas de la nueva API en `apps/api/README.md`; ejecutar los comandos documentados.

## 2. Esquema y datos de demostración

- [ ] 2.1 Crear migraciones de roles, usuarios, membresías y tokens con PK/FK/índices; comprobar esquema en MySQL de pruebas.
- [ ] 2.2 Crear migraciones de jerarquía territorial, instituciones, sedes y coberturas SRID 4326; comprobar FK y consulta espacial dentro/fuera.
- [ ] 2.3 Crear migraciones de personal, unidades, categorías, subcategorías y reglas; comprobar restricciones e índices por sede/estado.
- [ ] 2.4 Crear migraciones de incidentes, ubicaciones, idempotencia y vínculos de duplicados; comprobar clave única de referencia e idempotencia.
- [ ] 2.5 Crear migraciones de asignaciones, historial, evidencias, directorio, alertas, notificaciones y auditoría; comprobar todas las FK e índices.
- [ ] 2.6 Probar aplicación de todas las migraciones en una base vacía y segunda ejecución sin cambios; verificar ausencia de SQL manual fuera de migraciones.
- [ ] 2.7 Crear seed explícito e idempotente de roles, categorías y reglas del piloto; comprobar dos ejecuciones sin duplicados.
- [ ] 2.8 Crear seed DEMO de Ayacucho con territorios, polígonos, PNP, SAMU, Bomberos, Municipalidad, sedes, usuarios, recursos e incidentes ficticios; comprobar etiquetas DEMO y que no se cargue al arranque normal.
- [ ] 2.9 Documentar migración, respaldo, recuperación y ejecución/limpieza segura de seeds; verificar los comandos en base aislada sin borrar volúmenes.

## 3. Identidad y acceso

- [ ] 3.1 Implementar hash seguro y política de contraseña; comprobar prueba que la base no guarda contraseñas en claro.
- [ ] 3.2 Implementar registro ciudadano con aceptación de términos y correo único; comprobar HTTP 201, 400 y 409 en pruebas.
- [ ] 3.3 Implementar login de cuentas activas con error uniforme; comprobar éxito, cuenta inactiva y credenciales erróneas.
- [ ] 3.4 Implementar JWT de acceso corto y refresh opaco rotado/revocable; comprobar expiración, rotación, revocación por versión de credenciales y rechazo de token reutilizado.
- [ ] 3.5 Implementar recuperación con token temporal de un uso y buzón de desarrollo; comprobar vencimiento, no reutilización y respuesta que no revela existencia de correo.
- [ ] 3.6 Implementar middleware de autenticación y permisos por rol, institución, sede y jurisdicción; comprobar 401/403 y acceso cruzado denegado.
- [ ] 3.7 Implementar límites de intentos para login y recuperación; comprobar HTTP 429 tras superar el límite configurado.
- [ ] 3.8 Completar OpenAPI de auth y errores, y probar concordancia de rutas/cuerpos; comprobar validación del contrato.
- [ ] 3.9 Documentar configuración de JWT, recuperación y cuentas demo sin secretos en `apps/api/README.md`; comprobar procedimiento local.

## 4. Territorio, instituciones y usuarios institucionales

- [ ] 4.1 Implementar consulta de departamentos, provincias, distritos y sectores; comprobar jerarquía del seed DEMO en API.
- [ ] 4.2 Implementar resolución de punto WGS84 a territorio con manejo fuera de polígonos; comprobar pruebas GIS dentro, borde y fuera.
- [ ] 4.3 Implementar CRUD de instituciones y tipos PNP/SAMU/Bomberos/Municipalidad; comprobar permisos de SuperAdministrador y rechazo de Ciudadano.
- [ ] 4.4 Implementar CRUD de sedes con ubicación y estado; comprobar que una sede inactiva no aparezca como destino automático.
- [ ] 4.5 Implementar gestión de múltiples zonas de cobertura por sede; comprobar coincidencias de dos zonas y ausencia de cobertura.
- [ ] 4.6 Implementar alta y administración de Operadores y AdministradoresInstitucionales por ámbito; comprobar que no se crean cuentas en otra institución.
- [ ] 4.7 Probar con MySQL real filtros de listas por institución/sede y altas en otro distrito; comprobar que no requiere cambiar código.
- [ ] 4.8 Actualizar OpenAPI para territorio, instituciones, sedes, coberturas y usuarios; comprobar validación del contrato.
- [ ] 4.9 Documentar carga de zonas DEMO y proceso para sustituirlas por datos autorizados; comprobar que README advierte que no son jurisdicciones oficiales.

## 5. Personal y unidades

- [ ] 5.1 Implementar CRUD de personal asociado a institución/sede; comprobar alta, edición y rechazo de ámbito ajeno.
- [ ] 5.2 Implementar CRUD de unidades con código, placa opcional, tipo, sede y capacidad; comprobar unicidad de código y validaciones.
- [ ] 5.3 Implementar estados Disponible, Asignada, En camino, En atención, Retornando, Mantenimiento y Fuera de servicio; comprobar transiciones permitidas y rechazadas.
- [ ] 5.4 Implementar consulta de disponibilidad por sede e institución; comprobar que Mantenimiento/Fuera de servicio no figuran asignables.
- [ ] 5.5 Probar operaciones de recursos sobre MySQL real, incluidos cambios de sede y estados; comprobar integridad FK.
- [ ] 5.6 Completar OpenAPI de personal/unidades y documentar su gestión local; comprobar contrato válido y ejemplos ejecutables.

## 6. Reportes, idempotencia y fotografías

- [ ] 6.1 Implementar consulta y administración autorizada de categorías/subcategorías y prioridad inicial; comprobar catálogo mínimo solicitado y cambios sin recompilar clientes.
- [ ] 6.2 Implementar validación de descripción, fecha, latitud/longitud, precisión y marcador final; comprobar entradas fuera de rango y punto corregido.
- [ ] 6.3 Implementar creación ciudadana con fuente `MOBILE_APP`, referencia y estado Reportado; comprobar persistencia en MySQL real.
- [ ] 6.4 Implementar creación de invitado no verificado y límite de abuso; comprobar referencia preliminar y HTTP 429 por exceso.
- [ ] 6.5 Implementar creación por Operador con fuente `PHONE` y ubicación confirmada o pendiente; comprobar que el cliente no puede falsificar la fuente.
- [ ] 6.6 Implementar idempotencia transaccional por `Idempotency-Key`/`clientRequestId`; comprobar reintento idéntico, contenido distinto y dos solicitudes concurrentes.
- [ ] 6.7 Implementar `EvidenceStore` local fuera de Git y metadatos MySQL; comprobar que no se crean BLOB y que el archivo persiste tras reinicio.
- [ ] 6.8 Implementar subida con límite de tamaño/cantidad/tipo y lectura autorizada; comprobar archivo inválido, acceso ajeno y acceso auditado.
- [ ] 6.9 Implementar `GET /incidents/mine` y detalle autorizado; comprobar que un ciudadano no ve reportes ajenos ni datos internos.
- [ ] 6.10 Completar OpenAPI de reportes/fotos y documentar ubicación del almacén local y limpieza segura; comprobar contrato y ejemplo de subida.

## 7. Derivación, asignaciones y ciclo operativo

- [ ] 7.1 Implementar evaluación determinística de reglas por subtipo e institución; comprobar incendio→Bomberos, médica→SAMU y robo→PNP con seeds.
- [ ] 7.2 Combinar reglas con coberturas activas para sugerir sedes; comprobar caso con varias instituciones y caso sin cobertura en bandeja de excepción.
- [ ] 7.3 Implementar confirmación/corrección manual de derivación con motivo; comprobar rechazo de sede fuera del ámbito y evento auditado.
- [ ] 7.4 Implementar varias asignaciones institucionales para un incidente; comprobar tres instituciones sobre un accidente sin sobrescribir relaciones.
- [ ] 7.5 Implementar asignación de Operador, personal y unidades disponibles; comprobar relaciones persistidas y recursos ocupados.
- [ ] 7.6 Bloquear reservas simultáneas incompatibles de unidad/persona; comprobar carrera con dos transacciones MySQL y solo una ganadora.
- [ ] 7.7 Implementar verificación (verificado, no verificable, falso, duplicado) y prioridad con motivo; comprobar permisos y línea de tiempo.
- [ ] 7.8 Implementar máquina de estados y hitos por asignación; comprobar secuencia válida, salto inválido y cierre con varias instituciones.
- [ ] 7.9 Implementar vínculo de reportes duplicados sin borrar referencias; comprobar consulta de ambos e historial conservado.
- [ ] 7.10 Implementar bandeja institucional y seguimiento ciudadano; comprobar visibilidad por rol/sede y ocultación de datos de personal al ciudadano.
- [ ] 7.11 Probar transacción de estado, historial, recursos y auditoría ante error intermedio; comprobar que no queda cambio parcial.
- [ ] 7.12 Completar OpenAPI de operación y documentar reglas de estados/derivación; comprobar contrato válido y casos de excepción descritos.

## 8. Mapas, mapa de calor y directorio

- [ ] 8.1 Implementar endpoint de puntos de incidentes y sedes del ámbito operativo; comprobar que un usuario ajeno no recibe coordenadas privadas.
- [ ] 8.2 Implementar agregados espaciales por celda/zona e intervalo para mapa público; comprobar que la respuesta no contiene puntos exactos ni datos personales.
- [ ] 8.3 Aplicar umbral mínimo y degradación de categorías sensibles; comprobar supresión de celda con menos de tres eventos y protección de violencia.
- [ ] 8.4 Implementar filtros por tipo, categoría, fecha, hora, distrito e institución con límites de consulta; comprobar conteos y rechazo de intervalo inválido.
- [ ] 8.5 Implementar agregado institucional limitado por rol/ámbito y estadísticas básicas de conteos/tiempos; comprobar que no mezcla otra institución.
- [ ] 8.6 Implementar CRUD autorizado de contactos de emergencia nacionales/locales; comprobar selección por distrito y fallback nacional.
- [ ] 8.7 Probar consultas GIS y agregados con MySQL real y datos DEMO dentro/fuera de cobertura; comprobar conteos esperados.
- [ ] 8.8 Completar OpenAPI de mapas, heatmap, estadísticas y directorio; comprobar validación del contrato.
- [ ] 8.9 Documentar configuración de teselas OSM, atribución, umbral público y límites del piloto; comprobar ejemplos de consultas.

## 9. Alertas, notificaciones y auditoría

- [ ] 9.1 Implementar publicación autorizada de alertas por zona, tipo y vigencia; comprobar que solo alertas vigentes llegan a la consulta pública.
- [ ] 9.2 Implementar notificaciones internas de estado y asignación con leído/no leído; comprobar destinatario correcto y ausencia de entrega a terceros.
- [ ] 9.3 Implementar adaptador push opcional y modo sin credenciales; comprobar con proveedor simulado la entrega cuando se configura y que la operación y notificación interna funcionan sin FCM.
- [ ] 9.4 Implementar registro central de auditoría para cambios administrativos, operativos y accesos a fotos; comprobar actor, acción, entidad, hora y sin secretos.
- [ ] 9.5 Implementar consulta de auditoría filtrada por ámbito; comprobar rechazo de acceso cruzado y persistencia tras cierre.
- [ ] 9.6 Completar OpenAPI de alertas, notificaciones y auditoría; comprobar contrato válido.
- [ ] 9.7 Documentar configuración opcional de FCM y buzón de desarrollo sin credenciales reales; comprobar arranque sin servicios externos.

## 10. Panel React institucional

- [ ] 10.1 Crear proyecto React en `apps/admin` con URL API configurable por entorno; comprobar build de desarrollo sin `localhost` fijado en fuentes.
- [ ] 10.2 Implementar Login y sesión cliente con renovación de token y cierre; comprobar prueba de login válido/expirado.
- [ ] 10.3 Implementar navegación por rol y pantallas Dashboard, Incidentes y Detalle; comprobar que un Operador ve solo acciones permitidas.
- [ ] 10.4 Implementar bandeja, filtros, registro por llamada y detalle con estados/historial; comprobar flujo UI con API de prueba.
- [ ] 10.5 Implementar vista de derivación sugerida y corrección, asignación de institución/Operador/personal/unidad; comprobar flujo UI de accidente multiinstitución.
- [ ] 10.6 Implementar pantallas Institución/Sede, Unidades y Personal con formularios y errores de validación; comprobar operaciones de AdministradorInstitucional.
- [ ] 10.7 Implementar Mapa OSM con atribución y puntos autorizados, más vista de mapa de calor; comprobar que no solicita datos ajenos al ámbito.
- [ ] 10.8 Implementar Directorio, Historial y estadísticas básicas; comprobar consultas y filtros desde interfaz.
- [ ] 10.9 Añadir pruebas de componentes/rutas y un flujo institucional automatizado de login→bandeja→asignación→estado; ejecutar suite y build.
- [ ] 10.10 Documentar instalación, variables, arranque y cuentas DEMO del panel; ejecutar comandos documentados.

## 11. Aplicación Flutter ciudadana

- [ ] 11.1 Crear proyecto Flutter Android en `apps/mobile` con URL API y URL de teselas configurables; comprobar `flutter analyze` y ausencia de `localhost` fijo.
- [ ] 11.2 Implementar navegación Inicio, Reportar, Mapa, Mis reportes, Alertas, Directorio y Perfil; comprobar prueba de navegación.
- [ ] 11.3 Implementar registro, login, cierre y acceso de invitado; comprobar estados de sesión y que invitado no ve reportes ajenos.
- [ ] 11.4 Implementar selector de categorías y formulario breve con validación; comprobar campos requeridos y errores visibles.
- [ ] 11.5 Implementar permiso GPS, precisión/hora y ubicación manual cuando no hay permiso; comprobar ambos caminos en pruebas.
- [ ] 11.6 Implementar mapa OSM con atribución y marcador movible; comprobar que se envían las coordenadas finales corregidas.
- [ ] 11.7 Implementar selección de foto opcional y subida posterior al reporte; comprobar éxito y fallo de foto sin perder referencia.
- [ ] 11.8 Implementar envío con `clientRequestId` estable y pantalla de referencia; comprobar que reintento devuelve el mismo incidente.
- [ ] 11.9 Implementar almacenamiento local de pendientes y reintento tras reconexión; comprobar corte/restablecimiento sin duplicados y limpieza tras confirmar.
- [ ] 11.10 Implementar Mis reportes/seguimiento y notificaciones internas; comprobar que muestra cambios de estado propios.
- [ ] 11.11 Implementar Alertas, Directorio, botón de llamada y mapa de calor público; comprobar visualización sin puntos sensibles exactos.
- [ ] 11.12 Ejecutar pruebas Flutter de flujo de reporte y `flutter analyze`; documentar instalación Android, permisos y configuración en `apps/mobile/README.md` y verificar comandos.

## 12. Integración del piloto

- [ ] 12.1 Ejecutar todas las pruebas API, React y Flutter, incluidas las existentes de health checks; guardar resultados observables sin declarar éxitos no ejecutados.
- [ ] 12.2 Ejecutar migraciones y seed DEMO sobre MySQL real aislado; verificar estado de base, cuenta de aplicación no root y ausencia de cambios manuales.
- [ ] 12.3 Ejecutar recorrido E2E Android→API→MySQL→panel→Android con GPS, foto, clasificación, asignación, estados, mapa, heatmap, directorio y auditoría; registrar referencias y resultados.
- [ ] 12.4 Comprobar errores de MySQL caído, credenciales inválidas, acceso cruzado, pérdida de red y foto inválida sin filtrar secretos; guardar resultados de prueba.
- [ ] 12.5 Revisar OpenAPI frente a rutas reales, ejecutar `openspec validate operational-mvp --strict` y `git status`; registrar pendientes antes de declarar terminado el MVP.
