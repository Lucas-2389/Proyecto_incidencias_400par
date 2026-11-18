# Tasks

## 1. Esquema clínico y compatibilidad de datos

- [x] 1.1 Crear `apps/api/migrations/012_medical_triage.sql` con las tres columnas booleanas anulables y restricciones acordadas en una operación DDL, reutilizando `affected_people` y `subcategory_id`. Verificar el formato con `loadMigrations` y que las migraciones 001–011 conserven su checksum.
- [x] 1.2 Incorporar en la migración 012 la comprobación previa de columnas y restricciones para recuperar una ejecución cuyo DDL terminó antes del registro en `schema_migrations`. Provocar ese fallo y verificar que el reintento conserva esquema y datos, registra un único checksum correcto y omite el DDL ya completado. Comprobar que un esquema parcial o incompatible produce error y mantiene la migración pendiente.
- [x] 1.3 Ampliar `incident-schema.test.js` para comprobar actualización de un reporte previo, valores NULL/0/1, rechazo de valores ajenos al dominio y segunda ejecución del migrador. Ejecutar la integración en una base aislada `_test` y comprobar que conserva referencias y los campos reutilizados.

## 2. Reportes con observaciones clínicas

- [x] 2.1 Ampliar `src/incidents/report.js` y `queries.js` para validar, almacenar y devolver `isConscious`, `isBreathing` y `hasBleeding`. Actualizar `CreateIncidentRequest`, `PhoneIncidentRequest` e `IncidentDetail` en OpenAPI. Verificar booleanos verdaderos, falsos, desconocidos y tipos inválidos mediante los puntos de entrada móvil, invitado y telefónico.
- [x] 2.2 Adaptar el contenido canónico del hash para incluir solo observaciones conocidas en orden fijo y conservar el formato anterior cuando las tres sean desconocidas. Extender `incident-report-api.test.js` con claves antiguas, omisión equivalente a NULL, reenvío idéntico y cambios clínicos con igual clave. Verificar referencias estables y 409 cuando cambia el contenido.
- [x] 2.3 Extender las comprobaciones del detalle en `incident-report-api.test.js` para comprobar conversión 0/1 a booleanos, reutilización de cantidad y subtipo, acceso del reportante y acceso institucional dentro y fuera del ámbito. Incluir un reporte con tres afectados cuya descripción identifique a la persona principal y verificar que conserva el total, la descripción y las tres observaciones referidas a esa persona. Verificar las respuestas autorizadas y denegadas existentes.

## 3. Catálogo compartido por especialidad

- [x] 3.1 Actualizar `scripts/seed-reference.js` con los doce subtipos propuestos en el diseño y reutilización de las reglas existentes. Ampliar `catalog-api.test.js` para comprobar IDs estables, pertenencia de subcategorías, sensibilidad y ausencia de duplicados al repetir la carga, incluyendo una regla equivalente preexistente.
- [x] 3.2 Agregar `institutionType` opcional a ambas consultas de `src/incidents/catalog.js`, con validación de los tipos institucionales existentes y consultas sin resultados repetidos. Actualizar parámetros y ejemplos de esas rutas en OpenAPI. Verificar consulta sin filtro, regla general, regla específica, subtipo inactivo, especialidad sin reglas y 422 para tipo desconocido en `catalog-api.test.js`.
- [x] 3.3 Verificar con `suggestions-api.test.js` que una misma categoría de tránsito puede sugerir PNP y SAMU según cobertura y que las reglas específicas conservan su comportamiento. Comprobar que el catálogo compartido mantiene los 16 códigos anteriores y permite crear reportes desde clientes que solo envían categoría.

## 4. Catálogo de sedes y cuentas de desarrollo

- [x] 4.1 Sustituir en `scripts/seed-demo.js` la identidad basada solo en tipo por claves de sede y agrupación institucional explícita. Incorporar ocho instituciones, cinco distritos y las 16 sedes de la tabla de diseño, con Chacco en Jesús Nazareno. Verificar cantidades y relaciones consultando el catálogo tras una primera carga en `_test`.
- [x] 4.2 Incorporar las cuentas de desarrollo del diseño, manteniendo los correos anteriores y sus contraseñas. Crear las membresías de los quince operadores y conservar el acceso global SuperAdministrador. Verificar login por sede, separación de operadores PNP, cuentas auxiliares previas y hashes de contraseña mediante una integración focalizada del seed.
- [x] 4.3 Adoptar las cuatro sedes anteriores conservando sus IDs, recursos e historial, reconciliar solo coberturas propias del seed y serializar sus ejecuciones con bloqueo de sesión. Verificar una base legado, dos ejecuciones consecutivas y dos cargas concurrentes sin duplicar sedes ni membresías, y comprobar liberación del bloqueo tras un fallo recuperable.
- [x] 4.4 Definir puntos y coberturas sintéticas por distrito, con identificación DEMO y notas de provisionalidad junto a las sedes pendientes. Ajustar los incidentes de ejemplo a puntos conocidos y los contadores del resultado del seed. Verificar consultas dentro/fuera de cobertura, cinco distritos diferenciados y 16 sedes objetivo tras repetición.
- [x] 4.5 Actualizar las selecciones de fixtures en las pruebas existentes que dependen de una única sede por tipo para usar sedes explícitas y puntos dentro de su cobertura. Verificar en particular `dispatch-assignment.test.js`, `suggestions-api.test.js`, `resources-api.test.js` y las demás pruebas afectadas identificadas por sus consultas al seed.

