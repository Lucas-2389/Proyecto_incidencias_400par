# Despliegue funcional V1 — plan y procedimiento

Estado: **plan de primera instalación controlada; no desplegado**. El dominio, el servidor, las claves y los servicios Cloudflare aún deben ser elegidos y configurados por el propietario. Este documento usa `example.com` como marcador, nunca como URL real. El piloto DEMO de Ayacucho no sirve para atención de emergencias reales. El recorrido físico Android→panel→Android de OpenSpec aún tiene pasos pendientes; no publicar hasta cerrarlo o acordar expresamente una demostración limitada.

## 1. Arquitectura y servicios

```text
Android Flutter ──HTTPS──┐
                        ├── Cloudflare DNS / TLS / WAF ──HTTPS── API Node.js/Express
Panel React ────HTTPS───┘                                  │
   Cloudflare Pages (estáticos)                             ├── MySQL 9 en la misma VM, puerto loopback
                                                            └── volumen persistente para fotos
```

V1 usa una sola VM Linux para API y MySQL Docker Compose, con el puerto MySQL publicado solo en `127.0.0.1`. Un proxy inverso de la VM termina HTTPS para `api.example.com` y envía al Node local en `127.0.0.1:3000`; el firewall bloquea acceso público a `3000` y `3307`. Cloudflare Pages sirve el panel Vite en `admin.example.com`. El APK Flutter usa `https://api.example.com/api/v1`. No hay réplicas ni balanceador en V1. Fotos y base tienen respaldo y volumen persistente; ninguna carpeta efímera del contenedor es el almacén definitivo.

La topología deja MySQL dentro de la VM cloud y sin acceso directo desde Internet. Si más adelante se elige MySQL administrado en otra red, **revisar TLS de la conexión antes de migrar**: la configuración actual del pool no expone todavía una CA de MySQL. Esa variante no está validada por esta V1.

## 2. Nombres y DNS

Sustituir `example.com` por el dominio adquirido y añadirlo a Cloudflare con los nameservers que la cuenta indique. Propuesta de URL:

| Nombre | Destino | Uso |
| --- | --- | --- |
| `https://admin.example.com` | Proyecto Cloudflare Pages | Panel y login. |
| `https://api.example.com` | Registro A/AAAA proxied hacia la IP pública de la VM | API HTTPS; `/api/health` y `/api/health/database`. |
| `https://example.com`, `https://www.example.com` | Redirección a `admin.example.com` | Entrada principal hasta disponer de una portada pública. |

