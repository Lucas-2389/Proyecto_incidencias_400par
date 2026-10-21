# Especificación de requisitos de software (SRS)

## Plataforma de gestión de incidencias

Universidad Nacional de San Cristóbal de Huamanga · Ingeniería de Sistemas · Arquitectura de Software
Versión documental: 1.0 · Fecha de organización: 20 de octubre de 2026
Estado: preparado para revisión académica; no representa aprobación del docente.

## 1. Propósito y alcance

Definir qué necesita el sistema y sus límites. El piloto académico de Ayacucho recibe reportes preliminares ciudadanos y permite su gestión por Municipalidad/Serenazgo, PNP, Bomberos y SAMU. No sustituye llamadas de emergencia, denuncias formales ni sistemas oficiales de despacho. Los datos y coberturas DEMO no autorizan operación real.

El ciudadano reporta sin cuenta, aporta ubicación, descripción y foto opcional; puede consultar información pública, alertas y contactos. El personal institucional se autentica para gestionar incidentes dentro de su ámbito. No se exige registro ciudadano ni se ofrece historial privado en la navegación móvil vigente. Conservar una referencia de recepción no concede acceso a datos privados.

Quedan fuera de esta entrega la integración formal con instituciones, navegación propia giro a giro, GPS continuo de vehículos, video/audio, IA predictiva, publicación en tiendas y escalamiento horizontal implementado o validado. La preparación del repositorio no constituye prueba de carga.

## 2. Actores

| Actor | Necesidad |
| --- | --- |
| Ciudadano invitado | Reportar con pocos pasos, consultar contactos y alertas sin login. |
| Operador | Revisar reportes autorizados, verificar, asignar y actualizar atención. |
| Administrador institucional | Gestionar usuarios y recursos dentro de su institución/sede. |
| Superadministrador | Administrar instituciones, configuración y acceso global autorizado. |
| Responsable técnico | Operar configuración, respaldos, registros y publicación. |

## 3. Requisitos funcionales

