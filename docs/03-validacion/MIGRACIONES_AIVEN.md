# Revisión de migraciones para Aiven MySQL 8.4.8

Fuente: los diez archivos versionados de `apps/api/migrations/` y la inspección de `information_schema` tras aplicarlos. No contiene credenciales ni datos personales.

## Resultado

- Aplicadas: 10 de 10 con `npm --prefix apps/api run db:migrate:app`; segunda ejecución: 0 de 10.
- Esquema remoto: 36 tablas de dominio y `schema_migrations` (37 en total).
- Definiciones esperadas presentes: 85 índices nombrados, 61 claves foráneas y 18 restricciones `CHECK`; además, cada tabla tiene clave primaria.
- MySQL creó automáticamente `fk_unit_status_history_actor` como índice de soporte de una clave foránea: 86 índices secundarios reales.
- `schema_migrations` contiene los diez nombres y sus checksums SHA-256, todos coincidentes con los archivos actuales.
- Aiven usa `sql_require_primary_key=1`; todas las tablas creadas tienen clave primaria.
- La migración 009 actualiza la prioridad de categorías DEMO existentes. Esta base estaba vacía; no había categorías que actualizar. No se ejecutó ningún seed.
- Ninguna migración contiene `DROP TABLE`, `DROP DATABASE` o `DROP INDEX`.

## Inventario por tabla

Los índices listados son secundarios declarados; la clave primaria de cada tabla se omite de esa columna.

