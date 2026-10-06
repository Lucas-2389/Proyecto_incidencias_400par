# Tasks

## 1. Entorno local y punto de partida

- [x] 1.1 Revisar `apps/api`, `compose.yaml`, `.env.example`, `.gitignore`, README y OpenAPI; verificar con un inventario de archivos que la API aún no tiene código ejecutable ni dependencias que deban conservarse.
- [x] 1.2 Confirmar que Git ignora `.env` de la raíz y `apps/api/.env`, y que el ejemplo de Compose solo contiene valores ficticios; verificar con `git check-ignore` y revisión de los archivos versionados, sin leer ni publicar contraseñas reales.
- [x] 1.3 Confirmar MySQL 9.7.2 en Compose, puerto externo configurable y volumen persistente; verificar `docker compose config --quiet` y `docker compose ps`, sin ejecutar `down -v` ni recrear volúmenes.
- [x] 1.4 Actualizar la sección de entorno local del README con pasos PowerShell para iniciar, comprobar y detener MySQL sin perder el volumen, incluido el efecto de cambiar `MYSQL_*` tras la primera inicialización; verificar que los comandos documentados coinciden con `compose.yaml`.

## 2. Configuración y arranque técnico de la API

- [x] 2.1 Crear `apps/api/package.json` y lockfile con Express, `mysql2` y `dotenv` si aún no están instalados; verificar instalación con `npm --prefix apps/api ls --depth=0` y que no se añaden dependencias de dominio.
- [x] 2.2 Crear `apps/api/.env.example` con `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` de ejemplo; verificar que no contiene secretos reales y que `apps/api/.env` sigue ignorado por Git.
- [x] 2.3 Implementar carga de `apps/api/.env` por ruta explícita y configuración centralizada con prioridad de variables del proceso; verificar con pruebas que funciona desde distintos directorios y que no carga `MYSQL_ROOT_PASSWORD` del `.env` raíz.
- [x] 2.4 Validar variables requeridas, puertos entre 1 y 65535 y rechazo de `DB_USER=root` antes de escuchar HTTP; verificar con pruebas de valores ausentes, puertos inválidos y usuario root, sin mensajes que impriman secretos.
- [x] 2.5 Documentar en `apps/api/README.md` las variables de la API y la diferencia entre `127.0.0.1:3307` desde Windows y `mysql:3306` desde Docker; verificar que ambos destinos se eligen solo con `DB_HOST` y `DB_PORT`, sin instrucciones para editar código.

## 3. Pool y diagnóstico MySQL

- [x] 3.1 Crear un único pool `mysql2/promise` por proceso con límite de conexiones, espera acotada y credenciales del objeto de configuración; verificar con pruebas que varias comprobaciones reutilizan el pool y no crean una conexión independiente por petición.
- [x] 3.2 Implementar el diagnóstico de solo lectura mediante `SELECT 1` y liberación de la conexión al terminar; verificar con pruebas que devuelve éxito ante el resultado esperado y no ejecuta DDL, migraciones ni consultas a tablas funcionales.
- [x] 3.3 Implementar el cierre del pool con `end()` y la ruta de error de cierre; verificar con pruebas que el recurso se cierra una vez y que no quedan conexiones ocupadas tras comprobaciones consecutivas.

## 4. Endpoints técnicos, seguridad y documentación

- [x] 4.1 Crear el arranque mínimo de Express y `GET /api/health` sin consultar MySQL; verificar con pruebas HTTP que devuelve `200`, `{ "status": "ok" }` y `Cache-Control: no-store` incluso si el servicio de base falla.
- [x] 4.2 Implementar `GET /api/health/database` usando el diagnóstico real del pool en cada solicitud; verificar con pruebas HTTP que devuelve `200`, `{ "status": "ok", "database": "connected" }` y `Cache-Control: no-store` cuando `SELECT 1` funciona.
- [x] 4.3 Traducir MySQL no disponible, timeout, pool agotado y credenciales inválidas a HTTP `503` con código estable, mensaje genérico y `correlationId`; verificar con pruebas HTTP que los casos fallidos comparten el cuerpo público esperado y no devuelven errores del controlador.
- [x] 4.4 Añadir logging estructurado seguro de los fallos de health; verificar con pruebas que incluye `correlationId` y categoría de error, pero nunca `DB_PASSWORD`, cadena de conexión, usuario ni error bruto de MySQL.
- [x] 4.5 Conectar el cierre HTTP y `pool.end()` a `SIGINT`/`SIGTERM`; verificar con una prueba de proceso que deja de aceptar solicitudes y termina liberando el pool.
- [x] 4.6 Documentar los dos endpoints técnicos en `packages/contracts/openapi.yaml` con servidor propio de base `/`, conservando las rutas funcionales bajo `/api/v1`; verificar que el OpenAPI valida y que los paths efectivos son `/api/health` y `/api/health/database`.
- [x] 4.7 Actualizar README y `apps/api/README.md` con arranque de la API, configuración de `incidencias_app`, respuestas de ambos health checks y comandos de prueba desde PowerShell; verificar que los ejemplos son ejecutables y que ya no afirman que no existe servidor HTTP.

## 5. Integración y cierre de la Iteración 0

- [x] 5.1 Ejecutar la API desde Windows contra MySQL real en `127.0.0.1:3307`; verificar ambos health checks en `200` y confirmar mediante una consulta de solo lectura que la conexión usa `incidencias_app`, nunca `root`.
- [x] 5.2 Detener solo el servicio MySQL y verificar que `/api/health` permanece en `200` mientras `/api/health/database` pasa a `503`; reiniciar MySQL y verificar recuperación a `200` sin borrar el volumen.
- [x] 5.3 Probar credenciales inválidas en un proceso temporal y `DB_USER=root` al arrancar; verificar respectivamente `503` genérico y rechazo del arranque, sin secretos en respuestas ni logs.
- [x] 5.4 Ejecutar las comprobaciones finales de infraestructura y alcance: `docker compose config --quiet`, estado `healthy`, OpenAPI válido, volumen conservado y ausencia de tablas funcionales, migraciones, autenticación y rutas de negocio; registrar el resultado observable de cada comprobación.
- [x] 5.5 Ejecutar `openspec validate close-iteration-0 --strict`; verificar salida exitosa para los cuatro artefactos del change.
- [x] 5.6 Ejecutar `git status --short` y revisar el diff; verificar que solo aparecen cambios previstos, que ningún `.env` ni secreto está versionado y que el trabajo queda listo para revisión.

## Evidencia de verificación final

- `npm --prefix apps/api test`: 14 pruebas pasaron, 0 fallaron.
- `docker compose config --quiet`: terminó correctamente. `gestion-incidencias-mysql-1` usa `mysql:9.7.2`, quedó `healthy` y publica `127.0.0.1:3307->3306`.
- Volumen `gestion-incidencias_mysql_data`: fecha de creación `2026-10-05T20:48:56Z` antes y después del reinicio; no se recreó.
- Conexión de solo lectura: `CURRENT_USER()` devolvió `incidencias_app@%`; `SHOW TABLES` devolvió 0 tablas.
- OpenAPI: válido, 15 paths (13 del contrato futuro y 2 health checks técnicos). `apps/api/src` solo contiene configuración, pool, salud y ciclo de vida; `apps/admin` y `apps/mobile` siguen con README, sin código funcional.
