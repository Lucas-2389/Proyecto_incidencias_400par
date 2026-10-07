# API técnica

Este paquete inicia el backend Node.js + Express. Implementa las rutas técnicas y funcionales del piloto descritas en [OpenAPI](../../packages/contracts/openapi.yaml). La preparación de producción V1 está en [DEPLOYMENT_V1.md](../../docs/DEPLOYMENT_V1.md).

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
| `EVIDENCE_DIR` | Almacén local persistente de fotografías, relativo a `apps/api`; usar `.local/evidence` e ignorarlo en Git. Si falta, las rutas de fotos devuelven 503. |
| `APP_ENV` | `development` por defecto; `production` exige HTTPS, orígenes CORS y ruta absoluta de fotos. |
| `CORS_ORIGINS` | Lista separada por comas de orígenes web autorizados; en producción es obligatoria. |
| `PUBLIC_API_URL` | URL HTTPS pública de `/api/v1` para el despliegue; obligatoria en producción. |
| `UPLOAD_CONFIGURATION` | `local` en V1; exige volumen persistente en producción. |

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

### Territorio y zonas de atención

Los límites del seed de Ayacucho son **ficticios y exclusivamente DEMO**: no representan jurisdicciones oficiales ni deben usarse para asignar una emergencia real. `GET /api/v1/territory/departments`, `/provinces?departmentId=...`, `/districts?provinceId=...` y `/sectors?districtId=...` exponen la jerarquía cargada. `GET /api/v1/territory/resolve?latitude=...&longitude=...` devuelve distrito y sector o `null` si no hay polígono; la ausencia de cobertura requiere revisión humana.

Para cargar coberturas DEMO, usar el seed explícito anterior; cada sede recibe un polígono MULTIPOLYGON SRID 4326 y todas las filas quedan etiquetadas. Un SuperAdministrador puede crear instituciones y sedes con `/api/v1/admin/institutions` y `/api/v1/admin/sites`; también puede crear varias zonas por sede con `POST /api/v1/admin/coverage/sites/{siteId}`. El cuerpo de cada zona lleva `name` y `coordinates`, un anillo cerrado de pares `[longitud, latitud]` en WGS84. `GET /api/v1/admin/coverage/candidates?latitude=...&longitude=...` devuelve únicamente sedes e instituciones activas con zonas activas que contienen el punto. Las rutas de administración requieren JWT y filtran por rol, institución y sede.

Para sustituir datos DEMO por límites autorizados: obtener la fuente oficial y su licencia, validar vigencia y geometrías fuera del repositorio, preparar un respaldo y una base de ensayo aislada, importar territorios y polígonos SRID 4326 mediante una migración o importador versionado revisado, y verificar puntos interiores, bordes y ausencia de cobertura antes de habilitar derivación. Registrar procedencia y aprobación del dato; no modificar el seed DEMO para hacerlo pasar por oficial. Desactivar zonas DEMO en el entorno de destino solo después de comprobar la cobertura aprobada. Esta iteración no incluye un importador de límites oficiales.

### Personal y unidades

`/api/v1/resources/personnel` y `/api/v1/resources/units` aceptan `GET` y `POST`; `/{id}` acepta `GET`, `PATCH` y `DELETE` (desactivación, sin borrar historial). Las altas exigen `institutionId`, `siteId` y código único dentro de la institución. El personal agrega `name` y `roleDescription`; las unidades agregan `type`, `plate` opcional y `capacityDescription` opcional. Un AdministradorInstitucional solo modifica recursos de sus sedes; un Operador puede consultar. `GET /api/v1/resources/units?institutionId=...&siteId=...&available=true` excluye Mantenimiento, Fuera de servicio y cualquier estado distinto de Disponible.

El estado de unidad se cambia con `PATCH /api/v1/resources/units/{id}/status`, cuerpo `{"status":"maintenance","note":"Revisión programada"}`. Los valores son `available`, `assigned`, `en_route`, `attending`, `returning`, `maintenance` y `out_of_service`. El servidor valida cada transición, exige una asignación activa para estados operativos, impide liberar una unidad todavía asignada y registra actor, estado anterior, nuevo estado y nota en `unit_status_history`. El cambio de sede exige una unidad disponible; una sede ajena o inactiva se rechaza.

Ejemplo reproducible sobre una base DEMO de pruebas, con `JWT_SECRET` local configurado. En una terminal, arrancar la API contra la base aislada y no contra `incidencias`:

```powershell
$env:DB_NAME = 'incidencias_full_test'
npm --prefix apps/api start
```

