# local-development-environment Specification

## Purpose
Proporcionar un entorno MySQL local reproducible y seguro para desarrollar el backend desde Windows, conservando los datos entre arranques y sin versionar credenciales reales.

## Requirements

### Requirement: MySQL local mediante Docker Compose
El proyecto SHALL permitir iniciar MySQL 9.7.2 mediante Docker Compose y verificar que el servicio esté listo antes de usarlo.

#### Scenario: Servicio listo
- **WHEN** se inicia el servicio `mysql` con una configuración válida y Docker disponible
- **THEN** el contenedor de MySQL alcanza el estado `healthy` y ofrece la base `incidencias` al usuario de aplicación configurado

#### Scenario: Docker no disponible
- **WHEN** Docker Desktop no está ejecutándose
- **THEN** el intento de iniciar el entorno falla de forma visible, sin informar falsamente que MySQL está listo

### Requirement: Puerto y credenciales configurables
El entorno SHALL obtener el puerto publicado, el nombre de la base y las credenciales de variables de entorno. El puerto publicado SHALL limitarse a la interfaz local de Windows.

#### Scenario: Acceso desde Windows
- **WHEN** `MYSQL_PORT` vale `3307` en la configuración local y el servicio está listo
- **THEN** MySQL es accesible desde Windows por `127.0.0.1:3307`, mientras conserva el puerto interno `3306`

#### Scenario: Puerto externo alternativo
- **WHEN** se configura otro puerto local disponible antes de iniciar el servicio
- **THEN** Docker Compose publica MySQL en ese puerto sin requerir cambios en código del backend

#### Scenario: Falta una credencial requerida
- **WHEN** falta una variable requerida para inicializar MySQL
- **THEN** la configuración de Docker Compose se rechaza antes de iniciar el servicio y señala la variable faltante sin mostrar contraseñas

### Requirement: Secretos locales fuera de Git
El proyecto MUST excluir los archivos `.env` locales del control de versiones y SHALL proporcionar ejemplos sin contraseñas reales.

#### Scenario: Configuración local privada
- **WHEN** se crea un archivo `.env` en la raíz o en `apps/api`
- **THEN** Git lo ignora y no lo incluye en los archivos versionados

#### Scenario: Ejemplos compartidos
- **WHEN** se inspeccionan los archivos `.env.example`
- **THEN** solo contienen nombres de variables y valores de ejemplo, nunca las credenciales reales del contenedor

### Requirement: Persistencia no destructiva del volumen
Las operaciones documentadas de inicio, detención y reinicio SHALL conservar el volumen de datos MySQL. Ningún flujo normal SHALL borrar ni recrear volúmenes automáticamente.

#### Scenario: Reinicio del entorno
- **WHEN** se detiene el servicio con el comando documentado y se vuelve a iniciar
- **THEN** se reutiliza el mismo volumen de datos y no se reinicializa la base

#### Scenario: Cambio de variables tras crear el volumen
- **WHEN** se cambian variables de inicialización después de crear el volumen
- **THEN** la documentación advierte que ese cambio no altera automáticamente las credenciales ni la base ya inicializadas

### Requirement: Preparación reproducible desde Windows
El proyecto SHALL documentar los pasos para configurar, iniciar, comprobar y detener el entorno local desde Windows.

#### Scenario: Nueva estación de desarrollo
- **WHEN** una persona con Docker Desktop sigue las instrucciones del repositorio y configura sus variables locales
- **THEN** puede comprobar el estado de MySQL y localizar el host y puerto que usará el backend sin depender de rutas o contraseñas de otra máquina
