# Spec Delta

## Purpose

Permitir al ciudadano mantener sus datos de cuenta, reutilizar su teléfono al reportar y continuar su sesión desde formularios móviles claros y accesibles.

## ADDED Requirements

### Requirement: Edición de datos personales propios
El ciudadano autenticado SHALL consultar su nombre, correo y teléfono opcional y guardar cambios de nombre y teléfono en su cuenta. La edición SHALL validar nombre y teléfono, y la API SHALL autorizar el acceso por la identidad de sesión.

#### Scenario: Actualización válida
- **WHEN** el ciudadano guarda un nombre válido y un teléfono válido
- **THEN** ve confirmación de guardado y los datos se recuperan al iniciar sesión desde otro dispositivo

#### Scenario: Eliminar teléfono
- **WHEN** el ciudadano guarda el teléfono vacío
- **THEN** su cuenta queda sin teléfono y los nuevos reportes se abren con contacto vacío

#### Scenario: Datos inválidos o fallo de guardado
- **WHEN** el nombre está vacío, el teléfono es inválido o el servidor rechaza el guardado
- **THEN** se informa el problema, se conserva la edición para corregirla y los datos persistidos no se sustituyen por cambios sin confirmar

#### Scenario: Acceso ajeno o sin sesión
- **WHEN** se intenta modificar el perfil sin credenciales válidas o indicando la identidad de otro ciudadano
- **THEN** la API deniega la solicitud y conserva los datos de ambas cuentas

### Requirement: Correo de cuenta de solo lectura
El perfil SHALL mostrar el correo como dato de consulta. La operación de edición de perfil SHALL rechazar intentos de modificar correo, rol, identidad o contraseña mediante ese formulario o su API.

#### Scenario: Intento de cambiar correo
- **WHEN** una solicitud de edición incluye un nuevo correo
- **THEN** la API rechaza la operación y el correo original sigue siendo el identificador de ingreso

### Requirement: Contacto de reporte autocompletado y editable
Los nuevos reportes de un ciudadano SHALL autocompletar el teléfono guardado en su perfil cuando esté disponible. El contacto SHALL poder modificarse o borrarse por reporte y SHALL conservarse como copia del valor enviado, independiente de posteriores cambios del perfil.

#### Scenario: Contacto disponible
- **WHEN** el ciudadano abre un nuevo reporte con teléfono guardado
- **THEN** ve ese teléfono en el campo de contacto y puede cambiarlo antes de enviar

#### Scenario: Contacto borrado para un reporte
- **WHEN** el ciudadano borra el contacto autocompletado y envía
- **THEN** el reporte se registra sin contacto y el teléfono del perfil se conserva

#### Scenario: Perfil actualizado después de enviar
- **WHEN** el ciudadano cambia el teléfono del perfil después de un envío confirmado o pendiente
- **THEN** el contacto guardado en ese reporte o pendiente conserva el valor que se envió inicialmente

#### Scenario: Perfil recibido durante la edición
- **WHEN** se recupera el perfil mientras el ciudadano ya ha modificado o borrado el contacto del formulario
- **THEN** el campo conserva la edición realizada por el ciudadano

#### Scenario: Invitado o cuenta distinta
- **WHEN** se abre un reporte sin sesión o después de cambiar de cuenta
- **THEN** el formulario usa únicamente el contacto aplicable a la identidad actual y evita reutilizar el teléfono privado de otra cuenta

### Requirement: Cambio autenticado de contraseña
El ciudadano SHALL cambiar su contraseña mediante la contraseña actual y una nueva contraseña de 12 a 128 caracteres, con confirmación coincidente en el formulario. Un cambio exitoso SHALL invalidar todas las sesiones existentes y solicitar un nuevo ingreso.

#### Scenario: Cambio exitoso
- **WHEN** la contraseña actual es correcta y la nueva cumple la política y su confirmación
- **THEN** se confirma el cambio, se cierra la sesión móvil y los tokens anteriores dejan de dar acceso

#### Scenario: Contraseña actual incorrecta
- **WHEN** el ciudadano presenta una contraseña actual incorrecta
- **THEN** se rechaza el cambio y se conservan contraseña y sesiones vigentes

#### Scenario: Nueva contraseña inválida
- **WHEN** la nueva contraseña incumple la longitud o difiere de su confirmación
- **THEN** se informa el campo a corregir y se evita confirmar el cambio

### Requirement: Continuidad de sesión al abrir la app
La app SHALL intentar restaurar la sesión guardada en segundo plano y recuperar el perfil actual sin bloquear las vistas públicas. SHALL descartar credenciales invalidadas y conservar la posibilidad de reintento ante fallos transitorios de red.

#### Scenario: Sesión válida
- **WHEN** la app se abre con credenciales renovables válidas
- **THEN** recupera la identidad, los datos del perfil y los accesos privados sin pedir nuevamente la contraseña

#### Scenario: Sin conexión al arrancar
- **WHEN** la restauración falla por falta de conexión
- **THEN** las vistas públicas siguen disponibles, la app informa que no pudo recuperar la sesión y permite reintentar sin borrar las credenciales guardadas

#### Scenario: Sesión invalidada
- **WHEN** el servidor rechaza definitivamente las credenciales guardadas
- **THEN** la app pasa a invitado y solicita iniciar sesión para volver a acceder a datos privados

#### Scenario: Cierre mientras se restaura
- **WHEN** el ciudadano cierra sesión o ingresa con otra cuenta durante una restauración en curso
- **THEN** una respuesta tardía no restablece la sesión anterior ni sus datos

### Requirement: Organización de formularios de cuenta
La IU SHALL ofrecer Mi perfil con accesos a Datos personales, Seguridad y Cerrar sesión. Registro, ingreso y edición SHALL disponer de separación entre campos y grupos, ayudas de validación, control de visibilidad de contraseñas y mensajes de resultado, con contenido desplazable al abrir el teclado o ampliar el texto.

#### Scenario: Pantalla compacta con teclado
- **WHEN** se utiliza un formulario de cuenta en una pantalla compacta con el teclado abierto
- **THEN** los campos y la acción principal son alcanzables mediante desplazamiento y no presentan desbordamiento

#### Scenario: Operación en curso
- **WHEN** el ciudadano guarda datos o cambia contraseña
- **THEN** ve progreso, se impiden envíos duplicados y se muestra confirmación o error al terminar

#### Scenario: Contraseña visible
- **WHEN** el ciudadano activa o desactiva la visibilidad de una contraseña
- **THEN** cambia su representación sin modificar el valor escrito
