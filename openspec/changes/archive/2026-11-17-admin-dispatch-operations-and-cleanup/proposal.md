# Proposal

## Why

El panel institucional presenta gestión de recursos y controles geográficos que dificultan el despacho directo a sedes y operadores. El detalle ya recibe observaciones de triage y coordenadas, pero necesita presentarlas junto con el seguimiento independiente de las instituciones participantes.

## What Changes

- Retirar enlaces, importación de la pantalla de recursos y rutas de Unidades y Personal en `App.jsx`, manteniendo la pantalla de organización institucional.
- Eliminar el modo de calor y sus consultas del mapa administrativo. Alinear Tipo de incidente, Distrito, Desde (opcional) y Hasta (opcional), con el periodo aplicado y Actualizar debajo y distribución adaptable en pantallas pequeñas.
- Mostrar en Información del reporte los datos disponibles de triage rápido, respetando respuestas negativas, valores desconocidos, subtipo y cantidad de afectados. Ubicar el minimapa autorizado en una tarjeta a la derecha de Información y triage en escritorio, y debajo de ellos en pantallas pequeñas.
- Presentar la prioridad con insignias de texto y color consistentes en bandeja y detalle, alerta para Alta y Crítica y selector en Control para guardar cambios con motivo y el resultado de verificación seleccionado.
- Simplificar el despacho a Sede y Operador opcional, conservando el motivo de corrección manual y omitiendo la selección y consulta de unidades y personal.
- Mostrar asignaciones concurrentes mediante tarjetas por sede con institución, operador cuando sea visible, estado, fecha y avance independiente. Actualizar el seguimiento y recuperar conflictos entre sesiones.
- Recalcular el estado global al añadir una asignación a una atención iniciada, aplicando la regla existente de la etapa menos avanzada.
- Ubicar Control como una franja compacta después de Fotografías, inicialmente replegada. Permitir abrirla y replegarla tras confirmar correctamente una acción propia, conservando visible el resultado.

## Capabilities

### New Capabilities

- `admin-navigation` — Acceso a las secciones administrativas y retiro de las pantallas de recursos del panel.
- `operational-incident-map` — Mapa institucional con marcadores autorizados y filtros alineados y adaptables de tipo, distrito y periodo.
- `admin-incident-detail` — Presentación operativa del reporte con Información y triage junto al minimapa, prioridad reconocible y editable, y Control compacto después de Fotografías.

### Modified Capabilities

- `incident-dispatch` — Despacho administrativo sin selección de recursos, seguimiento concurrente por sede y consistencia del estado global al incorporar participantes.

## Impact

Se afectan `apps/admin/src/App.jsx`, `pages/MapView.jsx`, `pages/Incidents.jsx`, estilos y pruebas relacionadas. Se reutilizan React Leaflet, el catálogo territorial, categorías y subcategorías, usuarios y endpoints operativos existentes.

La API requiere ajustar el cálculo transaccional del estado agregado en `apps/api/src/dispatch/assignments.js`, compartir la regla de `lifecycle.js` cuando corresponda y añadir una consulta operativa de operadores por sede, dado que `/admin/users` restringe el acceso al rol Operador. Su contrato se documentará en `packages/contracts/openapi.yaml`. Los contratos de recursos opcionales y las rutas públicas de mapas siguen disponibles para sus consumidores. Las fechas opcionales se resuelven en el cliente con el periodo predeterminado de siete días y el contrato operativo actual de intervalo obligatorio.

Las capacidades nuevas describen específicamente el panel institucional. Durante la implementación se reconciliarán las referencias afectadas de `operational-mvp` y la guía de usuarios con este alcance. El cambio móvil `mobile-report-triage-and-map` aporta campos y catálogos ya implementados.
