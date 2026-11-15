# Design

## Context

La motivación se encuentra en `proposal.md`. La API Express usa MySQL, migraciones con checksum y separación `-- statement`. Hay once migraciones aplicables. `incidents` ya contiene `affected_people` y `subcategory_id`. `validateReport` construye el contenido usado tanto para persistencia como para el hash idempotente.

`seed-reference.js` define 16 categorías y reglas por tipo institucional, pero carece de subcategorías iniciales. El catálogo expone listas públicas y conserva las familias `emergency` y `security`. `seed-demo.js` crea cuatro sedes en un distrito ficticio, usa un mapa por tipo institucional y crea cuentas `@demo.invalid`.

`assignmentInput` ya normaliza arreglos omitidos a `[]`. OpenAPI requiere únicamente `institutionId` y `siteId`. `dispatch-assignment.test.js` ya crea asignaciones omitiendo ambos arreglos y prueba conflictos concurrentes. Esto permite concentrar esa parte del cambio en completar contrato y casos específicos.

Solo existen specs principales para entorno local y conectividad. Los deltas de `operational-mvp` describen el resto del comportamiento implementado y todavía están pendientes de sincronización. Se conservan sus nombres de capacidad y se añaden requisitos con nombres propios para permitir la posterior integración.

## Goals / Non-Goals

El diseño abarca datos, API y contrato, y permite implementar cada parte sobre una base existente. Las observaciones clínicas se incorporan al reporte general y las especialidades se resuelven mediante las relaciones de derivación existentes.

La interfaz de captura clínica en Flutter y React, la verificación cartográfica oficial y la provisión de cuentas institucionales reales corresponden a trabajo posterior. El permiso global de SuperAdministrador conserva su significado actual.

## Decisions

### 1. Tres columnas clínicas anulables

Crear `apps/api/migrations/012_medical_triage.sql` con una única sentencia `ALTER TABLE incidents`, incorporando `is_conscious`, `is_breathing` y `has_bleeding` como `BOOLEAN NULL DEFAULT NULL`, con restricciones que admitan solo 0, 1 o NULL. Una única operación DDL evita que un fallo entre varias sentencias deje una ampliación parcial dentro del archivo. Se conservan los checksums de las migraciones anteriores.

El ejecutor registra la migración en `schema_migrations` después de ejecutar su SQL. Una interrupción entre el DDL y ese registro puede dejar las columnas creadas y la migración pendiente. La migración 012 comprobará en los metadatos las tres columnas y sus restricciones antes de ejecutar el `ALTER TABLE`. Si faltan todas, ejecutará la ampliación. Si todas existen con las definiciones esperadas, omitirá el DDL y permitirá que el ejecutor registre el checksum. Una combinación parcial o incompatible producirá un error explícito para revisar el esquema antes de repetir. La recuperación conservará los datos clínicos existentes.

La prueba de recuperación provocará un fallo después del DDL y antes de insertar la fila de `schema_migrations`, repetirá la ejecución y verificará un único registro con el checksum correcto, las definiciones esperadas y la conservación de los reportes. También cubrirá un esquema incompatible para comprobar que la migración permanece pendiente.

Publicar los campos JSON planos `isConscious`, `isBreathing` y `hasBleeding`. Omitirlos o enviarlos como `null` representa desconocimiento, y `false` conserva su valor. La validación acepta exclusivamente booleanos o `null`. El detalle convierte explícitamente 0/1 a booleanos y preserva NULL.

Los tres campos se aceptan en los puntos de entrada ya compartidos por `createReport`, incluidos invitado, ciudadano y llamada. Su uso también sirve para incidentes de tránsito o incendios con afectados. Se conserva la autorización actual del detalle y la clasificación de prioridad existente.

Supuesto de esta propuesta — las observaciones describen a la persona principal indicada en el reporte. `affectedPeople` conserva la cantidad total de afectados. En un reporte de varias personas, la descripción aclara a quién corresponden las observaciones. Una ficha clínica individual por persona requeriría un modelo adicional y otra definición de alcance.

### 2. Compatibilidad del hash idempotente