En Pages, crear proyecto vinculado al repositorio, directorio raíz `apps/admin`, comando `npm ci && npm run build`, salida `dist`, y agregar `admin.example.com` en **Custom domains**. El panel es SPA: comprobar acceso directo y recarga en `/login` y `/incidentes`. Configurar `VITE_API_BASE_URL=https://api.example.com/api/v1` y `VITE_OSM_TILE_URL` antes de compilar; las variables `VITE_` son públicas en el bundle. La documentación de [Cloudflare Pages para Vite](https://developers.cloudflare.com/pages/configuration/build-configuration/) y [dominios personalizados](https://developers.cloudflare.com/pages/configuration/custom-domains/) describe estos campos.

Crear `api` como A/AAAA proxied y verificar su resolución antes de abrir el panel. Cloudflare documenta el [alta de registros DNS](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/). El modo proxied es necesario para aplicar las reglas de caché de Cloudflare.

## 3. TLS, CDN y caché

Instalar en el proxy inverso de la VM un certificado válido para `api.example.com` (CA pública o Cloudflare Origin CA), abrir solo 443 y elegir **Full (strict)** en Cloudflare. Verificar que el certificado está vigente y coincide con el hostname; de otro modo Cloudflare puede responder 526. [Requisitos oficiales de Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

Crear una regla de **Bypass cache** para `api.example.com/*`, incluidos health, login, tokens, datos privados y públicos de la API. La API envía `Cache-Control: no-store` en `/api/v1` y health, pero la regla evita que una futura regla general de “cache everything” los incluya. Cachear solo los recursos estáticos con hash de Pages (`/assets/*`) según encabezados de origen. Mantener `index.html` con revalidación o TTL corto para que cargue el último bundle. Confirmar `CF-Cache-Status` en muestras privadas y estáticas. Cloudflare describe [Cache Rules y bypass](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/) y [problemas de login por caché](https://developers.cloudflare.com/cache/troubleshooting/dynamic-content-and-login-issues/).

## 4. Seguridad y bots

La API usa JWT de acceso con expiración de 15 minutos, refresh rotativo, bcrypt, comprobación RBAC por rol/sede, validación de entradas, límites de login/recuperación, errores genéricos, logs sin cuerpo ni tokens y usuario MySQL `incidencias_app`. V1 añade `APP_ENV=production`, `CORS_ORIGINS` explícito, URL pública HTTPS y encabezados `nosniff`, `DENY`, `no-referrer` y `Permissions-Policy`. El proxy inverso debe bloquear acceso directo al puerto Node. No sembrar cuentas DEMO en la base de datos pública destinada a usuarios reales.

Aplicar reglas WAF de Cloudflare para tráfico abusivo, observando falsos positivos. No activar **Bot Fight Mode** global a ciegas: Cloudflare indica que puede desafiar clientes API/móviles y que las reglas WAF no pueden omitirlo. Si el plan contratado ofrece Super Bot Fight Mode o controles por ruta, ensayar exclusiones para `api.example.com` antes de activar mitigación de bots. [Limitaciones oficiales](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/). Para la tarea de AI bots, documentar la política elegida (Search, Agent, Training) y capturar su configuración; verificar llamadas móviles tras cualquier cambio. [Políticas actuales de AI bots](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/).

La recuperación de contraseña actual usa `DEV_MAILBOX_DIR` como buzón de archivos local. Dejarlo **sin configurar** en producción, donde esa función responderá 503, o implementar un transporte de correo real antes de permitir autoservicio público. FCM también es opcional: los avisos internos persisten sin credenciales push. Los contactos, coberturas y unidades DEMO no deben confundirse con servicios oficiales. El bootstrap de cuentas institucionales fuera del seed DEMO no está documentado ni validado; una instalación con usuarios reales requiere resolverlo antes de abrir el registro público.

## 5. Variables por ambiente

| Variable | Desarrollo | Producción V1 |
| --- | --- | --- |
| `APP_ENV` | `development` | `production` |
| `PORT` | `3000` | `3000`, solo tras proxy/firewall |
| `DB_HOST`, `DB_PORT` | `127.0.0.1`, `3307` en Windows | `127.0.0.1`, puerto loopback de Compose en VM |
| `DB_NAME`, `DB_USER` | Base `_test` para validación, `incidencias_app` | `incidencias`, `incidencias_app` |
| `DB_PASSWORD`, `JWT_SECRET` | Secretos locales ignorados | Secretos únicos en archivo protegido o gestor de secretos |
| `CORS_ORIGINS` | Vacío si Vite usa proxy local | `https://admin.example.com` |
| `PUBLIC_API_URL` | Opcional | `https://api.example.com/api/v1` |
| `UPLOAD_CONFIGURATION`, `EVIDENCE_DIR` | `local`, `.local/evidence` | `local`, ruta absoluta sobre volumen persistente |
| `DEV_MAILBOX_DIR` | `.local/mailbox` | Sin definir hasta tener correo real |
| `VITE_API_BASE_URL` | `/api/v1` con proxy Vite | `https://api.example.com/api/v1` |
| Flutter `API_BASE_URL` | `10.0.2.2` o túnel ADB | `https://api.example.com/api/v1` |

Referencias: `apps/api/.env.production.example`, `apps/admin/.env.production.example`, `apps/api/.env.example` y `apps/admin/.env.example`. No subir los archivos `.env` con valores reales. El archivo `.env` raíz de Compose y `apps/api/.env` son independientes. La API rechaza `root` y valida variables de producción antes del arranque. `UPLOAD_CONFIGURATION=local` es la única modalidad implementada en V1; montar y respaldar `EVIDENCE_DIR` es obligatorio.

## 6. Procedimiento de instalación

1. Elegir dominio, VM Linux y su región; preparar firewall, acceso administrativo y copia de seguridad. Reservar almacenamiento persistente para Docker MySQL y fotos. Anotar IP y versión de imagen/código que se desplegará.
2. Instalar Node.js 20.19+ o 22.12+ (rango admitido por Vite 8), Docker Engine/Compose y proxy inverso en la VM. Clonar el commit validado. Crear `.env` raíz desde `.env.example` y `apps/api/.env` desde la plantilla de producción; asignar permisos de lectura solo a la cuenta de servicio. Usar claves distintas a las de las bases `_test`.
3. Ejecutar `docker compose config --quiet`, `docker compose up -d mysql` y esperar `healthy`. Verificar que MySQL solo escucha en loopback. Antes de la primera migración, tomar respaldo o snapshot del volumen. Revisar SQL de `apps/api/migrations` y ejecutar `npm --prefix apps/api ci` y `npm --prefix apps/api run db:migrate:app` explícitamente. Para una demostración de curso aislada, se pueden aplicar los seeds DEMO con `DEMO_PASSWORD` temporal y acceso restringido. No ejecutar seeds DEMO en datos reales.
4. Crear directorio absoluto `EVIDENCE_DIR` en volumen persistente, con permisos de escritura de la cuenta del proceso. Iniciar `npm --prefix apps/api start` mediante un supervisor (por ejemplo systemd) que reinicie tras fallo y cierre ordenadamente en `SIGTERM`. Configurar proxy inverso TLS para `api.example.com` hacia Node local. No publicar `3000` ni `3307` en el firewall.
5. Comprobar desde otra red `https://api.example.com/api/health` y `/api/health/database`. Crear DNS y dominio de Pages, definir `VITE_API_BASE_URL` de producción, desplegar el build React y probar login con una cuenta institucional de la demostración controlada. Si se usó el seed DEMO, restringir audiencia y etiquetar claramente esos datos; no reutilizar ese entorno para personas reales. Verificar recarga directa de rutas internas.
6. Compilar el APK para demostración con `flutter build apk --release --dart-define=API_BASE_URL=https://api.example.com/api/v1`, instalarlo directamente en un dispositivo de prueba y ejecutar un reporte ficticio completo. La firma de APK para distribución estable debe configurarse antes de compartirlo; no usar el APK debug como entrega pública.
7. Configurar Cloudflare DNS, Full (strict), reglas de caché y WAF; verificar tráfico Android y panel después de cada regla. Registrar las URLs y capturas reales en una copia de evidencias, sin secretos ni datos personales.

## 7. Pruebas posteriores y rollback

Comprobar: DNS y certificado; HTTP→HTTPS; health 200 y DB connected; preflight CORS solo para el panel; login/refresh/logout; permisos cruzados; reporte con GPS y foto; clasificación/asignación/estados; Mis reportes; mapa operativo, heatmap y directorio; auditoría; `Cache-Control: no-store` y `CF-Cache-Status` apropiado en API; JS/CSS de Pages; error 503 seguro si MySQL se interrumpe en entorno de ensayo; restauración de foto y base desde copia. No probar caída deliberada en producción activa.

Para rollback del panel, restaurar el despliegue anterior de Pages y su `VITE_API_BASE_URL`. Para API, conservar el artefacto/commit anterior, detener el servicio, restaurarlo y reiniciar tras comprobar compatibilidad con el esquema. Las migraciones MySQL no se revierten automáticamente: antes de cada cambio de esquema tomar respaldo consistente, documentar punto de recuperación y restaurar base y fotos juntos si el esquema anterior no es compatible. Verificar health, login y un reporte ficticio tras la restauración.

## 8. Evidencias para la tarea

Capturar: árbol DNS y estado proxied, dominio personalizado de Pages, configuración Full (strict) y certificado de origen sin clave, reglas CDN/caché, `CF-Cache-Status` de estático y API, reglas WAF/bots/AI bots, URL pública con candado HTTPS, health de API, panel login y módulos, APK en Android, recorrido ficticio de incidente y captura de auditoría. Ocultar IP privada, contraseñas, tokens, fotos de personas y coordenadas reales. Guardar fecha, commit y resultado de cada prueba.

## 9. Riesgos y decisiones pendientes

Faltan dominio y cuenta Cloudflare, VM/almacenamiento persistente, certificado de origen, cuentas no DEMO para la prueba pública, transporte de recuperación de contraseña, verificación de respaldo/restauración y cierre del recorrido E2E físico de `operational-mvp` (tarea 12.3). La topología de una VM tiene un único punto de fallo; el escalamiento horizontal y las pruebas de miles de usuarios quedan para una fase posterior. Las reglas de AI bots y caché se aplicarán solo tras comprobar que no afectan la API móvil. No hay publicación real ni URL final asignada en este cambio.
