# Instalar, ejecutar y colaborar desde otra computadora

Guía para `Lucas-2389/Proyecto_incidencias_400par`, actualizada el **2026-11-18**. Los comandos están escritos para Windows PowerShell y parten de la **raíz del repositorio**, salvo que se indique otra carpeta. Se usa `npm.cmd` para evitar que PowerShell intente ejecutar `npm.ps1`.

Cada compañero mantiene su MySQL, configuración y datos locales. Clonar Git no descarga cuentas, contraseñas, fotos ni registros de otra computadora. Para comenzar no se necesita acceso a Render, Aiven o Cloudinary de producción.

## 1. Qué se ejecuta y dónde

| Componente | Ejecución local | Dirección habitual | Configuración |
| --- | --- | --- | --- |
| MySQL | Contenedor Docker `mysql` | `127.0.0.1:3307` desde Windows | `.env` de la raíz |
| API Node.js | Proceso en una terminal de Windows | `http://127.0.0.1:3000/api/v1` | `apps/api/.env` |
| Panel React/Vite | Proceso en otra terminal | `http://127.0.0.1:5173/login` | `apps/admin/.env` |
| App Flutter | Teléfono USB o emulador, opcional | API elegida con `--dart-define` | Argumentos de ejecución |

Docker Compose inicia **MySQL**. La API y el panel se inician por separado y sus terminales deben permanecer abiertas. React y Flutter consumen la API; solo la API se conecta a MySQL. Vite reenvía `/api` al puerto 3000 mediante su proxy.

## 2. Requisitos y acceso al repositorio

- Git y Node.js **22**, según `.nvmrc`; usar una versión 22.12 o posterior de esa rama. npm viene con Node.
- Docker Desktop iniciado y Docker Compose disponible. La imagen MySQL está fijada en `compose.yaml`.
- Para Android: Flutter compatible con Dart `^3.10.1`, según `apps/mobile/pubspec.yaml`, Android SDK y `adb` en el PATH. Comprobar el equipo con `flutter doctor`.
- OpenSpec CLI solo si se trabajará con especificaciones. No es necesario para arrancar API y panel.

```powershell
git --version
node --version
npm.cmd --version
docker compose version
docker info
```

`docker info` debe conectar con Docker Desktop. Si no lo hace, abrir Docker Desktop antes de continuar.

```powershell
git clone https://github.com/Lucas-2389/Proyecto_incidencias_400par.git
Set-Location Proyecto_incidencias_400par
git status -sb
```

Para enviar ramas al repositorio, el propietario invita al compañero desde **Settings → Collaborators** y este acepta. Cada persona autentica GitHub con su propia cuenta. Descargar ZIP permite leer el proyecto, pero no prepara el historial Git para colaborar.

No hay `package.json` en la raíz: los paquetes npm están separados en `apps/api` y `apps/admin`.

## 3. Primera instalación: configuración privada

En un clon nuevo, sin archivos `.env` existentes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-local.ps1
```

Si el puerto 3307 está ocupado, elegir otro **antes de inicializar**:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-local.ps1 -MySqlPort 3308
```

Ejecutar solo una de las variantes. El script crea `.env`, `apps/api/.env` y `apps/admin/.env`, genera secretos aleatorios y hace coincidir la contraseña MySQL de Compose con la de la API. No inicia servicios, instala dependencias ni modifica bases. Si cualquiera de esos archivos ya existe, se detiene sin sobrescribirlos: conservar la configuración y revisarla manualmente.

| Archivo privado | Qué revisar |
| --- | --- |
| `.env` | `MYSQL_DATABASE=incidencias`, `MYSQL_USER=incidencias_app`, contraseñas propias y `MYSQL_PORT=3307` o el elegido. |
| `apps/api/.env` | `APP_ENV=development`, `PORT=3000`, `DB_HOST=127.0.0.1`, puerto y contraseña coincidentes, `DB_NAME=incidencias`, `DB_SSL=false`, `UPLOAD_CONFIGURATION=local`, `JWT_SECRET` y `DEMO_PASSWORD` propios. |
| `apps/admin/.env` | `VITE_API_BASE_URL=/api/v1` y `VITE_API_PROXY_TARGET=http://127.0.0.1:3000`. |

