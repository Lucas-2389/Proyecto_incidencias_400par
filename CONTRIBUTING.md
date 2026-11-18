# Trabajar juntos

Repositorio: https://github.com/Lucas-2389/Proyecto_incidencias_400par

## Clonar y ejecutar

Sigue [la instalación para un compañero](docs/02-guias/COLABORACION.md). Cada desarrollador usa sus propios `.env`, MySQL local y contraseñas. No necesitas acceso a Render, Aiven ni Cloudinary de producción para comenzar. No hay `package.json` raíz: ejecuta npm con `--prefix` para cada aplicación.

La primera instalación incluye configuración privada, dependencias, migraciones, carga de los cinco distritos y seed DEMO. No repetir esos pasos en cada arranque. En PowerShell usar `npm.cmd` para evitar restricciones sobre `npm.ps1`.

Con la instalación lista, desde la raíz:

| Terminal | Comandos |
| --- | --- |
| 1: MySQL y API | `docker compose up -d mysql`, comprobar `docker compose ps` hasta ver `healthy`, después `npm.cmd start --prefix apps/api`. |
| 2: panel | `npm.cmd run dev --prefix apps/admin -- --strictPort`. Abrir `http://127.0.0.1:5173/login`. |
| 3: móvil USB, opcional | `powershell -ExecutionPolicy Bypass -File .\scripts\run-mobile-local.ps1`, con teléfono autorizado y API activa. |

Comprobar `http://127.0.0.1:3000/api/health/database` antes de probar reportes. API y panel mantienen sus terminales abiertas. Ctrl+C los detiene; no borrar el volumen MySQL para cerrar la jornada. Consultar [actualización del clon](docs/02-guias/COLABORACION.md#8-actualizar-el-clon-después-del-trabajo-del-compañero) al recibir migraciones, dependencias o variables nuevas.

## Una rama por cambio

```powershell
git switch main
git pull --ff-only origin main
git switch -c codex/descripcion-del-cambio
# Editar, ejecutar las comprobaciones y revisar el diff.
git status --short
git diff --check
git diff
git add -- ruta/al/archivo1 ruta/al/archivo2
git diff --cached --check
git diff --cached --stat
git commit -m "feat: describe el cambio"
git push -u origin codex/descripcion-del-cambio
```

Abrir un Pull Request hacia `main` y pedir revisión al compañero. No usar `git add .` de forma rutinaria; seleccionar archivos revisados. No hacer force push en `main`. Actualizar la rama compartida con `git merge origin/main` después de `git fetch origin`; resolver conflictos localmente y volver a probar. Las ramas personales pueden rebasarse antes de compartirse, coordinándolo si ya las usa otra persona.

`main` está conectado al autodeploy de Render. El propietario integra los PR aprobados; un push a esa rama puede desplegar. La plantilla de PR no sustituye la autorización del propietario ni activa reglas de protección por sí sola.

## SDD y OpenSpec

Leer primero el [SRS](docs/01-entrega/SRS.md), después el [SDD](docs/01-entrega/SDD.md), el [contrato](packages/contracts/openapi.yaml) y las specs del cambio seleccionado. Registrar requisitos, comportamiento verificable y diseño antes de implementar nuevas capacidades. Las tareas pertenecen a OpenSpec, fuera del SDD: marcar únicamente trabajo ejecutado y comprobado. Completar las verificaciones antes del archivo; si el responsable autoriza archivar con pendientes, conservarlos explícitos y acordar su seguimiento.

```powershell
openspec list --json
openspec status --change <nombre>
openspec validate <nombre> --strict
```

No iniciar todavía el escalamiento como parte de esta preparación. Las áreas que deberán diseñarse y repartirse están en [la guía de colaboración](docs/02-guias/COLABORACION.md#preparación-del-escalamiento-horizontal).

## Comprobaciones del PR

```powershell
npm.cmd --prefix apps/admin run build
npm.cmd --prefix apps/api test
npm.cmd --prefix apps/api run contract:check
npm.cmd --prefix apps/admin test
git diff --check
```

Construir React **antes** del test backend: la prueba de servido estático necesita `apps/admin/dist/index.html`. GitHub Actions ejecuta estas comprobaciones sin secretos ni conexiones a producción. Las integraciones MySQL son optativas y se ejecutan únicamente en una base aislada terminada en `_test`; un test omitido no cuenta como aprobado.

El backend ejecuta como máximo dos archivos de prueba simultáneos y React usa un solo worker, para evitar saturar equipos de desarrollo y disparar los tiempos máximos de arranque. No cambian los permisos ni omiten comprobaciones.

Las comprobaciones asíncronas de React esperan como máximo 5 segundos y cada prueba tiene un límite de 15 segundos; conservan sus aserciones. La opción `asyncUtilTimeout` está documentada por [Testing Library](https://testing-library.com/docs/dom-testing-library/api-configuration/#asyncutiltimeout).

Si cambia Flutter, ejecutar `flutter pub get`, `flutter analyze` y `flutter test` dentro de `apps/mobile`. Las pruebas remotas de Flutter crean reportes y fotos reales DEMO; no activarlas contra producción durante el CI ni como parte de una instalación normal.

## Secretos y datos

Versionar código, pruebas, migraciones, lockfiles, contratos, documentación y plantillas. Mantener privados `.env`, certificados, credenciales, APK, firmas Android y `.local`. No pasar secretos por issues, PR, commits ni capturas. El acceso al repositorio no concede acceso a las cuentas del panel ni a la infraestructura.

Antes de compartir, puede ejecutarse `node apps/api/scripts/audit-git-secrets.js`: revisa árbol, índice e historial alcanzable local y solo informa archivos/motivos, no valores. Compara también con secretos del `.env` propio; no garantiza detectar secretos desconocidos. Si uno fue publicado, revocarlo/rotarlo y coordinar el saneamiento del historial; eliminarlo en un commit nuevo no borra el anterior.
