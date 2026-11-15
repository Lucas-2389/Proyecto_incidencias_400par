# Operación del piloto en Render

Procedimiento documental del servicio único React + API. Para desarrollar localmente consultar [colaboración](COLABORACION.md); para comprender la arquitectura, el [SDD](../01-entrega/SDD.md). Los resultados de preparación del 08 de octubre están en el [historial de despliegue](../04-historial/PLAN_DESPLIEGUE_INICIAL.md).

## Acceso y dependencias

- Panel: https://gestionincidencias.cfd/login; origen Render: https://gestion-incidencias-200e.onrender.com/login.
- API: `/api/v1`; salud HTTP: `/api/health`; salud MySQL: `/api/health/database`.
- Base operativa: Aiven `incidencias`, usuario de aplicación y TLS verificado. Base de pruebas separada.
- Fotos nuevas: Cloudinary privado, sin dependencia de disco persistente.
- Android reporta sin login; el panel exige autenticación institucional. Consultar [usuarios](USUARIOS.md).

Esta revisión no modifica el servicio ni comprueba su disponibilidad en vivo. No ejecutar seeds o migraciones durante el arranque normal. No compartir secretos de producción con quien solo necesite un entorno local.

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

## Publicar cambios mediante revisión

Seguir [CONTRIBUTING](../../CONTRIBUTING.md): revisar el diff, seleccionar archivos concretos y abrir un pull request. Los comandos de commits propuestos en octubre para agrupar trabajo ya publicado se retiraron de esta guía porque no corresponden a cambios nuevos. No volver a ejecutar seeds ni migraciones como parte del arranque o de una limpieza documental.

Un push o integración en la rama conectada puede activar el despliegue automático de Render. Coordinar la publicación; no compartir credenciales personales. El compañero puede desarrollar con su propia base local siguiendo [colaboración](COLABORACION.md).

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