La API carga su propio `.env`, no el de Compose. Las variables heredadas de la terminal tienen prioridad; usar una terminal sin configuración de Aiven/producción. Los valores `VITE_` llegan al navegador y no deben contener secretos.

Alternativa manual: copiar las tres plantillas `.env.example` y sustituir sus marcadores. `MYSQL_PASSWORD` debe coincidir con `DB_PASSWORD` y `MYSQL_PORT` con `DB_PORT`. `JWT_SECRET` requiere al menos 32 caracteres aleatorios y `DEMO_PASSWORD` al menos 12. No copiar los secretos del propietario.

## 4. Primera instalación: dependencias y base local

```powershell
docker compose config --quiet
docker compose up -d mysql
docker compose ps
npm.cmd ci --prefix apps/api --include=dev
npm.cmd ci --prefix apps/admin --include=dev
```

Esperar a que MySQL aparezca como **healthy**. Si todavía está arrancando, consultar `docker compose ps` y `docker compose logs --tail 60 mysql` antes de comprobar la conexión:

```powershell
npm.cmd run db:check --prefix apps/api
```

Debe informar usuario `incidencias_app`, base `incidencias` y `tlsActive: false` para este Docker local. Verificar también `DB_HOST=127.0.0.1` y `DB_PORT` en la configuración privada. El nombre de la base por sí solo no identifica si el servidor es local o remoto.

Solo sobre el MySQL propio recién preparado, ejecutar **en este orden**, revisando el resultado de cada comando antes de continuar:

```powershell
npm.cmd run db:migrate:app --prefix apps/api
npm.cmd run territory:preview:app --prefix apps/api
npm.cmd run territory:load:app --prefix apps/api
npm.cmd run db:seed:demo:app --prefix apps/api
```

| Paso | Resultado |
| --- | --- |
| Migraciones | Crea o actualiza el esquema y registra las migraciones aplicadas. |
| Vista previa territorial | Valida el paquete y muestra el informe; revierte la transacción sin activar cambios. |
| Carga territorial | Activa los cinco distritos y límites referenciales del INEI desde el GeoJSON incluido en Git. No requiere descargar cartografía de nuevo. |
| Seed DEMO | Crea catálogos, instituciones, 16 sedes de demostración, cuentas y reportes ficticios. Reutiliza los distritos canónicos cargados. |

El seed invoca también el seed de referencia; no se necesita `db:seed:reference:app` por separado en esta secuencia. Los datos del otro equipo no se replican con estos pasos y sus cantidades pueden ser diferentes.

**`:app` significa la base indicada por `DB_NAME`**, no producción. **`:test` significa la base separada indicada por `DB_TEST_NAME`**. Docker crea inicialmente la primera; escribir `DB_TEST_NAME` en el archivo no crea la segunda.

Repetir migraciones aplica solo las pendientes; repetir la cartografía devuelve `unchanged`; repetir el seed conserva claves existentes. No modificar migraciones ya aplicadas ni borrar volúmenes para corregir credenciales. Las nuevas variables de Compose no cambian contraseñas de un volumen MySQL ya inicializado.

## 5. Iniciar los servidores cada día

Con la instalación terminada, abrir Docker Desktop y tres terminales en la raíz. No repetir el inicializador ni el seed en cada arranque.

**Terminal 1: MySQL y API.** Esperar `healthy` antes de iniciar Node:

```powershell
docker compose up -d mysql
docker compose ps
npm.cmd start --prefix apps/api
```