Agregar los nuevos campos al contenido canónico solamente cuando contengan un booleano. Para solicitudes con los tres campos desconocidos, conservar exactamente el contenido y orden de propiedades que usa hoy el hash. Así se reconocen también claves ya almacenadas antes de la migración. Los campos conocidos se agregan en orden fijo. Omitido y `null` son equivalentes.

Verificar específicamente un hash generado con el formato anterior, reintentos equivalentes, cambios de `false` a `true` y cambios de desconocido a conocido. Los cambios de contenido con igual clave siguen devolviendo 409.

### 3. Catálogo compartido con reglas por especialidad

El usuario confirmó que una categoría puede corresponder a varias especialidades. Reutilizar `incident_categories`, `incident_subcategories` y `routing_rules`. Las familias continúan siendo `emergency` y `security`, y los tipos institucionales siguen siendo `pnp`, `samu`, `bomberos`, `municipalidad` y `otra`.

Conservar los 16 códigos de categoría existentes y sus IDs. La actualización incorpora los siguientes subtipos iniciales como valores propuestos y editables del catálogo. Cada código tiene una única categoría padre.

| Categoría | Subcategorías iniciales propuestas |
| --- | --- |
| `fire` | `fire_structure` — En edificación, `fire_vehicle` — Vehicular, `fire_vegetation` — Vegetación |
| `traffic_accident` | `traffic_collision` — Colisión, `traffic_pedestrian` — Atropello, `traffic_rollover` — Volcadura |
| `medical_emergency` | `medical_illness` — Enfermedad aguda, `medical_injury` — Lesión, `medical_other` — Otra emergencia médica |
| `violence` | `violence_physical` — Física, `violence_psychological` — Psicológica, `violence_sexual` — Sexual |

Los subtipos de violencia heredan el indicador sensible. Las otras categorías conservan su selección directa y pueden ampliarse mediante la administración actual. Las reglas generales actuales siguen aplicándose a los nuevos subtipos. Mantener los destinos iniciales existentes, incluido tránsito hacia PNP y SAMU. La selección por especialidad agrupa por código y usa las mismas reglas, lo que evita crear copias de un accidente para cada entidad.

Agregar el filtro opcional `institutionType` a `GET /catalog/categories` y `GET /catalog/categories/{id}/subcategories`. Usar `EXISTS` sobre reglas activas para evitar resultados repetidos. Una categoría aparece si tiene regla general o una regla para un subtipo activo propio. Para subcategorías, una regla general incluye todos los subtipos activos y una regla específica incluye solo el subtipo correspondiente. El filtro omite coordenadas y muestra aptitud por especialidad. Las sugerencias operativas siguen aplicando además permisos, sede activa y cobertura.

La carga usa upsert por código para las filas iniciales y preserva IDs, referencias y reglas ajenas. Una regla ya existente con categoría, subtipo y tipo institucional equivalentes se reutiliza. Una repetición conserva las prioridades y activaciones configuradas. El contenido propuesto permite ampliar la selección sin exigir cambios inmediatos en los clientes que solo envían `categoryId`.

### 4. Dieciséis sedes con claves propias

La cantidad de 16 fue confirmada por el usuario. La institución de tipo `municipalidad` de Huamanga contiene sede central y base Serenazgo. Cada una de las otras cuatro municipalidades tiene su propia institución. PNP agrupa siete sedes, Bomberos dos y SAMU una. El resultado son ocho instituciones DEMO y dieciséis sedes objetivo.

Cada fila del seed tiene una clave estable propia y un identificador de distrito. Sustituir el mapa basado únicamente en `type` por claves de sede y agrupación institucional explícita, y contar instituciones y sedes de forma independiente. Los nombres cargados llevan `DEMO` y los registros admitidos por el esquema conservan `is_demo=TRUE`.

