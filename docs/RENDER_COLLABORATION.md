# Colaboración y preparación de Render

## Estado actual y acceso (2026-10-08)

Panel y API desplegados, según la validación del propietario y las pruebas remotas de Flutter:

- Panel/login: https://gestion-incidencias-200e.onrender.com/login
- API funcional: https://gestion-incidencias-200e.onrender.com/api/v1
- Salud HTTP: `/api/health`; conexión MySQL: `/api/health/database`.
- Aiven: MySQL 8.4.8, base `incidencias`, usuario `incidencias_app`, TLS con CA y validación de certificado.
- Evidencias nuevas: Cloudinary; migración 011 aplicada.
- Flutter: configuración de producción centralizada, APK release de prueba generado y pruebas remotas de login, reporte y fotografía aprobadas. Commit `a20ac4c` publicado en `main`.

Las secciones de resultados anteriores se conservan como registros fechados; sus pendientes de publicación y configuración no representan el estado actual. No ejecutar seeds ni migraciones al iniciar Render. Para uso y cuentas, consultar [la guía de usuarios](USER_GUIDE.md).

## Publicación del panel mejorado (2026-10-08)

Se publica el panel con logo, avisos internos, mapa con pictogramas y agrupaciones, etiquetas en español, contacto telefónico autorizado y estilos. Incluye las dependencias de notificaciones del backend y el contrato actualizado. Flutter conserva cambios locales pendientes fuera de esta publicación.

Verificación del conjunto: 9 pruebas frontend aprobadas y build correcto en copia aislada del índice; 53 pruebas backend locales aprobadas (22 integraciones omitidas en esa ejecución); 5 comprobaciones adicionales con Aiven en incidencias_remote_test aprobadas, sin omisiones: ciclo multiinstitución, rollback, teléfono, reportes/idempotencia/notificaciones y permisos institucionales. Auditoría: 248 archivos actuales y 400 blobs históricos, 0 hallazgos. git diff --cached --check correcto. Las pruebas no escribieron en incidencias.

La publicación por GitHub activa el autodeploy configurado por el propietario en Render. El estado anterior descrito abajo corresponde a la preparación inicial.

## Estado verificado (2026-10-08)

Sin despliegue, push ni commits automáticos. Auditoría local: 241 archivos actuales y 385 blobs históricos alcanzables, 0 hallazgos; también se revisó el índice. La búsqueda compara secretos locales conocidos y patrones de claves privadas, tokens y URI con credenciales. No garantiza detectar secretos desconocidos, objetos inalcanzables ni referencias remotas que no estén disponibles localmente.

Backend: 49 aprobadas, 0 fallidas, 22 integraciones MySQL omitidas en esta ejecución. Frontend: 7 aprobadas, build correcto. Prueba HTTP del build: raíz, login, ruta profunda y asset correctos; API desconocida devuelve JSON 404; asset inexistente devuelve 404. Aiven: incidencias_app, incidencias, MySQL 8.4.8, TLS activo. Validación production correcta con JWT temporal y URLs HTTPS de prueba, sin escribir datos. Falta proporcionar JWT_SECRET definitivo y URLs reales en Render. Flutter conserva cambios anteriores, no modificados ni revalidados en esta preparación.

## Servicio único Render (Node nativo)

Root Directory: dejar vacío (raíz del monorepo). Usar Node 22, compatible con Vite y backend.

Build Command:

```sh
npm ci --prefix apps/api --omit=dev && npm ci --prefix apps/admin --include=dev && npm run build --prefix apps/admin
```

Start Command:

```sh
npm start --prefix apps/api
```

Health Check Path: `/api/health`. El servidor usa PORT y escucha en 0.0.0.0. No ejecutar migraciones ni seeds dentro de build/start. Migración 011 ya aplicada; revisiones futuras se gestionan explícitamente mediante el sistema existente.

React: `https://<servicio>.onrender.com/`, login `/login` y rutas profundas. API: `/api/v1`; diagnósticos `/api/health` y `/api/health/database`. React usa `/api/v1` del mismo origen; fijar VITE_API_BASE_URL para evitar que una configuración local de Vite se incruste en el build. Los assets compilados son desechables, no almacenamiento persistente. Fotos nuevas: Cloudinary; datos: Aiven. Las fotos locales antiguas requieren una transferencia explícita antes de depender de ellas en Render.

## Variables exactas

| Variable | Valor o procedencia |
| --- | --- |
| NODE_VERSION | 22 (runtime Render) |
| NODE_ENV | production (Node/Express y npm) |
| APP_ENV | production (activa validación y React estático) |
| PORT | provisto por Render; no fijar el puerto local |
| DB_HOST | host Aiven, sin URI |
| DB_PORT | puerto Aiven |
| DB_NAME | incidencias |
| DB_USER | incidencias_app |
| DB_PASSWORD | secreto en Render |
| DB_SSL | true |
| DB_CA_PATH | /etc/secrets/ca.pem |
| CLOUDINARY_CLOUD_NAME | cuenta Cloudinary |
| CLOUDINARY_API_KEY | valor privado de Cloudinary |
| CLOUDINARY_API_SECRET | secreto en Render |
| JWT_SECRET | secreto aleatorio exclusivo de producción, mínimo 32 caracteres |
| UPLOAD_CONFIGURATION | cloudinary |
| CORS_ORIGINS | https://<servicio>.onrender.com, solo origen, sin ruta |
| PUBLIC_API_URL | https://<servicio>.onrender.com/api/v1 |
| VITE_API_BASE_URL | /api/v1 (pública, build) |