**Terminal 2: panel web.** El puerto estricto evita que Vite cambie silenciosamente a 5174 si hay otro proceso:

```powershell
npm.cmd run dev --prefix apps/admin -- --strictPort
```

**Terminal 3: comprobaciones y otras tareas.**

```powershell
Invoke-RestMethod 'http://127.0.0.1:3000/api/health'
Invoke-RestMethod 'http://127.0.0.1:3000/api/health/database'
$districts = Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/territory/districts?scope=ayacucho-metropolitan'
$districts | Format-Table code, name
$districts.Count
$boundaries = Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/territory/districts/boundaries?scope=ayacucho-metropolitan'
$boundaries.features.Count
```

Los health checks deben indicar `ok` y `database: connected`. Las dos cantidades territoriales deben ser **5**: Ayacucho, Carmen Alto, San Juan Bautista, Jesús Nazareno y Andrés Avelino Cáceres Dorregaray. Huamanga es la provincia; el distrito de la municipalidad provincial figura como Ayacucho.

Abrir **http://127.0.0.1:5173/login**. La sesión del panel se mantiene en memoria: tras recargar puede ser necesario ingresar otra vez. El mapa de fondo usa teselas de Internet, aunque la base y los límites distritales estén disponibles localmente.

La API usa `node src/server.js`, sin reinicio automático: después de editarla, detener con Ctrl+C y volver a iniciar. Vite actualiza React durante el desarrollo; los cambios en su `.env` requieren reiniciarlo.

Para detener, pulsar **Ctrl+C** en API, panel y Flutter. `docker compose stop mysql` conserva el contenedor y la base; `docker compose down` también conserva el volumen. No usar `docker compose down -v` como procedimiento normal: elimina los datos del volumen.

## 6. Cuentas y primer recorrido

| Cuenta local | Uso |
| --- | --- |
| `superadmin@demo.invalid` | Administración global, instituciones, sedes, cuentas y contactos. |
| `admin-pnp@demo.invalid` y administradores equivalentes del seed | Administración dentro de sus membresías institucionales. |
| `operator-pnp@demo.invalid` y operadores por sede | Atención operativa del ámbito asignado. |
| `citizen@demo.invalid` | Perfil y seguimiento desde Android. También se puede reportar como invitado. |

La contraseña es el valor **local** de `DEMO_PASSWORD` usado al crear cada cuenta por primera vez. Consultarlo en `apps/api/.env` sin pegarlo en chats, Markdown, commits o capturas. Cambiar esa variable y repetir el seed no restablece claves. Las cuentas de un equipo no existen automáticamente en otro ni en el servicio publicado.

Para comprobar la instalación entre ambos:

1. Ingresar al panel local como superadministrador y abrir Dashboard, Mapa e Instituciones.
2. Comprobar los cinco distritos y que elegir uno sin incidentes conserva su límite.
3. Ejecutar Android contra la misma API local, registrar un caso ficticio y conservar su referencia.
4. Buscar esa referencia en Incidentes. Si se usa un operador, revisar sede, cobertura y filtros; el superadministrador permite contrastar el resultado global.
5. En Instituciones, revisar los usuarios de una sede y su alta independiente después de guardar la sede. Cada persona usa su cuenta individual en un ambiente compartido autorizado.

Contactos de emergencia publica teléfonos para la app y conserva `/directorio`. Historial muestra cambios autorizados y su detalle. Consultar [Usuarios y módulos](USUARIOS.md) para el recorrido funcional.

## 7. Android conectado a la API local

Preparar Flutter una vez desde la raíz:

```powershell
flutter doctor
flutter devices
Push-Location apps/mobile
flutter pub get
Pop-Location
```

### Teléfono USB

Habilitar depuración USB, conectar el teléfono y aceptar en él la autorización. Con la API activa:

```powershell
adb devices
powershell -ExecutionPolicy Bypass -File .\scripts\run-mobile-local.ps1
```