| **ID** | **Requisito**                     | **Descripción**                                                                                                               |
|--------|-----------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| RF-01 | Registro de ciudadano | Capacidad previa conservada en la API; fuera de la navegación y del alcance ciudadano vigente. |
| RF-02  | Reporte como invitado             | Permitir reportar sin cuenta; el reporte debe quedar marcado como no verificado y no constituir denuncia formal.              |
| RF-03 | Inicio de sesión institucional | Exigir autenticación para el panel de operadores y administradores. La app ciudadana actual no requiere ni ofrece login. |
| RF-04  | Recuperación de acceso            | Permitir recuperación segura de credenciales.                                                                                 |
| RF-05  | Selección de incidencia           | Mostrar categorías y subcategorías configurables: desastres, emergencias médicas, incendios, tránsito, seguridad y violencia. |
| RF-06  | Captura GPS                       | Solicitar permiso y capturar latitud, longitud, precisión y hora.                                                             |
| RF-07  | Corrección en mapa                | Permitir mover el marcador cuando la ubicación automática no corresponda al lugar real del incidente.                         |
| RF-08  | Foto de evidencia                 | Permitir adjuntar una o más fotografías con límites configurables.                                                            |
| RF-09  | Descripción breve                 | Permitir ingresar descripción y número estimado de afectados cuando aplique.                                                  |
| RF-10  | Persistencia offline              | Guardar localmente un reporte si no hay Internet y enviarlo posteriormente sin duplicarlo.                                    |
| RF-11  | Registro telefónico               | Permitir al operador crear manualmente un incidente recibido mediante llamada.                                                |
| RF-12  | Enlace de ubicación               | Generar un enlace temporal para que una persona que llamó pueda compartir su ubicación desde el navegador.                    |
| RF-13  | Identificación territorial        | Determinar departamento, provincia, distrito y zona a partir del punto geográfico.                                            |
| RF-14  | Clasificación por reglas          | Relacionar categoría/subcategoría con una o varias instituciones responsables.                                                |
| RF-15  | Derivación jurisdiccional         | Seleccionar las sedes con cobertura sobre el punto de la incidencia.                                                          |
| RF-16  | Asignación múltiple               | Permitir que una incidencia sea atendida por más de una institución.                                                          |
| RF-17  | Bandeja institucional             | Mostrar a cada operador únicamente incidencias permitidas por institución, sede, jurisdicción y rol.                          |
| RF-18  | Verificación                      | Permitir marcar la incidencia como verificada, no verificable, falsa o duplicada.                                             |
| RF-19  | Prioridad                         | Permitir asignar o corregir prioridad de atención según reglas operativas.                                                    |
| RF-20  | Estados de incidencia             | Gestionar Reportado, En verificación, Asignado, Unidad en camino, En atención, Resuelto y Cerrado.                            |
| RF-21  | Gestión institucional             | Registrar institución, tipo, datos de contacto y estado.                                                                      |
| RF-22  | Gestión de sedes                  | Registrar múltiples sedes por institución.                                                                                    |
| RF-23  | Zonas de cobertura                | Asignar uno o varios polígonos de cobertura a cada sede.                                                                      |
| RF-24  | Usuarios institucionales          | Crear cuentas individuales para administradores y operadores.                                                                 |
| RF-25  | Unidades/vehículos                | Registrar código, placa, tipo, capacidad/descripción, sede y estado.                                                          |
| RF-26  | Estados de unidad                 | Gestionar Disponible, Asignada, En camino, En atención, Retornando, Mantenimiento y Fuera de servicio.                        |
| RF-27  | Personal                          | Registrar personal operativo y su institución/sede.                                                                           |
| RF-28  | Asignar unidad                    | Asignar una o varias unidades disponibles a una incidencia.                                                                   |
| RF-29  | Asignar personal                  | Asociar personal a una atención.                                                                                              |
| RF-30 | Historial operativo | Mantener la línea de tiempo institucional de cambios y responsables; no ofrecer historial privado al ciudadano en la app vigente. |
| RF-31  | Duplicados                        | Permitir vincular/fusionar reportes que describan un mismo evento.                                                            |
| RF-32  | Mapa institucional                | Visualizar incidencias autorizadas y ubicación exacta según permisos.                                                         |
| RF-33  | Mapa de calor público             | Mostrar concentración agregada de incidencias sin puntos sensibles exactos.                                                   |
| RF-34  | Filtros de mapa de calor          | Filtrar por tipo, fecha, franja horaria, distrito e institución.                                                              |
| RF-35  | Protección de casos sensibles     | Ocultar o degradar precisión espacial de violencia familiar, sexual u otras categorías sensibles en vistas públicas.          |
| RF-36  | Directorio de emergencia          | Mostrar números nacionales y números locales vinculados a territorio e institución.                                           |
| RF-37  | Llamada directa                   | Permitir iniciar llamada desde la app cuando el dispositivo lo soporte.                                                       |
| RF-38  | Alertas ciudadanas                | Publicar alertas por zona, tipo y periodo de vigencia.                                                                        |
| RF-39 | Notificaciones | Mantener avisos institucionales y alertas públicas. Push y avisos privados de cuentas autenticadas son capacidades condicionadas a configuración, no requisito de login ciudadano. |
| RF-40  | Auditoría                         | Registrar acciones administrativas y operativas críticas.                                                                     |
| RF-41  | Administración de catálogos       | Gestionar tipos, subtipos, prioridades, estados y reglas de derivación.                                                       |
| RF-42  | Gestión de evidencias             | Consultar fotos únicamente con permisos autorizados y registrar accesos relevantes.                                           |
| RF-43  | Estadísticas operativas           | Mostrar conteos, tiempos de respuesta y distribución básica por tipo/zona.                                                    |
| RF-44  | Exportación controlada            | Permitir exportar datos agregados o autorizados para análisis posterior, por ejemplo Power BI.                                |
| RF-45  | Administración nacional escalable | Permitir incorporar nuevos departamentos, provincias, distritos, instituciones y sedes sin modificar el código fuente.        |

