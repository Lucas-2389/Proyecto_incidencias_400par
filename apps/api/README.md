# API técnica

Este paquete inicia el backend Node.js + Express. Las rutas técnicas y de autenticación están disponibles; el resto del [OpenAPI](../../packages/contracts/openapi.yaml) se implementa por fases del MVP.

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
| `JWT_SECRET` | Secreto local aleatorio de 32 caracteres o más para firmar JWT; nunca versionarlo. Si falta, login y refresh devuelven 503. |
| `DEV_MAILBOX_DIR` | Directorio local del buzón de recuperación en desarrollo, relativo a `apps/api`; usar `.local/mailbox` e ignorarlo en Git. Si falta, recuperación devuelve 503. |

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

## Autenticación local y cuentas DEMO

Generar `JWT_SECRET` con el generador criptográfico del sistema y guardarlo solo en `apps/api/.env`. En PowerShell, con el archivo local ya creado:

```powershell
$secret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
Add-Content apps/api/.env "JWT_SECRET=$secret"
Remove-Variable secret
```

Si el archivo ya contiene `JWT_SECRET`, **reemplazar** su valor; no agregar una segunda definición. Configurar `DEV_MAILBOX_DIR=.local/mailbox` para recuperación durante desarrollo. El buzón guarda el token en archivos JSON locales de acceso restringido; no copiar esos archivos a Git ni a registros. En un despliegue real se sustituirá este transporte de desarrollo por un servicio de correo autorizado.

Tras aplicar migraciones y seeds explícitos a la base seleccionada, la API expone `POST /api/v1/auth/register`, `/login`, `/refresh`, `/logout`, `/password-reset/request` y `/password-reset/confirm`. El registro exige nombre, correo, contraseña de 12 a 128 caracteres y `acceptedTerms: true`. Login devuelve JWT de acceso de 15 minutos y refresh opaco de 30 días. El refresh rota y revoca el token anterior. La solicitud de recuperación devuelve el mismo HTTP 202 para correos existentes o desconocidos; el token de recuperación dura 30 minutos y solo sirve una vez. Login y solicitud de recuperación devuelven HTTP 429 al superar sus límites por dirección y correo. Los errores no incluyen contraseñas ni tokens.

Las cuentas `@demo.invalid` se crean **solo** mediante `db:seed:demo:test` o `db:seed:demo:app`, con la contraseña local `DEMO_PASSWORD` de la primera ejecución. No hay una contraseña DEMO en el repositorio. El seed es idempotente y una repetición no restablece contraseñas. Para comprobar autenticación sin tocar la base operativa, usar `incidencias_full_test` migrada y sembrada:

```powershell
$env:DB_TEST_NAME = 'incidencias_full_test'
$env:RUN_MYSQL_INTEGRATION = '1'
npm --prefix apps/api test
Remove-Item Env:RUN_MYSQL_INTEGRATION
```

El suite usa cuentas de prueba con correos aleatorios en esa base aislada. La base indicada por `DB_NAME` nunca se selecciona para estas pruebas.

## Esquema y datos DEMO

Crear una base de pruebas nueva, separada de `incidencias`, mediante una operación administrativa. En esta estación se verificó `incidencias_full_test` con el usuario `incidencias_app` autorizado solo para esa base. Ajustar `DB_TEST_NAME` en el proceso o en `apps/api/.env` y comprobar que termina en `_test`:

```powershell
$env:DB_TEST_NAME = 'incidencias_full_test'
npm --prefix apps/api run db:migrate:test
npm --prefix apps/api run db:migrate:test # Debe aplicar 0 migraciones en la segunda ejecución.
npm --prefix apps/api run db:seed:reference:test
$demoSecret = Read-Host 'Clave local para usuarios DEMO (mínimo 12 caracteres)' -AsSecureString
$env:DEMO_PASSWORD = ConvertFrom-SecureString $demoSecret -AsPlainText
Remove-Variable demoSecret
npm --prefix apps/api run db:seed:demo:test
Remove-Item Env:DEMO_PASSWORD
```

El seed DEMO crea el departamento/provincia/distrito/sector ficticios de Ayacucho, polígonos, cuatro instituciones y sedes, operadores/administradores, recursos y tres incidentes de ejemplo. Nombres y referencias llevan `DEMO`, y las filas correspondientes tienen `is_demo=TRUE`. Las cuentas usan correos `@demo.invalid`, hash bcrypt y la clave local indicada solo en la primera creación; repetir el seed no cambia contraseñas ni duplica filas. Los seeds no corren durante `npm start` ni `docker compose up`. Solo usar la variante `:app` tras revisar datos existentes, respaldo y contraseña local de demostración.

Para volver a un estado de prueba limpio, crear y seleccionar **otra base `_test` vacía**; no ejecutar `DROP`, `TRUNCATE`, `docker compose down -v` ni un borrado automático sobre el volumen compartido. Conservar la base anterior hasta revisar su contenido y decidir expresamente su retiro. Los comandos de migración y seed rechazan una base de prueba con el mismo nombre que `DB_NAME`.

## Respaldo y restauración verificados en base aislada

MySQL 9.7.2 necesita `--skip-masking-policies` para que la cuenta de aplicación vuelque únicamente su base, `--set-gtid-purged=OFF` para evitar un permiso global, y `--hex-blob` para preservar geometrías SRID 4326 al pasar el dump por PowerShell. Ejemplo para una base de prueba ya migrada:

```powershell
$backupPath = Join-Path $env:TEMP ('incidencias-test-' + [guid]::NewGuid().ToString('N') + '.sql')
docker exec gestion-incidencias-mysql-1 sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -u "$MYSQL_USER" --single-transaction --set-gtid-purged=OFF --skip-add-drop-table --skip-masking-policies --no-tablespaces --hex-blob incidencias_full_test' > $backupPath
if ($LASTEXITCODE -ne 0) { throw 'Falló el respaldo' }
```

Un administrador crea **otra base vacía** terminada en `_test` y concede a `incidencias_app` los permisos necesarios. Después se restaura solo en esa base vacía; nunca dirigir este comando a `incidencias` ni a una base con datos:

```powershell
Get-Content -LiteralPath $backupPath -Raw | docker exec -i gestion-incidencias-mysql-1 sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" incidencias_restore_new_test'
if ($LASTEXITCODE -ne 0) { throw 'Falló la restauración' }
```

La verificación real en `incidencias_restore2_test` recuperó 34 tablas, 10 usuarios DEMO, 3 incidentes DEMO y las 3 ubicaciones con SRID 4326. No reutilizar una base donde una restauración falló parcialmente. Guardar respaldos fuera de Git y protegerlos como datos sensibles; para una futura base operativa se requiere revisar su política de retención y acceso.
