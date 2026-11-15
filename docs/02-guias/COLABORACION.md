# Instalar y colaborar desde otra computadora

Guía para `Lucas-2389/Proyecto_incidencias_400par`, preparada el 2026-10-15. Se prepara el trabajo conjunto; todavía no se implementa escalamiento horizontal.

## 1. Acceso y copia del repositorio

El repositorio es público: puede clonarse sin ser colaborador. Para enviar ramas al mismo repositorio, el propietario invita al compañero desde **Settings → Collaborators → Add people** y este acepta la invitación. El propietario gestionará esa invitación. No compartir contraseña de GitHub, token personal ni cuentas de infraestructura.

En PowerShell:

```powershell
git clone https://github.com/Lucas-2389/Proyecto_incidencias_400par.git
Set-Location Proyecto_incidencias_400par
git status -sb
```

Usar **Code → Download ZIP** sirve para leer una copia, pero no incluye el historial ni la configuración de Git necesaria para colaborar. Para desarrollar, usar `git clone`.

## 2. Requisitos

- Git y Node.js 22, como indica `.nvmrc`; usar 22.12 o posterior por Vite. npm viene con Node.
- Docker Desktop iniciado y Docker Compose disponible, para un MySQL propio.
- Flutter 3.38.3 y Android SDK únicamente si trabajará en la app; consultar `apps/mobile/README.md`.
- OpenSpec CLI para planificar el siguiente change; comprobar `openspec --version`. No es necesario para arrancar la API y React.

```powershell
git --version
node --version
npm --version
docker compose version
```

No ejecutar `npm install` en la raíz: este repositorio tiene paquetes separados en `apps/api` y `apps/admin`.

## 3. Configuración privada para un clon nuevo

```powershell
./scripts/init-local.ps1
# Si 3307 está ocupado y esta es una instalación nueva:
# ./scripts/init-local.ps1 -MySqlPort 3308
```

El script crea `.env`, `apps/api/.env` y `apps/admin/.env` desde las plantillas, con contraseñas aleatorias diferentes para MySQL administrador, usuario de aplicación, JWT y cuentas DEMO. La contraseña de `incidencias_app` coincide en Compose y API. No imprime valores, no descarga dependencias, no ejecuta Docker y no toca bases de datos. Si **cualquiera** de los archivos ya existe, se detiene antes de escribir: no usarlo para reemplazar configuraciones existentes.

| Archivo | Uso | Se versiona |
| --- | --- | --- |
| `.env` | Docker MySQL propio | No |
| `apps/api/.env` | API local, cuenta MySQL y `DEMO_PASSWORD` local | No |
| `apps/admin/.env` | Proxy del panel a la API local | No |
| Plantillas `.env.example` y `.env.production.example` | Ejemplos sin secretos reales | Sí |
| Certificados, `.local`, dependencias, builds y firmas Android | Archivos de cada equipo | No |

La instalación nueva usa `DB_SSL=false`, `127.0.0.1`, el puerto elegido, base `incidencias` **local**, usuario `incidencias_app` y `UPLOAD_CONFIGURATION=local`. Las fotos locales solo sirven en esa máquina; producción mantiene Aiven TLS y Cloudinary. No copiar el `.env` del propietario ni las credenciales de Render.

Alternativa manual: copiar las tres plantillas, cambiar todos los marcadores de contraseña y generar `JWT_SECRET` aleatorio de al menos 32 caracteres. Hacer coincidir `MYSQL_PASSWORD` con `DB_PASSWORD` y `MYSQL_PORT` con `DB_PORT`. `DEMO_PASSWORD` debe tener al menos 12 caracteres y solo se utiliza en el seed explícito.

## 4. Preparar la base propia

En el clon nuevo, con las variables locales del paso anterior:

```powershell
docker compose config --quiet
docker compose up -d mysql
docker compose ps
npm ci --prefix apps/api --include=dev
npm ci --prefix apps/admin --include=dev
npm run db:check --prefix apps/api
```

Esperar `healthy`. `db:check` debe identificar `incidencias_app`, base local `incidencias` y TLS desactivado en este caso. Antes de continuar, confirmar en **tu archivo privado** que `DB_HOST=127.0.0.1` y `APP_ENV=development`; variables heredadas de la terminal tienen prioridad sobre `.env`. Usar una terminal nueva sin variables de Aiven/producción.

Solo sobre esa base Docker propia:

```powershell
npm run db:migrate:app --prefix apps/api
npm run db:seed:demo:app --prefix apps/api
```

Son los scripts existentes del proyecto; no se improvisa SQL ni se usan credenciales administrativas desde Node. El seed crea datos ficticios de Municipalidad, PNP, SAMU y Bomberos. Leer `DEMO_PASSWORD` en el `.env` propio para las cuentas de [la guía de usuarios](USUARIOS.md); no pegarlo en chats, capturas ni PR. Repetir el seed no restablece contraseñas existentes.

Si Docker ya tenía un volumen de este proyecto, las variables nuevas no cambian las cuentas existentes. No borrar ni recrear volúmenes para corregirlo. Revisar la configuración previa con su responsable.

## 5. Arrancar API y panel

Terminal 1, desde la raíz:

```powershell
npm start --prefix apps/api
```

Terminal 2:

```powershell
npm run dev --prefix apps/admin
```

