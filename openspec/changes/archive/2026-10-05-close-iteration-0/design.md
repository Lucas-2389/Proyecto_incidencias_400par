# Design: cierre de la Iteración 0

## Context

Ver [proposal.md](proposal.md) para el motivo y las specs `local-development-environment` y `database-connectivity` para el comportamiento requerido. El repositorio tiene `compose.yaml` con MySQL 9.7.2, un OpenAPI de rutas funcionales futuras bajo `/api/v1` y solo un README en `apps/api`. En la instalación Windows confirmada, Docker publica MySQL en `127.0.0.1:3307`; dentro de la red de Compose, el servicio se denomina `mysql` y escucha en `3306`.

El SDD fija Node.js + Express, MySQL, variables de entorno y un backend modular (ADR-01, ADR-03, ADR-04; RNF-13, RNF-14). Aunque la sección 21 sitúa el backend funcional en la Iteración 1, este cierre añade solo el arranque técnico y la prueba de conexión necesarios para empezar esa iteración con la infraestructura validada.

## Goals / Non-Goals

**Goals:** separar secretos de Compose y del backend; validar configuración al arrancar; ofrecer salud del proceso y conectividad real; usar y cerrar un pool MySQL sin depender de tablas; conservar el volumen existente.

**Non-Goals:** esquema del dominio, migraciones, autenticación, lógica de negocio, publicación de las rutas `/api/v1`, TLS público o escalamiento. Los dos health checks son técnicos y se montan en `/api/health`, fuera del prefijo versionado de negocio.

## Decisions

### 1. Configuración separada y validada antes de escuchar HTTP

- El `.env` de la raíz seguirá alimentando **solo Docker Compose** con `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` y `MYSQL_PORT`.
- `apps/api/.env` contendrá **solo variables del backend**: `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. Se añadirá `apps/api/.env.example` con marcadores de ejemplo. El backend no cargará el `.env` de la raíz, por lo que `MYSQL_ROOT_PASSWORD` no entrará en su proceso.
- Se cargará el archivo local de la API mediante `dotenv` con una ruta resuelta desde `apps/api`, no desde el directorio de trabajo actual. Las variables ya definidas por el entorno del proceso tendrán prioridad; así, un despliegue puede inyectarlas sin archivo `.env`. La configuración se leerá una vez y se convertirá en un objeto validado que recibe la capa de base de datos.
- Antes de escuchar HTTP se exigirá host, base, usuario y contraseña no vacíos; `DB_PORT` y `PORT` deberán ser enteros de 1 a 65535. `DB_USER=root` se rechazará. Los mensajes de validación nombrarán variables, nunca valores secretos.

**Alternativa considerada:** reutilizar las variables `MYSQL_*` del `.env` raíz para el backend. Se descarta porque incluiría la contraseña de `root` en el entorno del proceso API y acoplaría las variables de inicialización del contenedor con las de conexión. La separación exige mantener coincidentes las credenciales de `incidencias_app` en ambos archivos locales; el README explicará esa relación y el caso de un volumen ya inicializado.

### 2. Pool único de MySQL con `mysql2/promise`

Se usará [`mysql2/promise`](https://github.com/sidorares/node-mysql2/blob/master/website/docs/examples/connections/create-pool.mdx). Su API de promesas permite crear un pool, ejecutar consultas y cerrarlo con `end()`, sin adaptar callbacks. Se creará un pool por proceso a partir del objeto de configuración, con límite pequeño de conexiones para desarrollo y esperas acotadas. El controlador ofrece `pool.query` para la consulta de diagnóstico; la conexión se devuelve automáticamente al pool al concluir la consulta. Se fijará un plazo finito para conexión y comprobación, y una cola limitada para evitar esperas indefinidas.

El pool no realizará migraciones ni DDL. La prueba será `SELECT 1`, que no requiere tablas. El pool se crea durante el arranque, pero la disponibilidad de MySQL se comprueba al pedir el endpoint de base; un fallo transitorio de MySQL no impide que el endpoint de salud del proceso responda.

**Alternativa considerada:** abrir una conexión nueva por petición. Se descarta por coste y por el requisito del SDD de usar un pool con límites de concurrencia. También se evita un ORM en esta iteración porque no existe modelo de dominio que justifique esa dependencia.

### 3. Flujo de health checks y separación de responsabilidades

```text
HTTP
  -> Express router (/api/health)
      -> health controller
          -> GET /api/health: respuesta de proceso, sin tocar MySQL
          -> GET /api/health/database: health service
              -> MySQL pool -> SELECT 1 -> resultado o error
