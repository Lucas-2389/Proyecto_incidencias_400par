# Proposal: cerrar la Iteración 0

## Why

La Iteración 0 ya cuenta con monorepo, configuración Docker, convenciones y contrato OpenAPI inicial, pero aún falta demostrar que un proceso Node.js puede usar la base MySQL local con credenciales de aplicación. Sin esa comprobación, la Iteración 1 empezaría sobre una conexión no validada.

## Objective

Dejar reproducible y comprobada la infraestructura local descrita en el SDD: MySQL 9.7.2 en Docker y una conexión mínima desde Node.js a la base `incidencias` mediante `incidencias_app`, sin usar `root` desde el backend ni crear tablas funcionales.

## What Changes

- Completar la configuración y documentación del entorno local para que el puerto, las credenciales y el nombre de la base se obtengan de variables de entorno, sin versionar secretos.
- Preparar el arranque mínimo del backend Node.js, conforme a la arquitectura Node.js + Express del SDD, y comprobar la conexión a MySQL con el usuario de aplicación mediante una consulta de diagnóstico sin efectos sobre los datos.
- Registrar una verificación reproducible de disponibilidad de MySQL, conexión correcta y fallo claro ante configuración o credenciales inválidas, sin revelar contraseñas en logs.
- Ajustar el README y las convenciones solo donde sea necesario para reflejar el cierre real de la Iteración 0. El OpenAPI inicial continúa como contrato de rutas futuras; este cambio no activa sus endpoints funcionales.

No se prevén cambios incompatibles en la API pública.

## Scope

## Scope

**Incluido:**
- Entorno Docker Compose local.
- Configuración del backend por variables de entorno.
- Conexión y cierre ordenado del cliente MySQL.
- Comprobación de salud y conectividad.
- Instrucciones de arranque y validación local.
- Endpoints técnicos de diagnóstico:
  - `GET /api/health`
  - `GET /api/health/database`

Estos endpoints sirven únicamente para verificar el estado de la aplicación y la conectividad con MySQL; no forman parte de la lógica funcional del dominio.

**Fuera de alcance:**
- Tablas de dominio.
- Migraciones funcionales.
- Semillas de roles.
- Autenticación/RBAC.
- Endpoints funcionales de incidencias, usuarios, instituciones, vehículos, personal o administración.
- Clientes React/Flutter.
- Despliegue remoto.
- Cloudflare.
- Pruebas de carga.

## Capabilities

### New Capabilities

- `local-development-environment`: el proyecto ofrece un entorno MySQL local reproducible, configurable y verificable sin exponer secretos en el repositorio.
- `database-connectivity`: el proceso Node.js establece y verifica una conexión a MySQL con la cuenta de aplicación, y comunica fallos de conexión sin exponer credenciales.

### Modified Capabilities

Ninguna. El proyecto aún no contiene specs principales de OpenSpec.

## Closure Criteria

- `docker compose` reconoce la configuración del proyecto y el contenedor `gestion-incidencias-mysql-1` con imagen MySQL 9.7.2 aparece en estado `healthy`.
- En la instalación local actual, MySQL es accesible desde Windows por `127.0.0.1:3307`; el puerto se toma de la configuración y no se fija en el código Node.js.
- Un proceso Node.js se conecta a `incidencias` con `incidencias_app`, ejecuta una consulta de diagnóstico de solo lectura y termina correctamente. El backend no usa la cuenta `root`.
- Si MySQL no está disponible o las credenciales son incorrectas, la verificación falla con un mensaje útil y sin imprimir secretos.
- El README permite repetir la preparación y la comprobación; `.env` permanece fuera de Git y `.env.example` contiene únicamente valores de ejemplo.
- El contrato OpenAPI inicial sigue siendo válido. No se crean tablas funcionales ni se implementan rutas de negocio en este cambio.

## Impact

Afecta al arranque y configuración de `apps/api`, a `compose.yaml`, `.env.example` y a la documentación local. Añade la dependencia de un cliente MySQL para Node.js. No cambia el comportamiento del contrato HTTP existente ni requiere cambios en el panel o la app móvil.

## Risks and Dependencies

- La comprobación depende de Docker Desktop y del contenedor MySQL disponible; un conflicto en el puerto local puede requerir cambiar `MYSQL_PORT`.
- Las variables `MYSQL_*` de inicialización del contenedor no modifican usuarios ni contraseñas de un volumen ya creado. Las credenciales del backend deben coincidir con las vigentes en ese volumen.
- Desde Windows se usa `127.0.0.1:3307` en la instalación confirmada; desde otro contenedor la dirección de MySQL sería el nombre del servicio y su puerto interno. La configuración debe admitir ambos contextos sin cambiar código.
