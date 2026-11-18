# Spec Delta

## ADDED Requirements

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