El script comprueba la API, prepara `adb reverse` y arranca Flutter con la URL local y `APP_ENV=development`. No inicia MySQL ni la API. Con varios dispositivos, copiar el identificador mostrado por `adb devices`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-mobile-local.ps1 -DeviceId TU_ID_DE_DISPOSITIVO
```

USB usa `http://127.0.0.1:3000/api/v1` gracias al túnel. Mantener el cable conectado y repetir el script si se pierde el túnel.

### Emulador Android

Iniciar el emulador y ejecutar desde `apps/mobile`:

```powershell
Push-Location apps/mobile
flutter run --dart-define=APP_ENV=development --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
Pop-Location
```

`10.0.2.2` corresponde al host en el emulador Android estándar. Si hay varios dispositivos, añadir `-d` con el identificador de `flutter devices`.

### Teléfono por Wi-Fi

Usar la IP real de la computadora en la misma red privada, por ejemplo `http://192.168.1.25:3000/api/v1`, con `APP_ENV=development`. La API escucha en todas las interfaces; comprobar que el firewall permita el puerto 3000 en esa red. MySQL permanece limitado a loopback y no se comparte con el teléfono. No abrir puertos del router.

`127.0.0.1` en un teléfono sin túnel apunta al teléfono. El marcador literal `192.168.1.X` es rechazado por la app. Al cambiar `--dart-define`, detener y volver a ejecutar Flutter: hot reload no cambia esa configuración. Sin elegir desarrollo, la app usa la API publicada; distinguir los ambientes antes de crear datos de prueba.

Más opciones, APK y configuración: [README móvil](../../apps/mobile/README.md).

## 8. Actualizar el clon después del trabajo del compañero

Primero guardar y confirmar el trabajo propio, o conservarlo de forma coordinada antes de cambiar de rama. Desde una copia de trabajo limpia:

```powershell
git status --short
git switch main
git pull --ff-only origin main
git switch -c codex/descripcion-del-cambio
```

| Cambio recibido | Acción local |
| --- | --- |
| Dependencias o lockfile de API | `npm.cmd ci --prefix apps/api --include=dev` y reiniciar API. |
| Dependencias o lockfile de React | `npm.cmd ci --prefix apps/admin --include=dev` y reiniciar Vite. |
| `apps/api/migrations/*.sql` | Revisar y ejecutar `npm.cmd run db:migrate:app --prefix apps/api` en MySQL propio. |
| Paquete territorial o cargador | Ejecutar vista previa y carga territorial; revisar el informe. |
| Nuevos datos DEMO necesarios | Revisar y ejecutar el seed explícito; las claves existentes permanecen. |
| Plantillas `.env.example` | Incorporar nuevas claves al archivo privado, sin reemplazar secretos. |
| `pubspec.yaml` o `pubspec.lock` | `flutter pub get` desde `apps/mobile`. |
| URL o argumentos móviles | Detener y recompilar la ejecución de Flutter. |

Migraciones, cartografía y seeds **no** se ejecutan al arrancar los servidores. No editar datos de producción como parte de una actualización local.

## 9. Reparto de trabajo, ramas y entregas

Cada persona crea una rama `codex/<tarea>` y un PR hacia `main`. Antes de empezar, acordar módulo, archivos, cambio OpenSpec y resultado verificable. Evitar editar simultáneamente el mismo formulario o migración; coordinar número y orden de migraciones nuevas.

| Área | Acuerdo necesario |
| --- | --- |
| API y MySQL | Rutas, permisos, migraciones, configuración y ejemplos de errores. |
| Panel | Pantallas, roles y parámetros acordados con la API. |
| Flutter | Mismas rutas, campos y semántica territorial; API local frente a publicada. |
| Contrato HTTP | Actualizar `packages/contracts/openapi.yaml` junto con el comportamiento. |
| Datos y documentación | Datos ficticios reproducibles y registro de comandos y pruebas reales. |

