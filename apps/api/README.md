# API técnica

Este paquete inicia el backend Node.js + Express. En el cierre de la Iteración 0 solo ofrece comprobaciones de salud; las rutas de negocio del [OpenAPI](../../packages/contracts/openapi.yaml) pertenecen a iteraciones posteriores.

## Configuración de la API

Desde PowerShell, copiar `apps/api/.env.example` a `apps/api/.env` y sustituir `DB_PASSWORD` por la contraseña vigente de `incidencias_app` en el volumen MySQL local. El backend carga este archivo por ruta absoluta; no carga el `.env` raíz de Docker Compose y nunca usa `MYSQL_ROOT_PASSWORD`. Las variables del proceso tienen prioridad sobre el archivo local.

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto HTTP del proceso. |
| `DB_HOST` | Host MySQL visto desde donde corre Node.js. |
| `DB_PORT` | Puerto MySQL visto desde donde corre Node.js. |
| `DB_NAME` | Base de datos, `incidencias` en el piloto. |
| `DB_USER` | Usuario de aplicación, `incidencias_app`; `root` se rechaza. |
| `DB_PASSWORD` | Contraseña de ese usuario, nunca versionada. |
| `DB_TEST_NAME` | Base aislada para pruebas integradas, terminada en `_test`; nunca usar `DB_NAME`. |

| Ubicación de Node.js | `DB_HOST` | `DB_PORT` |
| --- | --- | ---: |
| Windows en esta estación | `127.0.0.1` | `3307` |
| Contenedor futuro en la red Compose | `mysql` | `3306` |

Cambiar `DB_HOST` y `DB_PORT` en la configuración del entorno para cambiar de ubicación; el código no detecta ni fija la plataforma. Las credenciales de la API deben coincidir con las del usuario ya existente en MySQL; cambiar `MYSQL_PASSWORD` en el `.env` raíz no modifica un volumen inicializado.

## Arranque y comprobación

Desde la raíz del repositorio en PowerShell, con MySQL `healthy`:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
# Editar DB_PASSWORD en apps/api/.env para que coincida con incidencias_app.
npm --prefix apps/api ci
npm --prefix apps/api start
```

Desde otra terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
Invoke-RestMethod http://127.0.0.1:3000/api/health/database
```

`/api/health` devuelve HTTP `200` y `{ "status": "ok" }` si el proceso HTTP responde. `/api/health/database` ejecuta `SELECT 1` con el pool y devuelve HTTP `200` con `{ "status": "ok", "database": "connected" }`; ante MySQL caído o credenciales incorrectas devuelve HTTP `503` con `DATABASE_UNAVAILABLE` y un `correlationId`, sin detalles de conexión. Ambas respuestas llevan `Cache-Control: no-store`. Ctrl+C cierra HTTP y el pool.

## Pruebas con base aislada

El archivo local `apps/api/.env` puede definir `DB_TEST_NAME=incidencias_test`. La configuración de pruebas rechaza nombres sin sufijo `_test`, la misma base indicada por `DB_NAME` y el usuario `root`. Las pruebas unitarias no modifican MySQL:

```powershell
npm --prefix apps/api test
```

Antes de futuras pruebas integradas, crear `incidencias_test` como base separada y conceder acceso a `incidencias_app` mediante una operación administrativa revisada. No ejecutar migraciones ni seeds de prueba contra `incidencias`.

## Desarrollo del MVP

Desde PowerShell en la raíz del repositorio, ejecutar en este orden:

```powershell
npm --prefix apps/api ci
npm --prefix apps/api test
npm --prefix apps/api run contract:check
npm --prefix apps/api start
```

Comprobar las rutas técnicas con los dos comandos `Invoke-RestMethod` de la sección anterior. El router funcional se monta en `/api/v1`; las rutas de dominio se añaden por fases y una ruta inexistente responde `NOT_FOUND` con `correlationId`. Las respuestas funcionales indican `Cache-Control: no-store` y el log HTTP no incluye cuerpo, consulta ni encabezados.

Las migraciones son explícitas y usan archivos versionados en `apps/api/migrations`. Una vez creada y autorizada la base de pruebas aislada, ejecutar `npm --prefix apps/api run db:migrate:test`. Para la base operativa, revisar antes el SQL y un respaldo, luego usar `npm --prefix apps/api run db:migrate:app`. Ninguna migración corre al arrancar la API. El ejecutor registra un checksum y rechaza modificar un archivo ya aplicado; si falla una migración MySQL DDL a medio camino, detenerse y revisar antes de reintentar.
