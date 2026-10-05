# Plataforma de gestión de incidencias

Monorepo para el piloto en Ayacucho de la plataforma descrita en el [SDD](SDD_Plataforma_Gestion_Desastres_Violencias_v0.1.md). La Iteración 0 define la estructura, el entorno MySQL local y el contrato inicial de la API. Las aplicaciones y endpoints se implementarán en las iteraciones siguientes.

## Estructura

| Ruta | Propósito |
| --- | --- |
| `apps/api` | Backend Node.js + Express, monolito modular. |
| `apps/admin` | Panel institucional React. |
| `apps/mobile` | App Flutter, Android primero. |
| `packages/contracts/openapi.yaml` | Contrato HTTP compartido. |
| `openspec` | Cambios y especificaciones de implementación. |

## Entorno local

Requisitos: Docker Desktop con Compose. Node.js y Flutter se necesitarán al implementar sus aplicaciones.

1. Copiar `.env.example` a `.env` y cambiar ambas contraseñas.
2. Ejecutar `docker compose up -d mysql`.
3. Comprobar `docker compose ps` y esperar el estado `healthy`.
4. Detener con `docker compose down`. El volumen `mysql_data` conserva los datos.

MySQL se expone solo en `127.0.0.1` mediante el puerto `MYSQL_PORT`. La base y el usuario se crean únicamente al inicializar un volumen vacío. La Iteración 1 añadirá migraciones y el servicio API.

## Contrato y convenciones

El contrato inicial está en [OpenAPI](packages/contracts/openapi.yaml). Todas las rutas se entienden bajo `/api/v1`. Por ahora documenta el comportamiento esperado; no hay servidor HTTP. Las convenciones de código y API están en [docs/conventions.md](docs/conventions.md).

## Iteraciones

La secuencia vigente se encuentra en la sección 21 del SDD. Cada iteración debe actualizar el contrato y registrar sus criterios de aceptación antes de implementar endpoints o clientes que dependan de ellos.