En otra terminal, iniciar sesión con la cuenta DEMO creada por el seed y listar recursos de su sede. La contraseña se pide en la consola y no está en el repositorio:

```powershell
$demoSecret = Read-Host 'Clave DEMO' -AsSecureString
$demoPassword = ConvertFrom-SecureString $demoSecret -AsPlainText
$session = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3000/api/v1/auth/login' -ContentType 'application/json' -Body (@{ email = 'admin-pnp@demo.invalid'; password = $demoPassword } | ConvertTo-Json)
Remove-Variable demoSecret, demoPassword
$headers = @{ Authorization = "Bearer $($session.accessToken)" }
$sites = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/v1/admin/sites' -Headers $headers
$site = $sites | Where-Object { $_.name -eq 'DEMO Comisaría Centro' } | Select-Object -First 1
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/resources/units?institutionId=$($site.institutionId)&siteId=$($site.id)&available=true" -Headers $headers
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/resources/personnel?siteId=$($site.id)" -Headers $headers
```

Para verificar operaciones de escritura y transiciones sin usar la base operativa, establecer `DB_TEST_NAME=incidencias_full_test` y `RUN_MYSQL_INTEGRATION=1` y ejecutar `node --test apps/api/test/resources-api.test.js`. La prueba crea recursos con códigos aleatorios, revisa respuestas `201`, `403`, `409` y `422`, mueve recursos entre sedes y confirma el historial en MySQL. La migración `007_unit_status_history.sql` se aplica explícitamente mediante `db:migrate:test` antes de esta prueba.

### Reportes y fotografías privadas

`GET /api/v1/catalog/categories` y `GET /api/v1/catalog/categories/{id}/subcategories` devuelven el catálogo activo y la prioridad inicial configurada. Un SuperAdministrador administra el catálogo con las rutas `POST` y `PATCH` documentadas en OpenAPI. Las migraciones 008 y 009 añaden la prioridad configurable e inicializan los valores DEMO existentes; se aplican explícitamente, sin editar migraciones anteriores. La prioridad final de un incidente puede cambiar posteriormente por verificación operativa.

`POST /api/v1/incidents` admite ciudadano autenticado o invitado, pero siempre registra `source=MOBILE_APP` en el servidor. El cuerpo incluye `categoryId`, `description` y `location` con `latitude` y `longitude` WGS84. `accuracyMeters`, `capturedAt`, referencia del lugar y `occurredAt` son opcionales; se guarda el marcador final enviado. Enviar `Idempotency-Key` en la cabecera o `clientRequestId` en el JSON. Una repetición idéntica devuelve HTTP 200 con la misma referencia; reutilizar la clave con contenido distinto devuelve 409. Invitados quedan `unverified` y tienen límite de solicitudes por origen. El operador usa `POST /api/v1/ops/incidents/phone` con `institutionId` y `siteId` autorizados; la ubicación puede quedar pendiente y el servidor fija `source=PHONE`.

Con `$headers` de la sesión DEMO de la sección anterior y la API apuntando a la base de pruebas, este ejemplo registra un reporte y adjunta una fotografía. Sustituir `$photoPath` por una imagen local propia antes de ejecutar la subida:

```powershell
$categories = Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/catalog/categories'
$fire = $categories | Where-Object { $_.code -eq 'fire' } | Select-Object -First 1
$requestId = [guid]::NewGuid().ToString()
$body = @{ categoryId = $fire.id; description = 'Prueba local de reporte'; location = @{ latitude = -13.16; longitude = -74.22; accuracyMeters = 10; capturedAt = (Get-Date).ToUniversalTime().ToString('o') } } | ConvertTo-Json -Depth 4
$reportHeaders = $headers.Clone()
$reportHeaders['Idempotency-Key'] = $requestId
$report = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3000/api/v1/incidents' -Headers $reportHeaders -ContentType 'application/json' -Body $body
$photoPath = 'C:\ruta\foto.jpg'
$evidence = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/api/v1/incidents/$($report.id)/evidence" -Headers $headers -Form @{ photo = Get-Item -LiteralPath $photoPath }
```

La foto admite JPEG, PNG o WebP, máximo 5 MiB y tres fotos por incidente. Se valida el contenido real, se reescribe la imagen para eliminar metadatos y solo se guarda en MySQL la clave interna, hash y tamaño, sin BLOB. La respuesta no expone la clave interna; `GET /api/v1/incidents/{id}/evidence/{evidenceId}` exige autorización y registra la lectura. `GET /api/v1/incidents/mine` y el detalle devuelven solo reportes propios para un ciudadano. Un fallo de foto no borra el reporte ya confirmado.

