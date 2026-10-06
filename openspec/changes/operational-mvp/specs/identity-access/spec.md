# Spec Delta

## Purpose

Controlar quién accede a la plataforma y qué operaciones puede realizar cada persona según su rol, institución y sede.

## ADDED Requirements

### Requirement: Registro ciudadano
La API SHALL registrar ciudadanos con datos mínimos, contraseña segura y aceptación explícita de términos, sin devolver el hash.

#### Scenario: Alta válida
- **WHEN** una persona proporciona nombre, correo único, contraseña válida y acepta términos
- **THEN** recibe una cuenta Ciudadano y una respuesta sin contraseña ni hash

#### Scenario: Correo repetido
- **WHEN** el correo ya está registrado
- **THEN** la API rechaza el alta con un error de conflicto estable

### Requirement: Autenticación y recuperación
La plataforma SHALL autenticar cuentas activas y permitir recuperación de acceso mediante un mecanismo temporal de un solo uso.

#### Scenario: Credenciales válidas
- **WHEN** un usuario activo presenta correo y contraseña correctos
- **THEN** recibe tokens con vencimiento y su rol y ámbito se obtienen del servidor

#### Scenario: Credenciales inválidas
- **WHEN** el correo no existe o la contraseña es errónea
- **THEN** recibe el mismo error genérico sin revelar si la cuenta existe

#### Scenario: Recuperación
- **WHEN** se consume un token de recuperación válido y no vencido
- **THEN** la contraseña cambia, el token no puede reutilizarse y las credenciales previas dejan de dar acceso

### Requirement: Autorización por rol y ámbito
La API MUST aplicar permisos en servidor para SuperAdministrador, AdministradorInstitucional, Operador y Ciudadano, considerando institución, sede y jurisdicción.

#### Scenario: Acceso permitido
- **WHEN** un Operador solicita un incidente dentro de su ámbito asignado
- **THEN** recibe únicamente los datos que necesita para operarlo

#### Scenario: Acceso cruzado
- **WHEN** un usuario institucional solicita datos de otra institución o sede fuera de su ámbito
- **THEN** la API deniega la operación sin revelar detalles privados

#### Scenario: Token ausente o inválido
- **WHEN** una ruta protegida recibe una solicitud sin token válido
- **THEN** responde HTTP 401 y no ejecuta la operación

### Requirement: Protección de credenciales y sesiones
La plataforma MUST almacenar solo hashes seguros, mantener la API sin sesiones de usuario en memoria y limitar intentos abusivos de acceso.

#### Scenario: Inspección de persistencia y logs
- **WHEN** se registra o autentica una cuenta
- **THEN** la contraseña, los tokens y sus equivalentes secretos no aparecen en la base en texto plano, respuestas no autorizadas ni logs

#### Scenario: Intentos excesivos
- **WHEN** un origen supera el límite configurado de intentos de inicio de sesión
- **THEN** recibe una respuesta de limitación y no puede probar contraseñas indefinidamente