| Migración | Tabla | Índices declarados | Claves foráneas | CHECK |
| --- | --- | --- | --- | --- |
| 001_identity.sql | `roles` | `uq_roles_code` | — | — |
| 001_identity.sql | `users` | `uq_users_email`, `idx_users_status` | — | `chk_users_status` |
| 001_identity.sql | `user_roles` | `idx_user_roles_role` | `fk_user_roles_user`, `fk_user_roles_role` | — |
| 001_identity.sql | `refresh_tokens` | `uq_refresh_tokens_hash`, `idx_refresh_tokens_user_expiry` | `fk_refresh_tokens_user` | — |
| 001_identity.sql | `password_reset_tokens` | `uq_password_reset_tokens_hash`, `idx_password_reset_tokens_user_expiry` | `fk_password_reset_tokens_user` | — |
| 002_territory_institutions.sql | `departments` | `uq_departments_code` | — | — |
| 002_territory_institutions.sql | `provinces` | `uq_provinces_code`, `idx_provinces_department` | `fk_provinces_department` | — |
| 002_territory_institutions.sql | `districts` | `uq_districts_code`, `idx_districts_province` | `fk_districts_province` | — |
| 002_territory_institutions.sql | `district_boundaries` | `idx_district_boundaries_district`, `idx_district_boundaries_area` | `fk_district_boundaries_district` | — |
| 002_territory_institutions.sql | `sectors` | `uq_sectors_code`, `idx_sectors_district` | `fk_sectors_district` | — |
| 002_territory_institutions.sql | `sector_boundaries` | `idx_sector_boundaries_sector`, `idx_sector_boundaries_area` | `fk_sector_boundaries_sector` | — |
| 002_territory_institutions.sql | `institutions` | `idx_institutions_type_active` | — | `chk_institutions_type` |
| 002_territory_institutions.sql | `sites` | `idx_sites_institution_active`, `idx_sites_district`, `idx_sites_location` | `fk_sites_institution`, `fk_sites_district` | — |
| 002_territory_institutions.sql | `site_coverage_zones` | `idx_site_coverage_zones_site_active`, `idx_site_coverage_zones_area` | `fk_site_coverage_zones_site` | — |
| 002_territory_institutions.sql | `institution_memberships` | `uq_institution_memberships_scope`, `idx_institution_memberships_institution`, `idx_institution_memberships_site`, `idx_institution_memberships_role` | `fk_institution_memberships_user`, `fk_institution_memberships_institution`, `fk_institution_memberships_site`, `fk_institution_memberships_role` | — |
| 003_resources_catalogs.sql | `personnel` | `uq_personnel_institution_code`, `idx_personnel_site_active` | `fk_personnel_institution`, `fk_personnel_site` | — |
| 003_resources_catalogs.sql | `units` | `uq_units_institution_code`, `idx_units_site_status` | `fk_units_institution`, `fk_units_site` | `chk_units_status` |
| 003_resources_catalogs.sql | `incident_categories` | `uq_incident_categories_code`, `idx_incident_categories_family_active` | — | `chk_incident_categories_family` |
| 003_resources_catalogs.sql | `incident_subcategories` | `uq_incident_subcategories_code`, `idx_incident_subcategories_category_active` | `fk_incident_subcategories_category` | — |
| 003_resources_catalogs.sql | `routing_rules` | `idx_routing_rules_category_active`, `idx_routing_rules_subcategory`, `idx_routing_rules_type` | `fk_routing_rules_category`, `fk_routing_rules_subcategory` | `chk_routing_rules_type` |
| 004_incidents.sql | `incidents` | `uq_incidents_reference`, `idx_incidents_reporter_created`, `idx_incidents_status_created`, `idx_incidents_category_created`, `idx_incidents_source`, `idx_incidents_subcategory`, `idx_incidents_creator` | `fk_incidents_reporter`, `fk_incidents_creator`, `fk_incidents_category`, `fk_incidents_subcategory` | `chk_incidents_source`, `chk_incidents_status`, `chk_incidents_verification`, `chk_incidents_priority` |
| 004_incidents.sql | `incident_locations` | `idx_incident_locations_district`, `idx_incident_locations_sector`, `idx_incident_locations_point` | `fk_incident_locations_incident`, `fk_incident_locations_district`, `fk_incident_locations_sector` | `chk_incident_locations_accuracy` |
| 004_incidents.sql | `client_requests` | `uq_client_requests_scope_key`, `idx_client_requests_incident` | `fk_client_requests_incident` | `chk_client_requests_scope` |
| 004_incidents.sql | `incident_duplicates` | `idx_incident_duplicates_primary`, `idx_incident_duplicates_actor` | `fk_incident_duplicates_duplicate`, `fk_incident_duplicates_primary`, `fk_incident_duplicates_actor` | `chk_incident_duplicates_distinct` |
| 005_operations_public.sql | `institution_assignments` | `uq_institution_assignments_incident_site`, `idx_institution_assignments_institution_status`, `idx_institution_assignments_site_status`, `idx_institution_assignments_operator` | `fk_institution_assignments_incident`, `fk_institution_assignments_institution`, `fk_institution_assignments_site`, `fk_institution_assignments_operator` | `chk_institution_assignments_status` |
| 005_operations_public.sql | `unit_assignments` | `uq_unit_assignments_pair`, `idx_unit_assignments_unit_active` | `fk_unit_assignments_assignment`, `fk_unit_assignments_unit` | — |
| 005_operations_public.sql | `personnel_assignments` | `uq_personnel_assignments_pair`, `idx_personnel_assignments_person_active` | `fk_personnel_assignments_assignment`, `fk_personnel_assignments_person` | — |
| 005_operations_public.sql | `incident_history` | `idx_incident_history_incident_time`, `idx_incident_history_assignment_time`, `idx_incident_history_actor` | `fk_incident_history_incident`, `fk_incident_history_assignment`, `fk_incident_history_actor` | — |
| 005_operations_public.sql | `evidence` | `uq_evidence_object_key`, `idx_evidence_incident_time`, `idx_evidence_uploader` | `fk_evidence_incident`, `fk_evidence_uploader` | `chk_evidence_media_type` |
| 005_operations_public.sql | `directory_entries` | `idx_directory_scope_active`, `idx_directory_district_active`, `idx_directory_institution`, `idx_directory_site` | `fk_directory_institution`, `fk_directory_site`, `fk_directory_district` | `chk_directory_scope` |
| 005_operations_public.sql | `alerts` | `idx_alerts_district_validity`, `idx_alerts_author` | `fk_alerts_author`, `fk_alerts_district` | `chk_alerts_validity` |
| 005_operations_public.sql | `notifications` | `idx_notifications_user_read_time`, `idx_notifications_incident`, `idx_notifications_alert` | `fk_notifications_user`, `fk_notifications_incident`, `fk_notifications_alert` | — |
| 005_operations_public.sql | `audit_logs` | `idx_audit_actor_time`, `idx_audit_institution_time`, `idx_audit_entity_time`, `idx_audit_site` | `fk_audit_actor`, `fk_audit_institution`, `fk_audit_site` | — |
| 006_rate_limits.sql | `rate_limit_counters` | `idx_rate_limit_counters_window` | — | — |
| 007_unit_status_history.sql | `unit_status_history` | `idx_unit_status_history_unit_time` | `fk_unit_status_history_unit`, `fk_unit_status_history_actor` | `chk_unit_status_history_transition` |
| 008_category_priority.sql | `incident_categories` | — | — | `chk_incident_categories_priority` |
| 009_demo_category_priority.sql | — (actualización de datos existentes) | — | — | — |
| 010_push_devices.sql | `push_device_tokens` | `uq_push_token_hash`, `idx_push_devices_user_active` | `fk_push_devices_user` | — |
| ejecutor | `schema_migrations` | — | — | — |

