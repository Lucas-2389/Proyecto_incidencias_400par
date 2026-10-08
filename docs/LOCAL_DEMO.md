# Prueba local de todos los módulos

Esta guía usa datos ficticios de Ayacucho. En esta estación ya existe la base aislada `incidencias_e2e2_test` con PNP, SAMU, Bomberos y Municipalidad. No se necesita volver a sembrarla para iniciar el panel. La base operativa `incidencias` queda separada.

## Arranque en esta estación (PowerShell)

Abrir tres terminales en la raíz del repositorio:

```powershell
# Terminal 1: MySQL
docker compose up -d mysql
docker compose ps
```

```powershell
# Terminal 2: API con la base de pruebas y la clave local ya usada al sembrar
Set-Location apps/api
$creds = Get-Content .local/e2e-credentials.json -Raw | ConvertFrom-Json
$env:DB_NAME = 'incidencias_e2e2_test'
$env:JWT_SECRET = $creds.jwtSecret
$env:EVIDENCE_DIR = '.local/evidence'
$env:DEV_MAILBOX_DIR = '.local/mailbox'
npm start
```

```powershell
# Terminal 3: panel React
npm --prefix apps/admin run dev
```

Comprobar `http://127.0.0.1:3000/api/health/database` y abrir [el panel local](http://127.0.0.1:5173/login). El archivo `.local/e2e-credentials.json` se ignora en Git y solo existe en esta estación; no copiar su contenido a documentación ni a commits. La contraseña de las cuentas DEMO es la propiedad `demoPassword` de ese archivo. La API usa el usuario MySQL `incidencias_app` configurado en `apps/api/.env`, nunca `root`.

## Cuentas y módulos

| Cuenta | Módulos visibles |
| --- | --- |
| `superadmin@demo.invalid` | Dashboard, Incidentes, Mapa, Instituciones, Unidades, Personal, Directorio e Historial de todas las instituciones. Puede crear instituciones y sedes. |
| `admin-municipalidad@demo.invalid` | Los módulos administrativos y operativos de su ámbito municipal; puede crear sedes, unidades y personal desde el panel. La API permite gestionar operadores de su ámbito. |
| `operator-municipalidad@demo.invalid` | Dashboard, Incidentes y Mapa de su ámbito; puede gestionar la atención autorizada. |
| `admin-pnp@demo.invalid`, `admin-samu@demo.invalid`, `admin-bomberos@demo.invalid` | Los mismos módulos administrativos, limitados a su institución. |
| `operator-pnp@demo.invalid`, `operator-samu@demo.invalid`, `operator-bomberos@demo.invalid` | Los módulos operativos, limitados a su institución y sede. |

El seed ya aporta la Municipalidad/Serenazgo Ayacucho, su Base Serenazgo, la unidad `DEMO-MUN-01`, un sereno y tres incidentes `DEMO-AY-001` a `DEMO-AY-003`. Para probar creación, entrar como SuperAdministrador, abrir **Instituciones** y agregar una institución de tipo `municipalidad`; luego agregar su sede con coordenadas de prueba. Para probar gestión municipal, salir y entrar como `admin-municipalidad@demo.invalid`, abrir **Unidades** o **Personal** y agregar un registro de ejemplo en `DEMO Base Serenazgo`. Se recomienda usar nombres con prefijo `DEMO`.

## Primera instalación en otra máquina

Crear los `.env` a partir de sus `.env.example` y configurar contraseñas locales propias. El `DB_TEST_NAME` debe terminar en `_test` y ser distinto de `DB_NAME`. Ejecutar migraciones y seed solo sobre la base aislada elegida:

```powershell
$env:DB_TEST_NAME = 'incidencias_demo_test'
$env:DEMO_PASSWORD = '<contraseña-local-de-al-menos-12-caracteres>'
npm --prefix apps/api run db:migrate:test
npm --prefix apps/api run db:seed:demo:test
```

La base aislada debe existir y el usuario `incidencias_app` debe tener permisos en ella. Después iniciar la API con `DB_NAME=incidencias_demo_test`, un `JWT_SECRET` local seguro, y el panel como se indica arriba. El seed es idempotente; repetirlo no restablece contraseñas de cuentas ya creadas.

## App Android

Con el teléfono conectado y autorizado por ADB, mantener la API en ejecución, abrir otra terminal y ejecutar:

```powershell
& 'C:\Users\CompuCraft Hp i5\AppData\Local\Android\Sdk\platform-tools\adb.exe' devices
& 'C:\Users\CompuCraft Hp i5\AppData\Local\Android\Sdk\platform-tools\adb.exe' reverse tcp:3000 tcp:3000
Set-Location apps/mobile
& 'C:\src\flutter\bin\flutter.bat' pub get
& 'C:\src\flutter\bin\flutter.bat' run --dart-define=API_BASE_URL=http://127.0.0.1:3000/api/v1
```

Si se usa un emulador, la URL de la API es `http://10.0.2.2:3000/api/v1` y no hace falta `adb reverse`. La app móvil tiene acceso ciudadano, no un módulo de administración institucional. En **Perfil** se puede iniciar sesión como `citizen@demo.invalid` con la misma contraseña DEMO. Actualmente ADB no detecta un Android; conectarlo y aceptar la autorización USB antes de ejecutar `flutter run`.

Para detener el panel y la API usar Ctrl+C en sus terminales. `docker compose down` detiene MySQL y conserva el volumen; no usar `down -v` para una parada normal.