El directorio `EVIDENCE_DIR` debe estar en un disco persistente con respaldo y permisos restringidos. No borrarlo al reiniciar ni mediante limpieza automática. Para retirar una foto, primero comprobar su referencia y política de retención, respaldar metadatos y archivo, y ejecutar una operación específica revisada; no eliminar el directorio completo. El almacén local sirve para desarrollo y una sola instancia; antes de escalar se sustituirá por almacenamiento compartido de objetos con el mismo contrato `EvidenceStore`.

### Derivación y ciclo de atención

`GET /api/v1/ops/incidents/{id}/suggestions` aplica las reglas activas de categoría y subtipo, por prioridad, y cruza el tipo institucional con sedes y coberturas activas. Devuelve la regla y su motivo por sede. Si ninguna sede autorizada cubre el punto, `exception=true`; `GET /api/v1/ops/incidents?exception=true` permite revisar esos casos. En el seed DEMO, incendio sugiere Bomberos, emergencia médica SAMU y robo PNP. Se pueden configurar varias reglas para una categoría, por ejemplo PNP, SAMU y Bomberos para un accidente grave. Estas sugerencias no confirman una asignación por sí solas.

`POST /api/v1/ops/incidents/{id}/assignments` confirma una sede sugerida o añade una institución/sede manual con `reason` obligatorio. El cuerpo acepta `institutionId`, `siteId`, `operatorUserId`, `unitIds` y `personnelIds`. El usuario debe tener permiso para esa sede. La transacción reserva recursos disponibles con bloqueo de filas MySQL; una segunda solicitud incompatible recibe 409. Se guardan la decisión, el actor y el motivo en historial y auditoría. Varias instituciones pueden trabajar sobre el mismo incidente. No se asigna automáticamente una sede inactiva, sin cobertura o fuera de los permisos del actor.

`PATCH /api/v1/ops/incidents/{id}/verification` recibe `verificationStatus` (`verified`, `unverifiable`, `false`, `duplicate`), `priority` opcional y `reason` obligatorio. `POST /api/v1/ops/incidents/{id}/duplicates` vincula el duplicado con `primaryIncidentId` y motivo; ambos reportes conservan sus referencias. `GET /api/v1/ops/incidents/{id}/history` muestra eventos autorizados. Una cuenta Ciudadano no puede ejecutar esas mutaciones.

`PATCH /api/v1/ops/incidents/{id}/status` recibe `status` y `note`. De `reported` solo avanza a `verifying` sin `assignmentId`; al asignar pasa a `assigned`. Cada asignación avanza `assigned → en_route → attending → resolved → closed` con su propio `assignmentId`. El estado global es el hito mínimo de todas las asignaciones: una institución no cierra el incidente mientras otra siga atendiendo. Las unidades avanzan con el hito y se liberan al cerrar la asignación. Estado, historial, recursos, notificación interna y auditoría se confirman en la misma transacción. Las transiciones inválidas responden 409 y no dejan cambios parciales.

Ejemplo local sobre datos DEMO con el JWT operativo en `$headers` y un incidente real visible en `/ops/incidents`:

```powershell
$inbox = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/v1/ops/incidents?status=reported' -Headers $headers
$incident = $inbox | Select-Object -First 1
$suggested = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/v1/ops/incidents/$($incident.id)/suggestions" -Headers $headers
$site = $suggested.suggestions | Select-Object -First 1
$assignmentBody = @{ institutionId = $site.institutionId; siteId = $site.siteId } | ConvertTo-Json
$assignment = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/api/v1/ops/incidents/$($incident.id)/assignments" -Headers $headers -ContentType 'application/json' -Body $assignmentBody
$statusBody = @{ assignmentId = $assignment.id; status = 'en_route'; note = 'Salida DEMO registrada' } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "http://127.0.0.1:3000/api/v1/ops/incidents/$($incident.id)/status" -Headers $headers -ContentType 'application/json' -Body $statusBody
```

El ejemplo presupone una incidencia reportada y una sugerencia dentro del ámbito del token; si no las hay, consultar la bandeja de excepciones y decidir con un motivo humano. Para ejecutar las pruebas de carrera y rollback en la base aislada: `node --test apps/api/test/dispatch-assignment.test.js apps/api/test/incident-lifecycle.test.js` con `DB_TEST_NAME=incidencias_full_test` y `RUN_MYSQL_INTEGRATION=1`.

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