## 5. Asignaciones con recursos opcionales

- [x] 5.1 Completar `CreateAssignmentRequest` y `Assignment` en OpenAPI con normalización a `[]`, opcionalidad de entrada, UUID, máximo 30, unicidad y ejemplos con omisión independiente. Verificar con el validador del contrato que institución y sede siguen siendo los campos obligatorios de la solicitud y las listas normalizadas están descritas en la respuesta.
- [x] 5.2 Ampliar `dispatch-assignment.test.js` con omisión de ambos arreglos, omisión independiente, arreglos vacíos explícitos y rechazo de NULL, duplicados y tipos inválidos. Comprobar 201, respuesta normalizada y ausencia de reservas cuando no hay recursos, reutilizando la implementación que ya soporta la omisión.
- [x] 5.3 Ejecutar los casos existentes de concurrencia, ámbito, corrección manual y reservas con recursos, ampliando aserciones de rollback si faltan. Verificar que un conflicto conserva la consistencia y que todas las tablas y relaciones de unidades y personal siguen disponibles.

## 6. Verificación integral del cambio

- [x] 6.1 Ejecutar una instalación nueva y una actualización legado en bases aisladas `_test`, repitiendo migración y seed. Comprobar recorrido de reporte clínico, consulta de catálogo SAMU, sugerencia por cobertura y asignación institucional con y sin recursos, incluyendo un operador de Chacco con su ámbito.
- [x] 6.2 Ejecutar las comprobaciones exigidas por el repositorio en su orden — `npm --prefix apps/admin run build`, `npm --prefix apps/api test`, `npm --prefix apps/api run contract:check`, `npm --prefix apps/admin test` y `git diff --check`. Registrar aparte el resultado real de las integraciones MySQL, distinguiendo las omitidas.
- [x] 6.3 Validar los artefactos y su coherencia final con `openspec validate domain-institutions-catalogs-and-triage --strict`. Revisar los deltas compartidos con `operational-mvp` para conservar los requisitos de ambos cambios y comprobar que los entregables corresponden a las 16 sedes y al catálogo compartido confirmados.

## Evidencia de verificación

- Migraciones 001–011 comparadas con `HEAD` mediante SHA-256, con sus checksums conservados. Migración 012 probada con fallo inducido después del DDL y antes de registrar el checksum, reintento exitoso y rechazo de esquemas parciales o incompatibles.
- Instalación nueva verificada en `incidencias_domain_fresh_test`. Actualización desde once migraciones y cuatro sedes previas verificada en `incidencias_domain_legacy_test`, conservando IDs, cuentas, contraseñas, recursos y un reporte previo con cantidad y subtipo. Las tres observaciones clínicas del reporte previo quedan en NULL.
- Integración de seed y recorrido HTTP de Chacco ejecutados en una base separada mediante `DB_SEED_TEST_NAME=incidencias_domain_seed_test`. Se comprobaron cargas consecutivas y concurrentes, liberación del bloqueo tras fallo, acceso por sede, catálogo SAMU, derivación compartida y asignaciones con y sin recursos.
- Comprobaciones de `CONTRIBUTING.md` ejecutadas en orden. Build React aprobado. API con `DB_TEST_NAME=incidencias_domain_fresh_test`, `RUN_MYSQL_INTEGRATION=1` y `DB_SEED_TEST_NAME=incidencias_domain_seed_test` aprobada con 79 pruebas, 0 fallidas y 0 omitidas. Contrato OpenAPI aprobado con 58 rutas y 4 roles. Panel React aprobado con 15 pruebas en 7 archivos. `git diff --check` aprobado.
- Revisados los deltas compartidos de `operational-mvp`. Se conservan los 16 códigos de categoría, las familias anteriores, el registro móvil e invitado, las reglas de derivación múltiple, el ámbito institucional y las reservas transaccionales de recursos.