Terminal 3:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
Invoke-RestMethod http://127.0.0.1:3000/api/health/database
```

Abrir http://127.0.0.1:5173/login. API funcional: http://127.0.0.1:3000/api/v1. React usa `/api/v1` mediante el proxy de Vite. No es necesario abrir puertos públicos ni cambiar Cloudflare.

Para detener: Ctrl+C en API y panel; `docker compose down` conserva la base. No ejecutar `docker compose down -v` como parte del flujo normal.

## 6. Android y pruebas

Android reporta como invitado, sin login. La documentación vigente es [la guía móvil](../../apps/mobile/README.md); las guías antiguas de instalación de esta estación no son un requisito para el compañero. El APK release apunta a Render si no se selecciona explícitamente desarrollo. Para desarrollar contra tu API, usar `APP_ENV=development` y una URL alcanzable desde el dispositivo.

```powershell
Set-Location apps/mobile
flutter pub get
flutter analyze
flutter test
# Emulador Android, API local en el PC:
flutter run --dart-define=APP_ENV=development --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

Las comprobaciones backend/web y ramas están en [CONTRIBUTING.md](../../CONTRIBUTING.md). El CI compila React antes del test de servidor y no necesita secretos. No ejecuta integraciones MySQL ni pruebas remotas que escriban datos. Para integraciones, provisionar una base aislada terminada en `_test`, con permisos de la cuenta de aplicación, y usar los scripts `*:test`. No usar `incidencias` operativa ni Aiven de producción como base de pruebas.

## 7. Revisión y entrega

Cada persona crea una rama `codex/<tarea>` diferente y un PR hacia `main`. Repartir tareas por archivos/módulos para reducir conflictos. Documentar requisito SDD, change OpenSpec y pruebas reales en la descripción. El propietario revisa e integra; invitar a GitHub no da acceso a Render/Aiven/Cloudinary.

El repositorio incluye un workflow `Repository checks` y plantilla de PR. La guía no configura automáticamente protección de rama: el propietario puede exigir PR, una revisión y el check `backend-and-web` en **Settings → Rules → Rulesets** después de la primera ejecución satisfactoria. Deshabilitar force push y borrado de `main` al configurar la regla. Integrar o publicar en `main` puede activar Render; las ramas de trabajo no deben usarse como rama de despliegue.

## Preparación del escalamiento horizontal

Antes de implementar, crear un change OpenSpec específico con diseño, specs y tareas. Propuesta de reparto para discutir entre ambos:

| Área | Trabajo a diseñar y verificar |
| --- | --- |
| Infraestructura | Varias instancias API, balanceador, health checks y cierre ordenado; primera prueba fuera de producción. |
| Estado compartido | Confirmar sesiones, rate limits e idempotencia en MySQL y evitar estado necesario solo en memoria. |
| Archivos | Cloudinary compartido en las instancias; no usar el almacén local para producción. |
| Conexiones MySQL | Dimensionar el total de conexiones de todos los pools frente al límite de Aiven; gestionar TLS y accesos. |
| Concurrencia | Asignaciones, refresh, límite de fotos y reintentos cuando las solicitudes llegan a instancias distintas. |
| Validación | Prueba entre instancias, métricas, rollback y carga progresiva en pruebas; 1k–5k usuarios no está validado todavía. |

No introducir Redis, Kubernetes, nuevas cuentas remotas ni pruebas de carga en producción como parte de esta preparación. Las limitaciones del servicio se revisarán al diseñar el change.

## Problemas frecuentes

| Síntoma | Revisión |
| --- | --- |
| `git push` rechazado | Aceptar invitación y autenticar Git con cuenta propia; no usar la contraseña del dueño. |
| `npm` no encuentra package.json | Ejecutar desde la raíz con `--prefix apps/api` o `--prefix apps/admin`. |
| CORS 403 | Revisar origen/configuración del ambiente; no desactivar CORS en producción. |
| API no conecta a MySQL | Docker `healthy`, puerto y credenciales del volumen existente. |
| Test estático falla por index.html ausente | Ejecutar build de React antes del test backend. |
| Faltan fotos en el clon | Las fotos y bases no se descargan con Git; crear datos DEMO y fotos propios. |
| `init-local.ps1` detecta `.env` existente | Es una protección. Conservarlo y revisar manualmente; no borrar configuraciones. |

## Validación de esta preparación — 2026-10-15

Se exportó el contenido de Git a una copia aislada sin los `.env` del propietario y se incorporaron los archivos de preparación. Se instalaron dependencias desde ambos lockfiles con `npm ci`.

- Build React: correcto.
- Backend: 54 aprobadas, 0 fallidas; 22 integraciones MySQL omitidas, no contadas como aprobadas.
- React: 15 aprobadas, 0 fallidas. Se limitaron workers y esperas asíncronas para equipos lentos, conservando todas las aserciones.
- OpenAPI: 58 rutas y 4 roles válidos.
- Inicializador: probado con Windows PowerShell en otra copia aislada; coherencia del puerto/contraseña, claves aleatorias distintas, salida sin secretos y rechazo de sobrescritura comprobados.
- Auditoría por lotes del árbol, índice y 461 blobs históricos alcanzables: sin coincidencias con secretos locales conocidos ni patrones comprobados. No garantiza detectar secretos desconocidos ni objetos inalcanzables.
- `git diff --check` y revisión de exclusiones: correctos.

La ejecución local usó Windows y Node.js 24.11.1. El workflow configura Node 22; su resultado se consulta por separado en GitHub Actions. Docker Desktop estaba apagado: no se inició un MySQL nuevo ni se ejecutaron migraciones/seeds o pruebas de carga, y no se accedió a las bases de producción. Flutter no se modificó en esta preparación.