VITE_OSM_TILE_URL es opcional: tiene valor por defecto OpenStreetMap. FCM_PROJECT_ID y GOOGLE_APPLICATION_CREDENTIALS son opcionales, únicamente si se configura Firebase push con credenciales ADC mediante otro Secret File. No habilitarlos todavía si no se usa FCM. No configurar DEV_MAILBOX_DIR, EVIDENCE_DIR, DB_TEST_NAME, RUN_MYSQL_INTEGRATION ni DEMO_PASSWORD en Render. La recuperación de contraseña necesita un canal de entrega de producción para completar ese flujo; el buzón local no está permitido en production.

## CA Aiven

Render → servicio → Environment → Secret Files → archivo `ca.pem`, contenido del CA descargado de Aiven. DB_CA_PATH=/etc/secrets/ca.pem. El código existente acepta rutas absolutas y relativas a apps/api, lee el CA sin imprimirlo y usa rejectUnauthorized=true. En local mantener ./certs/ca.pem para Aiven o DB_SSL=false para Docker. Nunca copiar el .env local completo a producción.

Documentación oficial: https://render.com/docs/configure-environment-variables y https://render.com/docs/web-services.

## Qué versionar y qué mantener privado

Versionar código, pruebas, lockfiles, migraciones, contratos, documentación, logo público y plantillas .env.example/.env.production.example. .gitignore protege .env y variantes reales, certificados, claves privadas, archivos de credenciales, .local, dependencias, builds, APK y android/local.properties. Las plantillas tienen ejemplos públicos o valores vacíos; no son configuraciones listas para arrancar.

Privados: apps/api/.env, .env de Compose, otros .env locales, certs/ca.pem, .local/*credentials*.json, contraseñas, JWT, claves Cloudinary/Firebase y credenciales de Render. No compartir estos archivos por Git. El compañero debe crear su propio .env a partir de la plantilla y recibir los accesos por un canal privado, preferentemente con una cuenta individual.

Si aparece un secreto en Git: detener publicación, revocarlo/rotarlo; quitarlo del índice con git rm --cached -- <archivo>, mantener regla ignore y sanear el historial coordinadamente antes de publicar. No reescribir historial compartido sin coordinarlo. Un commit que elimina un secreto no lo elimina de commits anteriores.

## Comandos de preparación de commits

Desde la raíz, revisar cada grupo antes de confirmar. No usar git add .; los directorios siguientes se revisaron y las exclusiones protegen los archivos locales. Estos comandos incluyen trabajo anterior, separado por módulo.

```sh
git add -- .gitignore .env.example README.md apps/api docs/AIVEN_SCHEMA_MIGRATION_REPORT.md
git diff --cached --check
git diff --cached --stat
git commit -m "feat(api): prepare Aiven TLS Cloudinary and Render web hosting"

git add -- apps/admin packages/contracts/openapi.yaml docs/LOCAL_DEMO.md
git diff --cached --check
git diff --cached --stat
git commit -m "feat(admin): improve incident maps notifications and reporting"

# Cambios Flutter anteriores: revisar y ejecutar flutter test antes de este commit.
git add -- apps/mobile/README.md apps/mobile/android/gradle/wrapper/gradle-wrapper.properties apps/mobile/lib/screens/report.dart apps/mobile/test/report_test.dart
git diff --cached --check
git commit -m "feat(mobile): improve citizen incident reporting"

git add -- docs/RENDER_COLLABORATION.md
git commit -m "docs: document collaboration and Render configuration"
git status
```

Los commits API y admin forman un conjunto: el primero integra React cuyo build se entrega con el segundo. Publicar ambos conjuntamente después de revisar. No subir automáticamente. Para colaborar, invitar al compañero desde GitHub Settings → Collaborators, desarrollar en ramas y usar pull requests; no compartir credenciales personales de GitHub o Render.

## Validación reproducible

```sh
npm ci --prefix apps/api --include=dev
npm ci --prefix apps/admin --include=dev
npm run build --prefix apps/admin
npm test --prefix apps/api
npm test --prefix apps/admin
node apps/api/scripts/check-production-config.js
node apps/api/scripts/check-db-connection.js
node apps/api/scripts/audit-git-secrets.js
git diff --check
git status
```

check-production-config simula APP_ENV=production sin alterar el .env, deshabilita el buzón local para la comprobación y exige la CA legible, TLS, incidencias_app, incidencias y Cloudinary; los demás secretos y URLs deben estar configurados. No prueba acceso remoto ni sustituye un arranque real. db:check comprueba la conexión real por separado. Las integraciones que escriben datos se habilitan solamente con DB_TEST_NAME aislada y RUN_MYSQL_INTEGRATION=1; nunca con la base operativa como destino de pruebas.

Código listo para configurar Render. El despliegue requiere todavía cargar las variables privadas, el CA, JWT definitivo y URLs reales, además de validar los accesos/datos de referencia necesarios para operar. No se desplegó nada en esta preparación.