Seleccionar archivos revisados para cada commit. No versionar `.env`, certificados, `.local`, `node_modules`, builds, APK ni firmas. Mantener los lockfiles correspondientes a cambios de dependencias y evitar regenerarlos sin necesidad.

Para actualizar una rama compartida, ejecutar `git fetch origin` y `git merge origin/main`, resolver conflictos y repetir comprobaciones. No reescribir historial compartido sin coordinarlo. El propietario revisa e integra los PR; `main` está conectado al despliegue automático de Render. GitHub no concede acceso a infraestructura ni a cuentas del panel.

En el PR indicar comportamiento anterior/nuevo, migraciones o variables nuevas, pruebas ejecutadas y pendientes. Los pasos de commit y revisión están en [CONTRIBUTING.md](../../CONTRIBUTING.md).

## 10. Comprobaciones antes del PR

Desde la raíz, sin activar integraciones externas:

```powershell
npm.cmd run build --prefix apps/admin
npm.cmd test --prefix apps/api
npm.cmd run contract:check --prefix apps/api
npm.cmd test --prefix apps/admin
git diff --check
```

Construir React antes del test backend: la prueba de servido estático necesita `apps/admin/dist/index.html`. El CI ejecuta las comprobaciones generales sin secretos productivos. Una integración omitida no equivale a una integración aprobada.

Si se modificó Flutter:

```powershell
Push-Location apps/mobile
flutter pub get
flutter analyze
flutter test
Pop-Location
```

### Integración MySQL opcional

No se necesita para iniciar los servidores. Para probar cambios de base, preparar una base **separada**, terminada en `_test`. En el Docker MySQL propio, abrir el cliente administrativo con contraseña interactiva:

```powershell
docker compose exec mysql mysql -u root -p
```

Introducir la contraseña privada `MYSQL_ROOT_PASSWORD` del `.env` raíz y ejecutar, para la cuenta por defecto de Compose:

```sql
CREATE DATABASE IF NOT EXISTS incidencias_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON incidencias_test.* TO 'incidencias_app'@'%';
exit
```

La cuenta administrativa se usa solo para provisionar la base propia; la API sigue usando `incidencias_app`. Con esa base autorizada, este ejemplo ejecuta únicamente las integraciones indicadas:

```powershell
$env:DB_TEST_NAME = 'incidencias_test'
npm.cmd run db:migrate:test --prefix apps/api
npm.cmd run db:seed:reference:test --prefix apps/api
$env:RUN_MYSQL_INTEGRATION = '1'
Push-Location apps/api
try {
    node --test --test-concurrency=1 test/metropolitan-territory.test.js test/admin-clarity.test.js test/institutions-api.test.js
} finally {
    Pop-Location
    Remove-Item Env:RUN_MYSQL_INTEGRATION -ErrorAction SilentlyContinue
    Remove-Item Env:DB_TEST_NAME -ErrorAction SilentlyContinue
}
```

Revisar el resultado de cada comando antes de continuar; detenerse si falla una migración. Estas pruebas escriben datos ficticios. `seed-demo.test.js` requiere además otra base aislada en `DB_SEED_TEST_NAME`; no activarla con la base diaria. Las pruebas Flutter remotas también crean reportes y fotos: no habilitarlas contra producción durante la instalación o el CI.

## 11. SDD, OpenSpec y fuente de información

Leer [SRS](../01-entrega/SRS.md), [SDD](../01-entrega/SDD.md), [contrato HTTP](../../packages/contracts/openapi.yaml) y especificaciones del área afectada. `04-historial` conserva antecedentes; no sustituye esta instalación.

Si el trabajo usa OpenSpec, revisar su estado:

```powershell
openspec list --json
openspec status --change NOMBRE_DEL_CAMBIO --json
openspec validate NOMBRE_DEL_CAMBIO --strict
```