| Clave de sede | Nombre base | Distrito DEMO | Cuenta de desarrollo |
| --- | --- | --- | --- |
| `mph-central` | Municipalidad Provincial de Huamanga — Sede Central | Ayacucho | `superadmin@demo.invalid` |
| `serenazgo-huamanga` | Base Serenazgo Huamanga | Ayacucho | `operator-municipalidad@demo.invalid` |
| `serenazgo-sjb` | Base Serenazgo San Juan Bautista | San Juan Bautista | `operator-serenazgo-sjb@demo.invalid` |
| `serenazgo-carmen-alto` | Base Serenazgo Carmen Alto | Carmen Alto | `operator-serenazgo-carmen-alto@demo.invalid` |
| `serenazgo-jesus-nazareno` | Base Serenazgo Jesús Nazareno | Jesús Nazareno | `operator-serenazgo-jesus-nazareno@demo.invalid` |
| `serenazgo-aacd` | Base Serenazgo Andrés Avelino Cáceres Dorregaray | Andrés Avelino Cáceres Dorregaray | `operator-serenazgo-aacd@demo.invalid` |
| `pnp-ayacucho` | Comisaría PNP Ayacucho A | Ayacucho | `operator-pnp@demo.invalid` |
| `pnp-sjb` | Comisaría PNP San Juan Bautista A | San Juan Bautista | `operator-pnp-sjb@demo.invalid` |
| `pnp-carmen-alto` | Comisaría PNP Carmen Alto B | Carmen Alto | `operator-pnp-carmen-alto@demo.invalid` |
| `pnp-chacco` | Comisaría PNP Chacco | Jesús Nazareno | `operator-pnp-chacco@demo.invalid` |
| `pnp-aacd` | Comisaría PNP Andrés Avelino Cáceres | Andrés Avelino Cáceres Dorregaray | `operator-pnp-aacd@demo.invalid` |
| `pnp-depincri` | DEPINCRI Ayacucho | Ayacucho, provisional | `operator-pnp-depincri@demo.invalid` |
| `pnp-familia` | Comisaría PNP Familia Ayacucho M | Ayacucho | `operator-pnp-familia@demo.invalid` |
| `bomberos-63` | Compañía de Bomberos Ayacucho n.º 63 | Ayacucho, provisional | `operator-bomberos@demo.invalid` |
| `bomberos-222` | Compañía de Bomberos Salvador San Juan n.º 222 | San Juan Bautista | `operator-bomberos-222@demo.invalid` |
| `samu-ayacucho` | SAMU Ayacucho | Ayacucho | `operator-samu@demo.invalid` |

La cuenta central conserva el rol SuperAdministrador. Las otras quince tienen rol Operador y membresía individual de sede. Las cuentas previas de administradores institucionales y ciudadano se mantienen como auxiliares. Los correos oficiales aportados durante la exploración permanecen como referencias pendientes de validación y las cuentas de acceso del seed usan los correos de desarrollo de la tabla.