### 3.1 Lectura del alcance

Se conservan RF-01 a RF-45 para no romper la trazabilidad original. El catálogo expresa necesidades, no certifica que todas estén implementadas. RF-01 y el acceso ciudadano autenticado son antecedentes fuera de la interfaz actual; RF-12, exportación y otras capacidades deben verificarse contra OpenSpec y el contrato antes de declararlas entregadas. La evidencia fechada se consulta en [validación](../03-validacion/PILOTO.md).

## 4. Requisitos no funcionales

| **ID** | **Atributo**              | **Criterio**                                                                                                                                                                                                 |
|--------|---------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| RNF-01 | Escalabilidad             | El backend deberá poder ejecutarse en múltiples instancias sin sesiones almacenadas localmente.                                                                                                              |
| RNF-02 | Concurrencia académica    | La arquitectura y las pruebas deberán contemplar escenarios progresivos de 100, 500, 1 000 y hasta aproximadamente 5 000 usuarios virtuales concurrentes, ajustando el escenario a los recursos disponibles. |
| RNF-03 | Rendimiento               | En carga normal, los endpoints transaccionales críticos deberán apuntar a p95 \< 2 s; el envío de una incidencia deberá confirmar persistencia sin esperar procesos secundarios.                             |
| RNF-04 | Disponibilidad            | La caída de una instancia del backend no debe interrumpir el servicio cuando existan réplicas activas y un balanceador.                                                                                      |
| RNF-05 | Seguridad de transporte   | Todo tráfico público deberá usar HTTPS/TLS.                                                                                                                                                                  |
| RNF-06 | Autorización              | Aplicar RBAC y filtros por institución/sede/jurisdicción.                                                                                                                                                    |
| RNF-07 | Contraseñas               | Almacenar hashes seguros (Argon2id o bcrypt), nunca contraseñas en texto plano.                                                                                                                              |
| RNF-08 | Privacidad                | Minimizar datos personales y limitar acceso a ubicaciones/evidencias sensibles.                                                                                                                              |
| RNF-09 | Auditoría                 | Las acciones críticas deben incluir actor, timestamp, entidad afectada, acción y cambios principales.                                                                                                        |
| RNF-10 | Tolerancia a conectividad | La app debe poder conservar reportes pendientes cuando pierda conexión.                                                                                                                                      |
| RNF-11 | Idempotencia              | Los reintentos de sincronización no deben crear reportes duplicados.                                                                                                                                         |
| RNF-12 | Integridad geográfica     | Los puntos y zonas deberán usar un SRID coherente y validarse antes de persistir.                                                                                                                            |
| RNF-13 | Mantenibilidad            | Backend organizado por módulos con límites claros y dependencias controladas.                                                                                                                                |
| RNF-14 | Observabilidad            | Incluir logs estructurados, identificador de solicitud y métricas mínimas de error/latencia.                                                                                                                 |
| RNF-15 | Respaldo                  | Definir respaldos automáticos de MySQL en producción y procedimiento de restauración probado.                                                                                                                |
| RNF-16 | Caché segura              | No cachear respuestas privadas o autenticadas en Cloudflare; priorizar recursos estáticos y datos públicos controlados.                                                                                      |
| RNF-17 | Accesibilidad/usabilidad  | El flujo de reporte debe ser corto, con botones visibles y lenguaje simple.                                                                                                                                  |
| RNF-18 | Compatibilidad            | Primera entrega Android; el diseño Flutter no debe bloquear futura compilación iOS.                                                                                                                          |
| RNF-19 | Portabilidad              | Los servicios de backend deberán poder ejecutarse mediante contenedores Docker en desarrollo/pruebas.                                                                                                        |
| RNF-20 | Separación de evidencias  | Las fotos no deberán almacenarse como BLOB masivos en MySQL; se guardará URL/clave y metadatos.                                                                                                              |

### 4.1 Objetivos pendientes de medición

