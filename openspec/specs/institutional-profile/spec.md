# institutional-profile Specification

## Purpose

Permitir a operadores y administradores consultar sus asignaciones institucionales, mantener sus datos personales y cambiar su contraseña desde el panel.

## Requirements

### Requirement: Consulta del perfil institucional propio
Los roles Operador, AdministradorInstitucional y SuperAdministrador SHALL acceder a su perfil con nombre, correo, teléfono opcional y roles legibles. SHALL consultar todas sus asignaciones activas con nombres de institución y sede. Un ámbito institucional sin sede SHALL identificarse como Todas las sedes y un superadministrador sin membresías como Ámbito global.

#### Scenario: Varias asignaciones
- **WHEN** un usuario tiene varias membresías activas
- **THEN** el perfil muestra sus instituciones, sedes y roles correspondientes sin elegir arbitrariamente una sola asignación

#### Scenario: Administración institucional
- **WHEN** un administrador tiene una membresía institucional sin sede específica
- **THEN** el perfil muestra la institución y Todas las sedes

#### Scenario: Superadministrador global
- **WHEN** un superadministrador carece de membresías institucionales
- **THEN** el perfil muestra su rol y Ámbito global

#### Scenario: Sin asignación activa
- **WHEN** un operador o administrador institucional carece de membresías activas
- **THEN** el perfil indica Sin asignación institucional activa

### Requirement: Edición de nombre y teléfono
El usuario institucional SHALL guardar cambios de su nombre y teléfono opcional desde Datos personales. El nombre SHALL ser obligatorio y cumplir el límite vigente de 150 caracteres. El teléfono SHALL aceptar el formato vigente y permitir eliminarse. El correo, los roles y las asignaciones SHALL presentarse para consulta.

#### Scenario: Guardado válido
- **WHEN** el usuario guarda un nombre y teléfono válidos
- **THEN** se confirma el guardado, la cabecera refleja el nombre confirmado y una nueva lectura recupera los valores persistidos

#### Scenario: Teléfono eliminado
- **WHEN** el usuario guarda el teléfono vacío
- **THEN** su perfil queda sin teléfono

#### Scenario: Edición rechazada
- **WHEN** los datos son inválidos o la API rechaza el guardado
- **THEN** se muestra el error y se conserva la edición para corregirla sin anunciar éxito

### Requirement: Autorización del perfil y compatibilidad
La API SHALL resolver el perfil propio desde la sesión y rechazar cambios de correo, rol, institución, sede o identidad mediante la edición personal. La ampliación de consulta SHALL conservar los campos id, name, email y phone y el contrato de edición existente utilizado por la app ciudadana.

#### Scenario: Intento de cambiar privilegios
- **WHEN** una solicitud de edición incluye un rol o asignación institucional
- **THEN** la API rechaza la operación y conserva los datos persistidos

#### Scenario: Sesión ausente
- **WHEN** se consulta o modifica el perfil sin credenciales válidas
- **THEN** la API rechaza la solicitud y el panel solicita iniciar sesión

#### Scenario: Cliente ciudadano existente
- **WHEN** un cliente ciudadano consulta o edita los campos personales publicados
- **THEN** obtiene el formato y comportamiento previamente admitidos sin recibir membresías institucionales ajenas

### Requirement: Cambio de contraseña institucional
El usuario SHALL cambiar contraseña mediante la contraseña actual, una nueva de 12 a 128 caracteres y confirmación coincidente. Los campos SHALL permitir mostrar u ocultar su valor. Un cambio confirmado SHALL invalidar las sesiones anteriores, limpiar la sesión local y solicitar nuevo ingreso con un mensaje de éxito.

#### Scenario: Cambio confirmado
- **WHEN** la contraseña actual es correcta y la nueva contraseña cumple la política y coincide con su confirmación
- **THEN** se confirma el cambio, los tokens anteriores dejan de dar acceso y el usuario llega al ingreso con un mensaje que explica el nuevo inicio de sesión

#### Scenario: Contraseña actual incorrecta
- **WHEN** la API rechaza la contraseña actual
- **THEN** se informa el error y permanecen vigentes la contraseña y las sesiones anteriores

#### Scenario: Confirmación o longitud inválida
- **WHEN** la nueva contraseña difiere de su confirmación o incumple la longitud admitida
- **THEN** el formulario identifica el campo a corregir y evita enviar el cambio

#### Scenario: Resultado de cambio incierto
- **WHEN** se pierde la respuesta del cambio de contraseña
- **THEN** se informa que no se pudo confirmar el resultado y se permite volver al ingreso sin reintentar automáticamente el cambio

### Requirement: Formularios accesibles y resultados de operaciones
El perfil SHALL distinguir carga, error de lectura, guardado en curso y resultado. Sus campos SHALL tener etiquetas y errores asociados, permitir navegación por teclado y mantenerse utilizables en pantallas compactas. Cada formulario SHALL impedir envíos duplicados mientras su operación está en curso.

#### Scenario: Lectura fallida
- **WHEN** falla la consulta del perfil
- **THEN** se muestra el error y un reintento de lectura sin habilitar un formulario vacío que sustituya los datos guardados

#### Scenario: Guardado en curso
- **WHEN** se envía una edición o un cambio de contraseña
- **THEN** el formulario muestra progreso e impide un segundo envío hasta recibir el resultado

#### Scenario: Pantalla compacta
- **WHEN** se abre el perfil desde una pantalla compacta y se recorre con teclado
- **THEN** todos los campos y acciones son alcanzables y el foco permanece visible