El usuario confirmó expresamente Chacco. La PNP publica su ubicación en Jesús Nazareno y el contacto `com.chacco@policia.gob.pe`. [Publicación PNP](https://www.gob.pe/institucion/pnp/informes-publicaciones/7930974-bases-del-proceso-de-seleccion-para-otorgamiento-de-la-concesion-roud-racion-organica-unica-diaria-para-la-comisaria-pnp-chacco-com-pnp-chacco-ayacucho)

Crear cinco distritos DEMO bajo departamento Ayacucho y provincia Huamanga. Reutilizar el distrito anterior para Ayacucho. Los puntos y polígonos siguen siendo sintéticos, identificados en la definición como provisionales. DEPINCRI utiliza Ayacucho como ubicación de desarrollo asumida. Su distrito físico sigue pendiente, al igual que la ubicación actual de Bomberos 63 y las bases de Serenazgo. Esa limitación queda junto a los datos del seed. Los polígonos de desarrollo permiten probar derivaciones entre sedes y distritos con puntos conocidos.

### 5. Actualización repetible y compatibilidad del seed

Reconocer las cuatro instituciones y sedes DEMO anteriores y adoptarlas como `pnp-ayacucho`, `samu-ayacucho`, `bomberos-63` y `serenazgo-huamanga`. Actualizar sus etiquetas en la misma transacción conservando IDs y todas sus referencias. Mantener los correos `superadmin`, `admin-*`, `operator-*` y `citizen` previos.

Usar identificadores deterministas para nuevas filas con UUID y claves estables para territorio y recursos. La resolución de una fila se basa en la identidad nueva o en un alias legado conocido y restringe la adopción a datos DEMO. Nunca adoptar por nombre genérico una institución real. La reconciliación actualiza las coberturas propias del seed por su identidad y conserva coberturas adicionales administradas manualmente.

Serializar ejecuciones del seed mediante bloqueo de sesión MySQL que cubra la carga de referencia y la carga DEMO. Adquirirlo antes de comenzar y liberarlo en `finally`. Respetar los límites de transacción existentes de `seedReference` y `seedDemo`. Una repetición repara datos objetivo faltantes y conserva contraseñas y registros ajenos. Actualizar las pruebas que seleccionan arbitrariamente una única sede por `type` para que elijan una sede estable dentro de la cobertura de su escenario.

### 6. Recursos opcionales y contrato

Conservar la normalización actual de omisión a `[]`, el límite de 30, el rechazo de `null`, los bloqueos de recursos y la transacción de asignación. `institutionId` y `siteId` siguen siendo requeridos, y `reason` conserva su obligatoriedad condicional para correcciones manuales. Las tablas `units`, `personnel`, `unit_assignments` y `personnel_assignments` continúan soportando solicitudes con recursos.

OpenAPI documentará los tres booleanos anulables en `CreateIncidentRequest`, `PhoneIncidentRequest` e `IncidentDetail`. El esquema telefónico declara actualmente sus propiedades de forma independiente, por lo que requiere su propia actualización. Incluirá el filtro `institutionType` en ambas consultas, ejemplos de categorías compartidas y ejemplos de asignación omitiendo ambos arreglos o solamente uno. `default: []` y las descripciones explicarán la normalización de los arreglos opcionales, con `maxItems: 30`, formato UUID y unicidad.

## Risks / Trade-offs

- Observaciones de varias personas ambiguas → documentar el supuesto de persona principal y conservar la cantidad total en `affectedPeople`.
- Coordenadas y distritos físicos incompletos → usar datos de desarrollo explícitos y registrar junto a cada sede la verificación pendiente.
- Reintentos antiguos afectados por cambios del normalizador → conservar el contenido canónico anterior cuando las observaciones sean desconocidas.
- Interrupción entre el DDL y su registro de migración → comprobar el esquema antes de repetir el DDL y verificar la recuperación mediante un fallo inducido.
- Sedes múltiples rompen selección por tipo en seed o pruebas → usar claves explícitas y puntos de prueba dentro de las coberturas correspondientes.
- Deltas de capacidades compartidas con `operational-mvp` → usar nombres de requisitos propios y revisar ambos cambios al sincronizar.
- Upserts que sobrescriben configuración manual → limitar reconciliación a identidades y propiedades del catálogo DEMO y preservar reglas, prioridades y activaciones existentes.

## Migration Plan

1. Verificar en una base `_test` tanto la instalación desde cero como la actualización desde las once migraciones anteriores y las cuatro sedes iniciales.
2. Aplicar `012_medical_triage.sql` mediante el ejecutor existente y comprobar columnas anulables, restricciones, datos previos y segunda ejecución sin DDL adicional. Provocar además una interrupción entre el DDL y su registro y verificar que el reintento reconoce el esquema completo, conserva los datos y registra una única vez el checksum. Ante definiciones parciales o incompatibles, revisar el error y corregir el esquema antes de repetir.
3. Desplegar la API compatible con la ampliación y el contrato actualizado. Ejecutar el seed explícito en desarrollo y repetirlo para verificar cantidades, IDs, credenciales, membresías e historial.
4. Ejecutar las comprobaciones de contrato y pruebas focalizadas antes de los conjuntos exigidos por el repositorio.
5. Ante un fallo de API, restaurar la versión previa conservando las columnas aditivas. Los datos DEMO se recuperan desde el respaldo del entorno o mediante corrección de sus filas identificadas. La reparación de esquema se hace mediante una migración posterior y conserva el historial de checksums.
