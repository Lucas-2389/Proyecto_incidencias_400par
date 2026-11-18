# Proposal

## Why

El piloto contiene cuatro sedes ficticias y un catálogo sin subcategorías iniciales, mientras SAMU necesita registrar observaciones de conciencia, respiración y sangrado. Se requiere representar las 16 sedes acordadas y organizar los incidentes compartidos entre especialidades conservando los reportes y las asignaciones existentes.

## What Changes

- Añadir `012_medical_triage.sql` con tres campos clínicos opcionales y anulables. Reutilizar `affected_people` para el número de afectados y `subcategory_id` para el subtipo.
- Integrar los campos clínicos en validación, persistencia, detalle autorizado e idempotencia de las altas móviles, invitadas y telefónicas.
- Mantener un catálogo compartido de categorías y subcategorías, con derivación por especialidad mediante `routing_rules`. Un incidente puede corresponder a varias especialidades.
- Ampliar `seed-demo.js` a las **16 sedes** confirmadas, incluida Comisaría PNP Chacco en Jesús Nazareno, con cuentas de desarrollo por sede y distritos diferenciados.
- Explicitar y verificar la omisión independiente de `unitIds` y `personnelIds` en asignaciones. La API y el contrato ya los admiten como opcionales.
- Actualizar `packages/contracts/openapi.yaml` con los campos clínicos, la consulta del catálogo por especialidad y ejemplos de asignación con recursos opcionales.

## Capabilities

### New Capabilities

- `medical-triage` — Observaciones clínicas iniciales opcionales, su persistencia y compatibilidad con reportes anteriores.
- `incident-reporting` — Catálogo compartido de categorías y subcategorías consultable por especialidad.
- `institutional-organization` — Catálogo DEMO de las 16 sedes y cuentas de desarrollo con su ámbito.
- `incident-dispatch` — Contrato de asignaciones institucionales con unidades y personal opcionales.

Estas capacidades todavía carecen de especificación principal en `openspec/specs/`. Las tres últimas conservan los nombres usados por el cambio pendiente `operational-mvp`, cuyos requisitos constituyen el contexto previo. Este cambio añade requisitos específicos que deberán reconciliarse al sincronizar ambos cambios.

### Modified Capabilities

Ninguna de las dos capacidades publicadas actualmente cambia sus requisitos.

## Impact

Áreas previstas de implementación — `apps/api/migrations/012_medical_triage.sql`, `scripts/seed-reference.js`, `scripts/seed-demo.js`, `src/incidents/{catalog,report,queries}.js`, `src/dispatch/assignments.js`, pruebas existentes y `packages/contracts/openapi.yaml`.

Se preservan IDs y referencias históricas, tablas de recursos, controles de ámbito y reservas transaccionales. Las cuentas usan `@demo.invalid` y la contraseña configurada mediante `DEMO_PASSWORD`. Las ubicaciones pendientes se representan como datos DEMO explícitos. El alcance comprende API, datos y contrato. La captura visual del triaje en Flutter/React se abordará mediante un cambio posterior.
