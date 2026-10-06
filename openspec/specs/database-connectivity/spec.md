# database-connectivity Specification

## Purpose
Permitir que el backend Node.js compruebe su disponibilidad HTTP y su conexión real a MySQL con una cuenta de aplicación, sin ejecutar operaciones de dominio ni revelar secretos.

## Requirements

### Requirement: Configuración válida de la conexión
El backend SHALL recibir host, puerto, base, usuario y contraseña de variables de entorno y SHALL rechazar una configuración incompleta o inválida antes de aceptar solicitudes HTTP.

#### Scenario: Configuración válida desde Windows
- **WHEN** se configuran `127.0.0.1`, el puerto publicado, `incidencias` y la cuenta `incidencias_app`
- **THEN** el backend usa esos valores sin depender de direcciones o puertos fijados en su código

#### Scenario: Falta una variable requerida
- **WHEN** falta el host, puerto, base, usuario o contraseña de la conexión
- **THEN** el arranque falla con una indicación de la variable inválida, sin imprimir su valor secreto

#### Scenario: Usuario root configurado
- **WHEN** el usuario de base configurado para el backend es `root`
- **THEN** el backend rechaza el arranque y no abre conexiones con esa cuenta

### Requirement: Pool de conexiones de aplicación
El backend MUST reutilizar un pool de conexiones MySQL asociado a la cuenta `incidencias_app` durante la ejecución normal y SHALL liberar las conexiones usadas por cada comprobación.

#### Scenario: Comprobaciones consecutivas
- **WHEN** se hacen varias comprobaciones de base de datos en el mismo proceso
- **THEN** se reutiliza el pool configurado y no se deja una conexión ocupada al terminar cada comprobación

### Requirement: Diagnóstico de base de datos sin efectos
El backend SHALL verificar la conexión real con una consulta mínima de solo lectura que no dependa de tablas funcionales ni modifique datos.

#### Scenario: Diagnóstico correcto
- **WHEN** MySQL acepta la conexión de `incidencias_app`
- **THEN** la comprobación ejecuta una consulta equivalente a `SELECT 1` y confirma conectividad sin crear tablas ni registros

### Requirement: Estado HTTP del proceso
`GET /api/health` SHALL informar si el proceso HTTP está activo sin consultar MySQL.

#### Scenario: Proceso activo y MySQL disponible
- **WHEN** el proceso HTTP está activo y se solicita `GET /api/health`
- **THEN** responde HTTP `200` con JSON `{ "status": "ok" }`

#### Scenario: Proceso activo y MySQL caído
- **WHEN** el proceso HTTP continúa activo pero MySQL no está disponible
- **THEN** `GET /api/health` sigue respondiendo HTTP `200` con JSON `{ "status": "ok" }`

### Requirement: Estado HTTP de la base de datos
`GET /api/health/database` SHALL ejecutar el diagnóstico real en cada solicitud y SHALL distinguir conexión correcta de indisponibilidad mediante el código HTTP.

#### Scenario: Base conectada
- **WHEN** `incidencias_app` puede ejecutar la consulta de diagnóstico
- **THEN** responde HTTP `200` con JSON `{ "status": "ok", "database": "connected" }`

#### Scenario: MySQL no disponible
- **WHEN** el servidor MySQL no responde o vence el plazo de conexión configurado
- **THEN** responde HTTP `503` con `status: "error"`, `database: "unavailable"`, código estable, mensaje genérico y `correlationId`, sin detalles internos

#### Scenario: Credenciales incorrectas
- **WHEN** MySQL rechaza las credenciales de aplicación
- **THEN** responde HTTP `503` con el mismo cuerpo genérico de indisponibilidad, salvo el `correlationId`, sin revelar el usuario ni la contraseña

### Requirement: Errores y logs sin secretos
El backend MUST evitar que contraseñas, cadenas de conexión completas o detalles sensibles del controlador aparezcan en respuestas HTTP o logs.

#### Scenario: Error de conexión
- **WHEN** una comprobación de base falla
- **THEN** el cliente recibe solo el estado genérico y el log identifica el tipo de fallo sin incluir secretos

### Requirement: Cierre ordenado del pool
El backend SHALL dejar de aceptar nuevas solicitudes y cerrar su pool de MySQL al terminar normalmente el proceso.

#### Scenario: Señal de terminación
- **WHEN** el proceso recibe una señal de terminación normal
- **THEN** libera las conexiones del pool y finaliza sin dejar sesiones de aplicación activas por ese proceso