RNF-01, RNF-02 y RNF-04 describen objetivos de evolución. No se ha iniciado en esta reorganización el escalamiento ni una prueba de 1 000–5 000 usuarios. Los valores p95, restauración de respaldos y disponibilidad no deben presentarse como resultados medidos sin evidencia. Las pruebas aprobadas de una versión anterior no validan automáticamente una entrega posterior.

## 5. Reglas de negocio

| **Regla** | **Descripción**                                                                                                                     |
|-----------|-------------------------------------------------------------------------------------------------------------------------------------|
| RN-01     | Un reporte ciudadano representa una incidencia informativa/operativa; no equivale a una denuncia formal ante una autoridad.         |
| RN-02     | Un reporte sin cuenta se marca como invitado/no verificado y puede requerir validación adicional.                                   |
| RN-03     | La ubicación final del incidente puede diferir de la posición física del usuario; por eso el marcador puede corregirse.             |
| RN-04     | Una incidencia puede generar N asignaciones institucionales.                                                                        |
| RN-05     | Una sede solo recibe automáticamente incidencias si su tipo de institución y zona de cobertura coinciden con las reglas aplicables. |
| RN-06     | Si no existe cobertura configurada, el reporte se deriva a una bandeja de excepción/administración regional.                        |
| RN-07     | Solo usuarios autorizados pueden marcar un reporte como falso, duplicado o cerrado.                                                 |
| RN-08     | Una unidad en Mantenimiento/Fuera de servicio no puede asignarse.                                                                   |
| RN-09     | El mismo recurso no puede quedar asignado simultáneamente a dos atenciones incompatibles.                                           |
| RN-10     | Los casos sensibles nunca se muestran con coordenada exacta en el mapa público.                                                     |
| RN-11     | El mapa de calor público usa agregación espacial/temporal y un umbral mínimo de eventos por celda/zona antes de mostrar detalle.    |
| RN-12     | Los datos de personas y fotos solo se muestran a roles con necesidad operativa.                                                     |
| RN-13     | El cierre de una incidencia no elimina su auditoría.                                                                                |
| RN-14 | El directorio nacional/local se administra desde la API; Android incluye contactos nacionales de respaldo para funcionar cuando la consulta remota falla. |
| RN-15     | Las reglas de derivación deben poder modificarse sin recompilar la app móvil.                                                       |
| RN-16     | Un reporte sincronizado offline debe conservar el identificador generado por el cliente para prevenir duplicación.                  |
| RN-17     | Los tiempos de respuesta se calculan desde el registro hasta hitos configurables (asignación, salida, llegada, resolución).         |
| RN-18     | Las alertas públicas requieren autor institucional, vigencia y zona.                                                                |

## 6. Criterios de aceptación del flujo vigente

1. Un ciudadano puede abrir Reportar, completar datos y enviar sin sesión; recibe una referencia de recepción, sin promesa de atención real.
2. La fotografía es opcional; un fallo de subida conserva el reporte confirmado y permite gestionar el pendiente.
3. El panel exige sesión y la API rechaza el acceso privado sin credenciales o fuera de ámbito.
4. La información pública no expone fotos, identidad del reportante ni ubicación individual sensible.
5. Los reintentos con la misma clave no generan incidentes duplicados.
6. Un cierre conserva los eventos de auditoría; el ciudadano no dispone de historial privado móvil.
7. Credenciales, certificados y archivos privados no forman parte de la entrega pública.

## 7. Trazabilidad y documentos relacionados

Este SRS recoge y separa los requisitos del [documento original](../04-historial/SDD_ORIGINAL_v0.1.md), con las decisiones ciudadanas posteriores identificadas. No se afirma que el SRS existiera antes de la implementación: se formaliza retrospectivamente para ordenar la entrega. El [SDD](SDD.md) explica cómo se resuelven técnicamente estas necesidades; el [plan y verificación](PLAN_Y_VERIFICACION.md) relaciona tareas, comprobaciones y pendientes. Las specs OpenSpec detallan comportamiento verificable por change.