`openspec/specs` contiene requisitos vigentes, `openspec/changes` cambios activos y `openspec/changes/archive` su historial. No implementar desde una copia archivada como si fuera activa ni marcar pruebas no ejecutadas. Un archivo puede conservar pendientes: el cambio territorial del 2026-11-18 registra 39/40 tareas y su inspección visual restante se trata como seguimiento explícito.

## Preparación del escalamiento horizontal

El escalamiento se diseñará en un cambio específico. Acordar instancias API, balanceo, estado compartido, archivos, presupuesto de conexiones MySQL y pruebas de concurrencia. Medir carga y recuperación en pruebas. Esta instalación ejecuta una API y no certifica capacidad para 1 000–5 000 usuarios; no requiere Redis, Kubernetes ni cuentas remotas nuevas.

## 12. Problemas frecuentes

| Síntoma | Comprobación o acción |
| --- | --- |
| PowerShell bloquea `npm.ps1` | Usar `npm.cmd`. |
| Inicializador detecta `.env` existente | Conservarlo; solo sirve para un clon nuevo. Revisar claves manualmente. |
| Docker no responde | Abrir Docker Desktop y comprobar `docker info`. |
| Puerto MySQL ocupado | Elegir otro al inicializar; en una instalación existente, coordinar Compose y API sin borrar el volumen. |
| API no conecta a MySQL | Esperar `healthy`; comprobar host, puerto, identidad y clave del volumen con `db:check`. |
| Health HTTP funciona y health de base devuelve 503 | El proceso HTTP responde y la conexión MySQL falla; revisar Docker y `DB_*`. |
| API o Vite indica puerto ocupado | Buscar la terminal que ya lo ejecuta. Reutilizar o detener el proceso propio. |
| Vite muestra `ECONNREFUSED` o web `Failed to fetch` | Confirmar API en 3000 y `VITE_API_PROXY_TARGET`; reiniciar Vite si cambió su `.env`. |
| Panel pide ingresar después de F5 | La sesión se mantiene en memoria; volver a ingresar. |
| Credenciales DEMO inválidas | Comprobar ambiente, correo y clave de la primera creación; repetir el seed no cambia claves. |
| Solo aparece un distrito o falla la cartografía | Actualizar clon, migraciones y carga territorial; comprobar los endpoints del paso 5. |
| Mapa sin fondo | Revisar Internet y teselas; distinguir fallo de fondo, catálogo y límites. |
| No aparece un reporte | Comparar referencia, API usada por Flutter, periodo, distrito y permisos/cobertura. |
| ADB muestra `unauthorized` | Desbloquear el teléfono y aceptar la depuración USB; repetir `adb devices`. |
| Teléfono no conecta | USB: túnel y cable. Emulador: `10.0.2.2`. Wi-Fi: IP real, red y firewall. |
| Faltan fotos o cuentas del otro equipo | Git no sincroniza base ni evidencias; crear datos propios o acordar ambiente compartido. |
| Test backend no encuentra `index.html` | Compilar React antes del test backend. |
| Prueba MySQL omitida o base desconocida | Preparar base separada y permisos; habilitar solo la integración prevista. |
| Checksum distinto en migración | No editar migraciones aplicadas; coordinar una nueva y revisar el estado existente. |
| `git push` rechazado | Aceptar invitación y autenticar GitHub con cuenta propia. |

Al pedir ayuda, compartir comando, carpeta, mensaje, referencia ficticia y ambiente. No enviar el contenido de `.env`, contraseñas, tokens ni archivos del buzón local.

## 13. Alcance de esta actualización documental

Los comandos se contrastaron con scripts, plantillas, configuración y paquetes del repositorio el 2026-11-18. Esta edición solo cambia Markdown: no reinstala dependencias, crea bases, inicia servidores ni certifica la instalación de otra computadora. Cada compañero debe comprobar health checks, cinco distritos, ingreso y recorrido móvil local.
