# Proposal

## Why

La API admite observaciones clínicas y subtipos, pero el formulario móvil aún no permite capturarlos. El mapa móvil actual presenta celdas agregadas y carece de selección de incidentes y favoritos para seguir el estado público de reportes ajenos.

## What Changes

- Añadir un cuestionario SAMU opcional en `report.dart`, visible únicamente para `medical_emergency` y `traffic_accident`, con conciencia, respiración, sangrado, subtipo de la categoría seleccionada y cantidad de afectados.
- Sustituir el mapa de calor móvil por marcadores vectoriales por categoría y filtros ordenados Categoría, Distrito y Fechas opcionales.
- Publicar una proyección mínima por incidente con ubicación aproximada, exclusión en servidor de categorías o subcategorías sensibles y protección de identidad, contacto, descripción, evidencia y datos clínicos.
- Añadir favoritos locales en SharedPreferences y consulta del estado público de incidentes guardados, disponibles también para invitados.
- Documentar la excepción móvil a los requisitos de agregación pública de `operational-mvp`, SRS y SDD. Las consultas existentes de calor y las vistas institucionales conservan su contrato para sus consumidores.

## Capabilities

### New Capabilities

- `public-incident-map` — Consulta pública de incidentes con posición aproximada, filtros, exclusión de casos sensibles y detalle mínimo para seguimiento público.

### Modified Capabilities

- `medical-triage` — Captura móvil condicional de observaciones, subtipo y afectados, conservando desconocidos y reintentos.
- `citizen-mobile` — Mapa móvil con íconos vectoriales, filtros ordenados y favoritos locales de reportes públicos ajenos.

## Impact

Flutter afecta `apps/mobile/lib/screens/report.dart`, `map_view.dart`, navegación en `app.dart`, cliente API y persistencia local. Se reutilizan flutter_map, Material Icons y shared_preferences ya declarados.

La API requiere rutas públicas nuevas en el módulo geoespacial, proyección explícita de campos y contrato en `packages/contracts/openapi.yaml`. El alta clínica reutiliza columnas y validaciones existentes. Se prevén pruebas de privacidad y filtros de API, captura y reintentos Flutter, y persistencia de favoritos.

La implementación actualizará los apartados afectados del SRS/SDD y reconciliará el solapamiento con `operational-mvp`. Este cambio entrega planificación para revisión e implementación posterior.
