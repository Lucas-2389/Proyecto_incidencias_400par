> **Registro histórico.** Describe una estación o diagnóstico anterior; para instalar hoy usar la [guía de colaboración](../02-guias/COLABORACION.md).

# Diagnóstico de pantalla blanca — 2026-10-08

## Causa confirmada posteriormente (16:24 UTC)

La captura del navegador permitió reproducir el fallo añadiendo `Origin: https://gestionincidencias.cfd` a curl. Tanto JS como CSS devuelven HTTP 403, Content-Type `application/json`, cuerpo `{"code":"ORIGIN_NOT_ALLOWED","message":"Origen no permitido"}`. `/api/health` también devuelve 403 con ese Origin. Las solicitudes anteriores sin Origin no reproducían el comportamiento del navegador.

La causa es Express: `cors(httpConfig.corsOrigins)` estaba montado globalmente, antes del frontend. La configuración desplegada no admite el nuevo dominio. El mensaje de MIME es consecuencia de recibir el JSON del bloqueo en lugar de CSS. No es un Service Worker ni un asset perdido en esta reproducción.

Corrección local: `apps/api/src/app.js` limita CORS a `/api`; los archivos públicos dejan de depender de la lista de orígenes. La API conserva sus restricciones. La prueba de producción reproduce GET/HEAD del HTML, JS y CSS con el Origin nuevo y una lista configurada que solo contiene Render; comprueba 200 estático y 403 de API para el origen aún no autorizado.

Para poder iniciar sesión y operar desde el dominio, también se debe agregar el origen real a `CORS_ORIGINS` en Render, conservando los orígenes autorizados existentes. Ejemplo si solo se usa dominio raíz y URL Render: `https://gestionincidencias.cfd,https://gestion-incidencias-200e.onrender.com`. No incluir `/`, `/api/v1`, comodines ni `www` salvo que ese host también se utilice. No se modificó esa variable ni se desplegó automáticamente. Se requiere aplicar la configuración para la API y publicar la corrección de código para el servido público.

Validación posterior: build React correcto; backend 53 aprobadas, 0 fallidas, 22 integraciones MySQL omitidas; `git diff --check` correcto. Los apartados siguientes conservan el diagnóstico inicial y sus limitaciones.

## Comparación pública (16:17 UTC)

Se descargaron con curl los HTML del dominio `https://gestionincidencias.cfd/` y de `https://gestion-incidencias-200e.onrender.com/`. Se ejecutó `findstr "assets"` en ambos; los archivos quedan en `.local/web-cache-diagnostic/`, ignorados por Git.

Ambos HTML son idénticos (SHA256 `FB464D8DDCFABCDD710BE736791FA29F262EF5381FED6226F4EDF2AE3D333E2A`) y referencian `/assets/index-Dzyvpe-J.js` y `/assets/index-BaTicyZN.css`.

Los resultados siguientes coinciden en ambos hosts, tanto GET como HEAD:

| Recurso | HTTP | Content-Type | Cache-Control | ETag |
| --- | --- | --- | --- | --- |
| `/` | 200 | text/html; charset=utf-8 | no-cache | W/"1b3-1a11c3f7c08" |
| `/assets/index-Dzyvpe-J.js` | 200 | text/javascript; charset=utf-8 | public, max-age=0 | W/"4b833-1a11c3f7c08" |
| `/assets/index-BaTicyZN.css` | 200 | text/css; charset=utf-8 | public, max-age=0 | W/"6866-1a11c3f7c08" |

En ambas URLs: `Server: cloudflare`, `cf-cache-status: DYNAMIC`, `x-render-origin-server: Render`. La URL directa de Render también pasa por su infraestructura Cloudflare; ese header no identifica por sí solo la zona Cloudflare del propietario. No se observaron diferencias de contenido, MIME, ETag ni política de caché; cambian fecha e identificadores de petición.

El JS descargado en ambos hosts tiene SHA256 `65E4CA39DD8FB22C2C33FB1610420BD0D52C762D359B4E69389758F8E2985B4A`. El asset anterior `/assets/index-CnzkMDun.js` devuelve 404. `/index.html` devuelve 200 con `public, max-age=0` en el despliegue actual.

## Conclusión y límites

No se encontró una discrepancia del build ni un fallo actual de servido estático con curl. El HTML de `/` ya exige revalidación; las respuestas observadas no son un HIT de caché Cloudflare. Un HTML anterior que pida un JS eliminado sí puede producir pantalla blanca, pero esto no demuestra que sea la única causa actual.

En la comprobación del navegador integrado, Render directo mostró la portada; el dominio quedó con `#root` vacío, sin errores capturados por la herramienta. Por tanto, no se certifica que sea exclusivamente caché del navegador ni se atribuye una causa exacta a Cloudflare sin observar Network/Console del navegador afectado. No se encontró registro de Service Worker en el código React.

## Ajuste mínimo preparado, sin publicar

`apps/api/src/frontend.js`: todos los HTML, incluido `/index.html`, usan `no-cache`. Solo JS/CSS bajo `assets` con nombre hash reciben `public, max-age=31536000, immutable`. Los demás archivos conservan la política predeterminada y las rutas API siguen excluidas del fallback. Esto uniforma headers y optimiza assets; no se presenta como solución demostrada a la pantalla blanca.

`apps/api/test/production-web.test.js`: verifica HTML y rutas SPA, GET/HEAD de JS y CSS, MIME, ETag, caché y separación API. Resultado: backend 53 aprobadas, 0 fallidas, 22 integraciones MySQL omitidas; build React correcto; `git diff --check` correcto. No se modificaron DNS, CORS, Aiven ni Cloudinary; no hubo deploy.

## Limpiar el navegador afectado

1. Abrir `https://gestionincidencias.cfd` y pulsar F12.
2. **Application → Storage**: seleccionar los datos del sitio y pulsar **Clear site data**. Esto puede cerrar la sesión del sitio.
3. **Application → Service Workers**: si existe uno registrado para este dominio, pulsar **Unregister**. Si no hay ninguno, omitir.
4. **Network**: activar **Disable cache** con DevTools abierto.
5. Mantener pulsado el botón de recarga y elegir **Empty Cache and Hard Reload**, o pulsar Ctrl+Shift+R.
6. Confirmar que se solicitan los hashes actuales y no los antiguos. Si continúa blanca, revisar las peticiones JS/CSS: estado, MIME, cuerpo, tamaño, origen de caché y primer error rojo de Console. Compartir esos datos sin cookies, tokens ni contraseñas.

La limpieza permite confirmar o descartar caché local; no es necesario cambiar DNS ni desactivar TLS.