```

El controlador solo traduce resultados a HTTP/JSON; el servicio ejecuta la comprobación; la capa de pool conoce el controlador MySQL y la configuración. Ninguna ruta funcional del OpenAPI se implementa aquí.

`GET /api/health` responderá `200` con `{ "status": "ok" }` mientras Express atienda solicitudes, incluso si MySQL cae. `GET /api/health/database` hará la comprobación en cada petición: `200` con `{ "status": "ok", "database": "connected" }` si `SELECT 1` funciona; `503` con `status: "error"`, `database: "unavailable"`, `code: "DATABASE_UNAVAILABLE"`, mensaje genérico y `correlationId` en cualquier fallo de conexión o autenticación. Ambas respuestas llevarán `Cache-Control: no-store`. No habrá autenticación en estos endpoints técnicos, por lo que sus respuestas no incluirán versión del servidor, host, usuario, consulta ni traza.

El OpenAPI actual usa como servidor base `/api/v1`. Si se documentan allí los health checks al implementar el cambio, deberán tener un `server` propio con base `/` para conservar sus rutas exactas `/api/health` y `/api/health/database`, sin alterar los paths funcionales existentes.

**Alternativa considerada:** hacer que `/api/health` consulte también MySQL. Se descarta porque impediría distinguir un proceso HTTP activo de una base caída.

### 4. Errores y logging seguro

La comprobación agrupará rechazo de credenciales, conexión rechazada, timeout y agotamiento temporal del pool en una respuesta pública `503` uniforme. Internamente se registrará un evento estructurado con `correlationId`, categoría de fallo y tiempo de respuesta. No se serializarán el objeto de configuración, la cadena de conexión completa, el error bruto del controlador ni valores de `DB_PASSWORD` o `MYSQL_ROOT_PASSWORD`. La ausencia o invalidez de configuración al arrancar dará salida no exitosa con el nombre de la variable afectada.

**Alternativa considerada:** devolver mensajes de MySQL para facilitar diagnóstico. Se descarta porque pueden revelar host, usuario u otros detalles operativos. El identificador de correlación permite relacionar una respuesta con el evento interno sin exponerlos.

### 5. Ciclo de vida y dirección de conexión

Tras validar configuración, el proceso crea el pool y empieza a escuchar HTTP. En `SIGINT` o `SIGTERM`, deja de aceptar solicitudes, espera el cierre del servidor HTTP y ejecuta `pool.end()` antes de terminar. La comprobación puntual no crea pools adicionales.

| Ejecución del backend | `DB_HOST` | `DB_PORT` | Destino |
| --- | --- | ---: | --- |
| Node.js en Windows, instalación actual | `127.0.0.1` | `3307` | Puerto publicado por Docker |
| Node.js en un contenedor futuro de Compose | `mysql` | `3306` | Red interna de Compose |

La elección depende únicamente de `DB_HOST` y `DB_PORT` inyectados al proceso. No se detectará Windows o Docker en el código ni se escribirá una dirección como constante de producción. `DB_USER` seguirá siendo `incidencias_app` en ambos casos; la cuenta `root` queda reservada para administración/inicialización del contenedor, no para la API.

**Alternativa considerada:** autodetectar el entorno y cambiar host/puerto en el código. Se descarta porque fallaría con puertos distintos, CI o futuros proveedores.

## Files Likely Affected

| Archivo o área | Cambio previsto |
| --- | --- |
| `apps/api/package.json` y lockfile | Dependencias Express, `mysql2` y `dotenv`; comandos de arranque y verificación. |
| `apps/api/src/config/*` | Carga explícita y validación de variables de la API. |
| `apps/api/src/db/*` | Creación única del pool, diagnóstico `SELECT 1` y cierre. |
| `apps/api/src/health/*`, `apps/api/src/server.*` | Router, controlador, servicio, errores HTTP y ciclo de vida. |
| `apps/api/.env.example` | Valores de ejemplo para host, puerto, base y cuenta de aplicación. |
| `README.md`, `apps/api/README.md` | Instrucciones Windows, pruebas y diferencia entre los dos archivos `.env`. |
| `compose.yaml`, `.gitignore` | Solo ajustes necesarios; se preservan el volumen y la exclusión actual de `.env`. |
| `packages/contracts/openapi.yaml` | Documentación de los dos endpoints técnicos con base propia, sin activar rutas de negocio. |

## Verification

1. En PowerShell, validar la configuración con `docker compose config --quiet` y observar `docker compose ps`: MySQL 9.7.2 debe aparecer `healthy` y publicado en `127.0.0.1:3307` para esta instalación.
2. Comprobar con `git check-ignore .env apps/api/.env` que ambos archivos locales quedan fuera de Git. Revisar que los ejemplos no contienen secretos reales.
3. Arrancar la API desde Windows con `DB_HOST=127.0.0.1`, `DB_PORT=3307`, `DB_NAME=incidencias` y `DB_USER=incidencias_app` en su configuración local. `GET /api/health` debe dar `200` y `GET /api/health/database` debe dar `200` con `database: connected`.
4. Detener solo MySQL con `docker compose stop mysql`: el health del proceso debe seguir en `200` y el health de base pasar a `503` sin detalles sensibles. Reiniciar MySQL con `docker compose start mysql` y comprobar recuperación.
5. Probar credenciales incorrectas en un proceso temporal, sin modificar las del volumen: el health de base debe responder `503` y los logs no deben contener contraseñas. Probar `DB_USER=root`: el arranque debe rechazarse.
6. Detener la API y verificar cierre ordenado. Validar el OpenAPI y comprobar que no se crearon tablas funcionales ni migraciones.

## Risks / Trade-offs

- **Credenciales de un volumen existente no coinciden con la configuración nueva** → Documentar que las variables `MYSQL_*` solo inicializan un volumen vacío; corregir el archivo local de la API o las credenciales mediante administración explícita, sin borrar volúmenes automáticamente.
- **Dos archivos locales contienen la misma contraseña de aplicación** → Mantener ambos ignorados por Git y explicar su relación. Esto evita exponer la contraseña de `root` al proceso API.
- **Un health de base por petición consume una consulta** → Usar `SELECT 1`, un pool pequeño y plazos acotados; las pruebas de carga y el ajuste de límites quedan para una etapa posterior.
- **Health checks sin autenticación** → Respuestas mínimas, sin detalles del servidor y sin caché. La protección perimetral se definirá al desplegar.

## Migration Plan

El cambio es aditivo: se crea el arranque técnico de la API y su configuración local sin tocar el esquema MySQL ni el volumen actual. Para adoptarlo, se mantiene el contenedor sano, se configura `apps/api/.env` con las credenciales vigentes de `incidencias_app`, se inicia Node.js y se ejecutan las comprobaciones anteriores. Para revertir, se detiene la API y se retiran sus archivos nuevos; `docker compose down` sin `-v` conserva el volumen. No se ejecutará ningún borrado o recreación automática de datos.