## Compatibilidad y pruebas

- MySQL 8.4.8 acepta InnoDB, claves foráneas, `CHECK`, JSON y los índices espaciales sobre columnas `NOT NULL SRID 4326` usados por estas migraciones. No se detectó sintaxis exclusiva de MySQL 9.7.
- La conexión de aplicación usó `incidencias_app`, la base `incidencias` y TLS activo.
- Cinco rutas HTTP de solo lectura pasaron contra Aiven: health, health/database, catálogo de categorías, departamentos y resolución territorial.
- La suite inicial Node pasó 42 pruebas. Después se habilitó `incidencias_remote_test`, se aplicaron las diez migraciones y se cargaron los seeds explícitos de referencia y DEMO únicamente en esa base aislada. Los 63 casos de la suite original se verificaron por bloques contra Aiven. Se corrigió una expectativa desactualizada del caso de reversión: debe conservar la cantidad inicial de notificaciones, pues la creación del reporte ya genera avisos; el caso corregido pasó y el bloque restante terminó con 28/28 casos aprobados.
- Las tablas `roles` e `incident_categories` siguen vacías. El esquema está preparado; el funcionamiento completo aún requiere cargar datos de referencia en un paso explícito y probar en una base aislada.

## Datos de prueba remotos

- Base aislada: `incidencias_remote_test`.
- Seeds ejecutados: `seed-reference.js --target=test` y `seed-demo.js --target=test`.
- Datos DEMO confirmados: 4 roles, 16 categorías, 4 instituciones, 10 cuentas y 3 incidentes.
- La contraseña DEMO se conserva en `apps/api/.local/aiven-test-credentials.json`, ignorado por Git.
- El tiempo máximo de conexión TLS se amplió a 15 segundos para permitir la conexión remota; Docker local conserva 3 segundos.
- Posteriormente se aplicó `011_cloudinary_evidence.sql` únicamente en `incidencias_remote_test` para validar el almacenamiento de evidencias. La base operativa `incidencias` conserva las diez migraciones originales; la 011 queda pendiente de aplicación allí.
- Las dos integraciones HTTP de evidencias pasaron contra Aiven con la migración 011: almacenamiento local y Cloudinary simulado. Se verificaron metadatos, límites, permisos y lectura auditada. La subida real a Cloudinary está pendiente de sus credenciales; las simulaciones no acreditan disponibilidad del servicio real.
