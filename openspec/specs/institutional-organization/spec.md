# institutional-organization Specification

## Purpose

Representar las sedes acordadas del piloto de Ayacucho y sus cuentas de desarrollo para probar el acceso y la atención dentro de cada ámbito institucional.

## Requirements

### Requirement: Catálogo demostrativo de dieciséis sedes
El seed DEMO SHALL producir las 16 sedes acordadas, incluida Comisaría PNP Chacco en Jesús Nazareno. SHALL conservar la relación entre sede e institución y distinguir los cinco distritos del piloto. Cada sede SHALL tener una identidad estable independiente del tipo institucional.

#### Scenario: Primera carga
- **WHEN** se ejecuta el seed explícito en una base de desarrollo migrada
- **THEN** se obtienen las 16 sedes del listado de diseño con sus instituciones y distritos configurados

#### Scenario: Varias sedes de una especialidad
- **WHEN** se listan las sedes PNP o Bomberos del piloto
- **THEN** aparecen todas las sedes de ese tipo con identificadores propios

### Requirement: Cuentas de desarrollo por sede
El seed SHALL crear una cuenta SuperAdministrador para la sede central y una cuenta Operador individual por cada una de las otras 15 sedes. Sus correos SHALL usar `@demo.invalid`, y las contraseñas SHALL proceder de `DEMO_PASSWORD` y almacenarse mediante hash.

#### Scenario: Operador de Chacco
- **WHEN** inicia sesión la cuenta de desarrollo de Chacco
- **THEN** obtiene rol Operador y la membresía correspondiente a esa sede PNP

#### Scenario: Operadores de la misma institución
- **WHEN** dos operadores pertenecen a sedes distintas de la misma institución
- **THEN** cada uno conserva su propia cuenta y ámbito de sede

#### Scenario: Administración global
- **WHEN** inicia sesión la cuenta de desarrollo SuperAdministrador
- **THEN** conserva el acceso global previsto por ese rol

### Requirement: Actualización repetible de datos DEMO
El seed MUST poder ampliar una base con las cuatro sedes DEMO anteriores y volver a ejecutarse conservando cuentas, contraseñas, recursos e historial existentes. La actualización SHALL reconocer sus propios registros y evitar duplicar sedes, membresías y coberturas.

#### Scenario: Ampliación del piloto anterior
- **WHEN** el seed se ejecuta sobre una base con las cuatro sedes iniciales
- **THEN** el catálogo objetivo contiene 16 sedes DEMO, y las referencias de las sedes reutilizadas conservan sus identificadores

#### Scenario: Segunda ejecución
- **WHEN** se ejecuta el seed nuevamente con una contraseña configurada diferente
- **THEN** las cuentas existentes conservan su contraseña y la cantidad de sedes y membresías del catálogo permanece estable

### Requirement: Identificación de ubicaciones demostrativas
Los nombres, ubicaciones y coberturas sintéticas SHALL identificarse como DEMO. Los datos pendientes de verificación SHALL quedar documentados como provisionales en la definición del seed. La carga SHALL ejecutarse solo mediante el comando explícito existente.

#### Scenario: Sede con ubicación pendiente
- **WHEN** se consulta una sede cuya ubicación física todavía requiere confirmación
- **THEN** sus datos de prueba se identifican como DEMO y su carácter provisional queda documentado

#### Scenario: Arranque de la aplicación
- **WHEN** se inicia la API mediante su comando habitual
- **THEN** las cuentas y las sedes se conservan sin ejecutar la carga del seed

### Requirement: Organización territorial por sede
Instituciones SHALL agrupar las sedes por institución y mostrar nombre, distrito, estado y acceso a sus usuarios. SHALL permitir filtrar sedes por distrito y editar los datos autorizados. La ubicación de una sede SHALL resolverse con el catálogo territorial compartido y las discrepancias con un distrito declarado SHALL informarse para revisión.

#### Scenario: Sede con distrito conocido
- **WHEN** un administrador abre Instituciones y selecciona un distrito
- **THEN** ve las sedes autorizadas de ese distrito agrupadas por institución y puede abrir sus usuarios

#### Scenario: Ubicación ambigua o discrepante
- **WHEN** una sede carece de una clasificación territorial inequívoca o sus coordenadas contradicen el distrito declarado
- **THEN** el formulario comunica la condición y el registro conserva un estado territorial pendiente hasta que se resuelva

### Requirement: Creación de cuentas desde una sede
El panel SHALL ofrecer Crear usuario al guardar una sede y desde su detalle. SHALL precargar institución y sede y solicitar nombre, correo, rol autorizado y contraseña conforme a la política vigente. El alta SHALL guardar cuenta, rol, membresía y auditoría consistentemente y permitir múltiples cuentas individuales por sede.

#### Scenario: Usuario nuevo de una sede
- **WHEN** un administrador autorizado completa un alta válida
- **THEN** la cuenta aparece entre los usuarios de esa sede y puede iniciar sesión con el rol y ámbito asignados

#### Scenario: Error después de crear la sede
- **WHEN** se guarda una sede y falla la creación posterior del usuario
- **THEN** se muestra Sede creada. Usuario pendiente y se permite corregir o reintentar el alta sobre la sede ya creada

#### Scenario: Correo existente o doble envío
- **WHEN** se repite el alta de un correo existente o se pulsa Guardar durante un envío pendiente
- **THEN** se evita crear cuentas o membresías duplicadas y se informa el resultado recuperable

### Requirement: Administración de usuarios por rol y ámbito
El SuperAdministrador SHALL crear operadores y administradores institucionales. El AdministradorInstitucional SHALL crear y gestionar operadores de las sedes autorizadas. El panel SHALL permitir editar nombre y activar o desactivar cuentas autorizadas, mostrando correo, rol, sede y estado.

#### Scenario: Intento de ampliar privilegios
- **WHEN** un administrador institucional intenta crear otro administrador o gestionar una cuenta ajena
- **THEN** la API rechaza la operación y la interfaz conserva el contexto autorizado

#### Scenario: Cuenta con varias membresías
- **WHEN** una cuenta tiene varias membresías activas
- **THEN** su consulta identifica cada ámbito y su edición valida todos los ámbitos afectados por el cambio de cuenta

#### Scenario: Cuenta desactivada
- **WHEN** se desactiva una cuenta autorizada
- **THEN** queda visible como inactiva, pierde acceso conforme a la autenticación vigente y mantiene su historial
