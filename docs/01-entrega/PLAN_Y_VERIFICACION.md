# Plan de trabajo, trazabilidad y verificación

Fecha de organización: 20 de octubre de 2026. Documento separado del SDD.

## 1. Orden del trabajo y responsabilidad documental

| Momento | Documento | Contenido |
| --- | --- | --- |
| Especificar | [SRS](SRS.md) | Necesidades, alcance, actores, reglas y criterios de aceptación. |
| Diseñar | [SDD](SDD.md) | Arquitectura, datos, componentes, interfaces y decisiones técnicas. |
| Planificar e implementar | [OpenSpec changes](../../openspec/changes/) | Propuesta, specs de comportamiento, diseño del cambio y tareas verificables. |
| Verificar | [Informes de validación](../03-validacion/) | Comandos realmente ejecutados, resultados, omisiones y limitaciones. |

La separación se formaliza sobre un proyecto ya implementado; no se reescribe su cronología ni se inventa aprobación previa. SDD significa aquí Software Design Description; OpenSpec es el mecanismo de trabajo con especificaciones. El diseño se actualiza cuando un cambio aprobado altera la arquitectura.

## 2. Trazabilidad resumida

| Necesidad SRS | Diseño | Evidencia y trabajo |
| --- | --- | --- |
| RF-02, RF-06 a RF-10 | SDD 4.3, 4.4 y 5.1 | Specs de incident-reporting/citizen-mobile y pruebas de app/API. |
| RF-03, RF-17, RF-24, RF-42 | SDD 4.1 y 6 | Specs identity-access/institutional-console/incident-evidence; pruebas de ámbito. |
| RF-13 a RF-16, RF-23 | SDD 3 y 4.1 | Specs territorial-coverage/incident-dispatch. |
| RF-20, RF-25 a RF-30 | SDD 3.3 y 4.1 | Specs operational-resources/incident-lifecycle y pruebas de despacho. |
| RF-32 a RF-38 | SDD 4.4 y 5 | Specs geospatial-views/emergency-directory/alerts-notifications. |
| RF-40, RNF-09 | SDD 4.1 y 6 | Spec audit-trail y pruebas de auditoría. |
| RNF-05, RNF-20 | SDD 6 y 7 | [Informe Aiven](../03-validacion/MIGRACIONES_AIVEN.md), pruebas TLS/Cloudinary. |
| RNF-01, RNF-02, RNF-04 | SDD 7.3 | Objetivos futuros; escalamiento y prueba de carga pendientes de autorización y ejecución. |

Las specs citadas pertenecen a [operational-mvp](../../openspec/changes/operational-mvp/). El change [prepare-v1-deployment](../../openspec/changes/prepare-v1-deployment/) conserva su alcance y pendientes propios; no se archiva ni marca por esta reorganización. [Iteración 0](../../openspec/changes/archive/2026-10-05-close-iteration-0/) es el antecedente archivado de infraestructura base.

## 3. Plan incremental y estado

| Etapa | Tratamiento en la entrega |
| --- | --- |
| Iteración 0: entorno y conexión | Change archivado; conservar prueba y trazabilidad original. |
| MVP: acceso institucional, recursos, incidentes, mapas y app | Implementación y pruebas registradas; revisar tareas aún abiertas antes de declarar cierre completo. |
| Piloto publicado: API/panel, TLS y fotos externas | Diseño documentado con Render, Aiven y Cloudinary; evidencia fechada, no nueva comprobación remota. |
| Simplificación ciudadana | Sin login móvil, foto opcional y contactos; conservar registro histórico de validación. |
| Colaboración | Guía de clonación, configuración privada y revisión por pull request. |
| Escalamiento horizontal | No iniciado; se preparará cuando el responsable lo indique. |

Las tareas operativas viven exclusivamente en los `tasks.md` de cada change; no se duplican aquí como listas de casillas que puedan divergir. Solo marcar una tarea después de comprobarla. Los recorridos antiguos que dependían de login/historial ciudadano necesitan revisar su criterio mediante el flujo OpenSpec antes de cerrarse; no se consideran resueltos por quitar esas pantallas.

## 4. Comprobaciones reproducibles

Desde la raíz, sin utilizar secretos ni fixtures contra la base operativa:

```powershell
npm --prefix apps/admin run build
npm --prefix apps/api test
npm --prefix apps/admin test
npm --prefix apps/api run contract:check
git diff --check
```

Para Android y pruebas con base aislada, consultar las guías de cada aplicación y [colaboración](../02-guias/COLABORACION.md). Las pruebas remotas son explícitas y pueden escribir datos; no ejecutarlas en producción por defecto. Una suite con integraciones omitidas no certifica acceso real a MySQL ni un recorrido visual Android→panel.

## 5. Evidencias y límites

- [Piloto](../03-validacion/PILOTO.md): recorridos y limitaciones de las fechas indicadas, incluida la tarea visual aún pendiente en ese informe.
- [Migraciones Aiven](../03-validacion/MIGRACIONES_AIVEN.md): compatibilidad e inspección del esquema en la ejecución registrada.
- [Evolución móvil](../04-historial/EVOLUCION_MOVIL.md): resultados por versión, con limitaciones de cámara/GPS expresas.
- [Reorganización documental](../03-validacion/REVISION_DOCUMENTAL.md): alcance, documentos consolidados y controles de esta entrega.

No se atribuyen al 20 de octubre resultados de suites antiguas. Esta revisión de documentación no modifica código, permisos, cuentas, datos, tareas OpenSpec ni infraestructura.

## 6. Revisión de interacción posterior al merge — 19 de noviembre de 2026

Esta revisión posterior sí incluye código. El punto de integración es `23f5c68`; el respaldo `backup-local-before-teammate-update-2026-11-19` se conserva y no se aplica en bloque. La recuperación se limita a interacción compatible: recursos administrativos, formularios, confirmaciones, punto de sede en mapa, selección opcional de recursos y referencias regionales. Se conservan Perfil, Seguridad, triage, operadores y usuarios de sede de la actualización colaborativa.

| Criterio | Comprobación |
| --- | --- |
| Tipos con datos y filtro sin salto | Test de consulta pendiente y navegador real: lista base de tipos autorizados, misma instancia Leaflet y desplazamiento de 0 píxeles al filtrar Inundación. |
| Sedes visibles y etiquetas discretas | Navegador: 19 sedes registradas activadas por cuatro entidades, alternancia por entidad y tooltip distrital de 10 píxeles. Todos esos puntos son simulación. |
| Recursos y confirmación | Pruebas de edición en formulario, cancelación de baja, confirmación de baja y prevención de alta duplicada. La selección excluye ocupados y conserva operador. |
| Permisos y funciones nuevas | Tests de rutas privadas y perfiles; navegador verifica Perfil, elección de punto de sede y cancelación del cierre de sesión. |
| Disponibilidad real | Consulta autenticada local de personal: 7 registros, 3 disponibles y 3 activos ocupados; la disponibilidad se calcula sin escrituras nuevas. |

La suite del backend mantiene 30 integraciones omitidas cuando no se habilita la base aislada. Los recorridos del navegador y las consultas locales aquí descritos son evidencia adicional, no sustituyen esa suite ni certifican operación real de emergencias. Esta revisión no cambia Flutter, los datos de producción ni el despliegue.

Resultado final ejecutado: panel 67/67 pruebas aprobadas; backend 61 aprobadas, 0 fallidas y 30 omitidas; build de React correcto, OpenAPI válido (66 rutas) y `git diff --check` sin errores. No se realizó commit ni publicación de esta revisión.
