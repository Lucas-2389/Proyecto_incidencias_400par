# Plataforma de gestión de incidencias

Monorepo para el piloto en Ayacucho de la plataforma descrita en el [SDD](SDD_Plataforma_Gestion_Desastres_Violencias_v0.1.md). La Iteración 0 define la estructura, MySQL local, el contrato inicial y dos endpoints técnicos de salud. Las funciones de negocio se implementarán en las iteraciones siguientes.

## Estructura

| Ruta | Propósito |
| --- | --- |
| `apps/api` | Backend Node.js + Express, monolito modular. |
| `apps/admin` | Panel institucional React. |
| `apps/mobile` | App Flutter, Android primero. |
| `packages/contracts/openapi.yaml` | Contrato HTTP compartido. |
| `openspec` | Cambios y especificaciones de implementación. |

## Entorno local

Requisitos: Docker Desktop con Compose. Desde PowerShell, en la raíz del repositorio:

```powershell
Copy-Item .env.example .env
# Editar .env: cambiar MYSQL_PASSWORD y MYSQL_ROOT_PASSWORD; elegir MYSQL_PORT.
docker compose config --quiet
docker compose up -d mysql
docker compose ps
```

Esperar el estado `healthy`. MySQL se publica solo en `127.0.0.1` mediante `MYSQL_PORT`; en esta estación el puerto configurado es `3307`. Si ese puerto está ocupado, elegir otro libre en `.env` antes de iniciar Compose. Para detener sin perder datos:

```powershell
docker compose down
```

El volumen `gestion-incidencias_mysql_data` se conserva. No usar `docker compose down -v` en el flujo normal. `MYSQL_DATABASE`, `MYSQL_USER` y las contraseñas del contenedor solo se aplican al inicializar un volumen vacío; cambiar esas variables después no modifica automáticamente la base ni las credenciales existentes.

## API técnica

Node.js 20 o posterior. Desde otra terminal PowerShell en la raíz del repositorio:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
# Editar apps/api/.env: DB_PASSWORD debe ser la contraseña vigente de incidencias_app.
# En esta estación, DB_HOST=127.0.0.1 y DB_PORT=3307.
npm --prefix apps/api ci
npm --prefix apps/api start
```

El archivo `apps/api/.env` es independiente del `.env` raíz. El proceso Node.js usa `DB_USER=incidencias_app` y rechaza `root`. Si el volumen MySQL ya existía, la contraseña de la API debe coincidir con la cuenta existente; cambiar `MYSQL_PASSWORD` en el `.env` raíz no la actualiza.

En una tercera terminal PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
Invoke-RestMethod http://127.0.0.1:3000/api/health/database
```

El primer endpoint devuelve `{ "status": "ok" }` si HTTP funciona. El segundo devuelve `{ "status": "ok", "database": "connected" }` solo si `SELECT 1` funciona con MySQL; devuelve HTTP `503` con un error genérico si MySQL no está disponible. Detener Node.js con Ctrl+C para cerrar el servidor y el pool.

## Contrato y convenciones

El contrato inicial está en [OpenAPI](packages/contracts/openapi.yaml). Las rutas funcionales futuras usan `/api/v1`; los dos health checks técnicos usan `/api/health` y `/api/health/database`. Las convenciones de código y API están en [docs/conventions.md](docs/conventions.md).

## Iteraciones

La secuencia vigente se encuentra en la sección 21 del SDD. Cada iteración debe actualizar el contrato y registrar sus criterios de aceptación antes de implementar endpoints o clientes que dependan de ellos.
