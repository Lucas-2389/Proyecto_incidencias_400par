# Proposal

## Why

El historial presenta códigos y acciones genéricas que dificultan comprender los cambios, el directorio móvil omite los contactos administrados y la pantalla de instituciones carece de gestión de usuarios por sede. La API local consultada solo publica un distrito DEMO, lo que impide utilizar de forma consistente los cinco distritos metropolitanos en mapas y demás consultas territoriales.

## What Changes

- Incorporar un catálogo compartido de Ayacucho, San Juan Bautista, Carmen Alto, Jesús Nazareno y Andrés Avelino Cáceres Dorregaray con UBIGEO, polígonos referenciales del INEI y procedencia verificable.
- Preparar una actualización repetible desde bases antiguas, resolver distritos por coordenadas y reclasificar registros existentes con resultados explícitos para ubicaciones ambiguas o fuera de cobertura.
- Aplicar filtros territoriales por nombre en mapas web y móvil, bandeja, Dashboard, estadísticas, historial, sedes, contactos y alertas. Dibujar los límites y encuadrar el distrito seleccionado en ambos mapas.
- Mostrar en el historial personas, registros, instituciones, sedes, acciones específicas y campos modificados. Añadir búsqueda, fechas, filtros coherentes y navegación por resultados, incluyendo compatibilidad con auditorías antiguas.
- Presentar Directorio como Contactos de emergencia, conectar su administración con la publicación móvil y mantener teléfonos nacionales disponibles sin conexión.
- Organizar Instituciones por sedes y ofrecer creación y administración de cuentas individuales desde cada sede mediante la API existente, con recuperación de fallos parciales.

## Capabilities

### New Capabilities

- `territorial-coverage` — Catálogo, cartografía, resolución y actualización territorial compartidos, incluyendo su uso transversal y la distinción respecto de la cobertura institucional.
- `audit-trail` — Registro y consulta comprensible de auditoría administrativa con filtros y compatibilidad histórica.
- `emergency-directory` — Administración y publicación territorial de contactos nacionales y locales para la ciudadanía.

Estas tres capacidades ya tienen antecedentes en los deltas pendientes de `operational-mvp`, pero todavía carecen de especificación principal. Se reutilizan sus nombres y se coordina su sincronización para evitar requisitos duplicados.

### Modified Capabilities

- `institutional-organization` — Gestión visible de usuarios por sede y asociación territorial de sedes.
- `operational-incident-map` — Límites visibles y filtrado conjunto de incidentes y sedes.
- `citizen-mobile` — Selección territorial por nombre en mapa, contactos y alertas.
- `incident-dispatch` — Línea de tiempo con mensajes específicos por evento.
- `admin-navigation` — Nombre Contactos de emergencia y acceso a usuarios desde Instituciones.
- `admin-dashboard` — Distrito compartido para bandeja, incidentes recientes e indicadores.

## Impact

React afecta `History.jsx`, `Directory.jsx`, `Resources.jsx`, `MapView.jsx`, `Dashboard.jsx`, `Incidents.jsx` y etiquetas. Flutter afecta `map_view.dart`, `directory.dart` y `alerts.dart`. La API afecta territorio, geoespacial, incidentes, organización, contactos y auditoría, además de migraciones y comandos de carga. Los contratos se actualizan en `packages/contracts/openapi.yaml`.

Se reutilizan MySQL espacial, Leaflet y flutter_map. La obtención y validación de los polígonos forma parte de la implementación. El cambio requiere coordinar los antecedentes de `operational-mvp` y el mapa público de `mobile-report-triage-and-map`. Se planifican comprobaciones de migración, permisos, filtros, privacidad pública y recuperación ante fallos.
