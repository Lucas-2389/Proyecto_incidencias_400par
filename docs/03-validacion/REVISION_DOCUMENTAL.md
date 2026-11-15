# Revisión y organización documental

Fecha: 20 de octubre de 2026. Alcance: documentación del repositorio para revisión académica.

## 1. Resultado de la organización

| Antes | Ahora | Tratamiento |
| --- | --- | --- |
| SDD v0.1 en la raíz con 23 secciones, requisitos y tareas mezclados | `01-entrega/SRS.md`, `SDD.md` y `PLAN_Y_VERIFICACION.md` | Separación de requisitos, diseño y gestión del trabajo; original conservado en historial. |
| Notas CITIZEN_EMERGENCY_FLOW, GUEST_EVIDENCE y MOBILE_INTERFACE | `04-historial/EVOLUCION_MOVIL.md` | Tres archivos retirados como documentos independientes y consolidados sin borrar sus resultados históricos. Diseño vigente sintetizado en SDD. |
| Guías e informes al mismo nivel | Carpetas numeradas de entrega, guías, validación e historial | Reubicación por propósito y actualización de enlaces. |
| README extenso que repetía instalación y detalles de API | Entrada breve con ruta de lectura | Los procedimientos específicos permanecen en sus guías; se evita mantener varias instrucciones de arranque. |
| Sugerencias de commits para trabajo ya publicado | Flujo de revisión enlazado a CONTRIBUTING | Retirada de comandos obsoletos en la guía Render. |

No se eliminan migraciones, especificaciones OpenSpec, tareas, informes de ejecución ni código funcional. El original histórico permite consultar las tablas, decisiones y planificación anteriores. Los registros históricos se identifican para que no se confundan con instrucciones vigentes.

## 2. Fuentes revisadas

- SDD original y decisiones posteriores sobre reporte sin login y fotografía de invitado.
- Migraciones 001–011 y ejecutor de migraciones: nombres de tablas, relaciones, estados y metadatos.
- Configuración y pool MySQL con CA/TLS, hash de contraseñas y adaptadores de evidencia.
- Navegación Flutter, módulos del backend y componentes del panel.
- Contrato OpenAPI, guías operativas e informes fechados.
- Estado Git previo: sin cambios de trabajo; existía un commit local de caché pendiente de subir.

## 3. Controles de esta revisión

- Comprobación de enlaces Markdown locales y equilibrio de bloques de código.
- Conservación sin duplicados de RF-01–RF-45, RNF-01–RNF-20 y RN-01–RN-18 en el SRS.
- Contraste del inventario del SDD con las migraciones versionadas; los diagramas son vistas resumidas, no sustituyen el SQL.
- Revisión del diff para restringir los cambios a documentación.
- Validación del contrato existente y `git diff --check`.

No se vuelven a ejecutar suites de aplicación por una reorganización exclusivamente documental. No se hacen consultas remotas, migraciones, seeds ni cambios de infraestructura. No se certifica una nueva ejecución de la app o del panel público.

## 4. Límites y pendientes que se conservan

Los objetivos de concurrencia y alta disponibilidad siguen sin verificarse en esta revisión. El escalamiento horizontal no se inicia. Las tareas abiertas de OpenSpec mantienen sus casillas y su historial; los criterios antiguos basados en login/historial ciudadano deben reconciliarse explícitamente antes del cierre del change correspondiente.

La separación SRS/SDD es una formalización retrospectiva de un proyecto existente. No se inventa una aprobación del docente ni se presenta todo el catálogo de requisitos como funcionalidad entregada. Los informes de pruebas anteriores conservan su fecha, versión, omisiones y limitaciones.

## 5. Paquete de revisión del docente

Comenzar por el [índice](../README.md) y entregar los tres documentos de `01-entrega` en el orden SRS → SDD → Plan y verificación. Las guías y evidencias son anexos de consulta; el historial y los changes OpenSpec no forman parte del índice interno del SDD.

El repositorio no debe incluir secretos, certificados ni archivos `.env` como parte de una entrega. Esta reorganización no lee ni modifica la configuración privada.

## 6. Resultado ejecutado

- Enlaces locales Markdown: 114 comprobados tras el ajuste final de guías, sin destinos ausentes.
- Identificadores SRS: 45 RF, 20 RNF y 18 RN, sin omisiones ni duplicados.
- Bloques de código Markdown: delimitadores equilibrados.
- `npm --prefix apps/api run contract:check`: OpenAPI válido, 58 rutas y 4 roles.
- `git diff --check`: sin errores.
- Cambios restringidos a archivos Markdown; no se modifican código, SQL ni artefactos OpenSpec.
- Sin commit, push, despliegue o escalamiento en esta revisión.
