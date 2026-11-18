# citizen-mobile Specification

## Purpose

Permitir al ciudadano mantener sus datos de cuenta, reutilizar su teléfono al reportar y continuar su sesión desde formularios móviles claros y accesibles.

## Requirements

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

### Requirement: Identidad condicional del reporte móvil
El cliente móvil SHALL enviar Authorization Bearer al crear un reporte con sesión activa y SHALL omitir Authorization cuando actúe como invitado. SHALL conservar el identificador de cliente y la clave de idempotencia durante los reintentos de una misma sesión.

#### Scenario: Reporte autenticado
- **WHEN** un ciudadano con sesión activa envía un reporte
- **THEN** la solicitud incluye su token Bearer y la API asocia el reporte a su cuenta para consultarlo en Mis reportes

#### Scenario: Reporte invitado
- **WHEN** una persona sin sesión envía un reporte
- **THEN** la solicitud carece de Authorization y recibe su referencia y el permiso de foto de invitado cuando corresponda

#### Scenario: Sesión rechazada
- **WHEN** la API rechaza las credenciales y la renovación falla por credenciales inválidas
- **THEN** se informa el error y se actualiza el estado de sesión sin reenviar silenciosamente ese reporte como invitado

### Requirement: Acceso móvil a perfil e historial propio
La app SHALL ofrecer un botón de perfil en la AppBar y un destino Perfil en el menú. Un invitado SHALL acceder al ingreso y registro desde Perfil. Un ciudadano autenticado SHALL acceder a Mi perfil y Mis reportes. La navegación SHALL reflejar los cambios de sesión.

#### Scenario: Invitado abre Perfil
- **WHEN** un invitado pulsa el botón de perfil o el destino Perfil
- **THEN** se muestra el formulario de ingreso con acceso al registro y puede regresar a las vistas públicas

#### Scenario: Ciudadano abre su bandeja
- **WHEN** un ciudadano inicia sesión y elige Mis reportes
- **THEN** se muestran sus reportes y notificaciones mediante solicitudes autenticadas

#### Scenario: Invitado navega contenido público
- **WHEN** un invitado abre Reportar, Mapa, Contactos o Alertas
- **THEN** puede usar la vista pública sin iniciar sesión y sin consultar endpoints de historial privado

#### Scenario: Sesión finalizada en seguimiento
- **WHEN** se cierra o invalida la sesión mientras se muestra una vista privada
- **THEN** la app deja de mostrar los datos privados, retira el seguimiento abierto e impide recuperarlo con Atrás

### Requirement: Línea de tiempo del reporte propio
El ciudadano autenticado SHALL consultar el estado actual y una línea de tiempo cronológica de creación y cambios de estado de su reporte. La API SHALL autorizar la propiedad antes de entregar el historial y SHALL limitar sus eventos a tipo, estado anterior, estado nuevo y fecha.

#### Scenario: Seguimiento con eventos
- **WHEN** el propietario abre un reporte con eventos de creación y cambios de estado
- **THEN** ve su referencia, estado actual y eventos en orden cronológico con fechas y etiquetas comprensibles

#### Scenario: Historial vacío
- **WHEN** el propietario abre un reporte sin eventos disponibles
- **THEN** ve el estado actual y un mensaje de historial vacío

#### Scenario: Protección de datos internos
- **WHEN** se obtiene el seguimiento ciudadano
- **THEN** la respuesta excluye notas operativas, identificadores de personal, asignaciones y datos de otros reportantes

#### Scenario: Reporte ajeno o sesión ausente
- **WHEN** otro ciudadano o un invitado solicita el detalle privado de un reporte
- **THEN** la API deniega el acceso y omite los eventos privados

### Requirement: Recarga manual del seguimiento
La bandeja propia y el detalle SHALL permitir pull-to-refresh incluso con contenido corto o vacío. La recarga SHALL completar su indicador cuando terminen las solicitudes pertinentes y SHALL mostrar los errores de forma recuperable.

#### Scenario: Actualización de bandeja
- **WHEN** el ciudadano desliza para recargar Mis reportes
- **THEN** se vuelven a consultar reportes y notificaciones y el indicador termina tras completar ambas consultas

#### Scenario: Actualización de detalle
- **WHEN** el propietario recarga el detalle después de una actualización institucional
- **THEN** ve el estado y los eventos actualizados obtenidos del servidor

#### Scenario: Fallo de recarga
- **WHEN** una consulta falla durante la recarga
- **THEN** se muestra el error, termina el indicador y se permite intentar otra recarga

### Requirement: Selección territorial móvil por nombre
Mapa, Contactos y Alertas SHALL ofrecer los cinco distritos del catálogo metropolitano compartido mediante sus nombres. Cada pantalla SHALL mantener su selección durante la recarga, permitir limpiar el filtro e informar errores recuperables del catálogo. La interacción SHALL ser accesible con texto ampliado y nombres largos.

#### Scenario: Distrito en las tres pantallas
- **WHEN** un invitado abre Mapa, Contactos o Alertas
- **THEN** puede elegir cualquiera de los cinco distritos por nombre y las consultas usan el identificador del catálogo

#### Scenario: Alerta general y distrito seleccionado
- **WHEN** se consulta Alertas con un distrito
- **THEN** se muestran sus publicaciones vigentes junto con las alertas generales aplicables

#### Scenario: Sin selección territorial
- **WHEN** se limpia el filtro
- **THEN** Mapa muestra los incidentes públicos elegibles, Contactos los nacionales y Alertas las generales, con una indicación comprensible del alcance de cada vista

### Requirement: Límites distritales en el mapa móvil
El mapa móvil SHALL representar la misma cartografía referencial que el panel, destacar y encuadrar el distrito seleccionado y encuadrar el conjunto al elegir Todos. Los filtros de categoría y fechas SHALL combinarse con el distrito y la pantalla SHALL mantener contorno y estado vacío cuando falten reportes.

#### Scenario: Filtros combinados
- **WHEN** se seleccionan distrito, categoría y periodo válidos
- **THEN** el mapa encuadra el distrito y muestra los incidentes públicos que cumplen todos los filtros

#### Scenario: Respuesta tardía o error
- **WHEN** llega una respuesta de un distrito anterior o falla la lectura actual
- **THEN** la respuesta anterior se descarta y el fallo actual se informa con opción de reintento conservando la selección

### Requirement: Distrito público calculado antes de aproximar
El filtrado público SHALL usar el distrito resuelto en el servidor mediante la ubicación original del incidente. La posición mostrada SHALL conservar la aproximación vigente y la exclusión de datos sensibles. La app SHALL explicar que los puntos son aproximados cuando su representación pueda diferir del contorno seleccionado.

#### Scenario: Marcador aproximado junto a una frontera
- **WHEN** un incidente del distrito seleccionado tiene una posición aproximada que cruza visualmente el límite
- **THEN** se conserva su pertenencia territorial y se identifica la ubicación como aproximada

#### Scenario: Incidente sensible
- **WHEN** se filtra el distrito que contiene un incidente sensible
- **THEN** ese incidente continúa excluido de las consultas públicas y su detalle mantiene las restricciones vigentes
