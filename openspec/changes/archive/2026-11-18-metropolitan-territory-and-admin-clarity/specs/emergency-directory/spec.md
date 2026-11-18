# Spec Delta

## Purpose

Publicar teléfonos de emergencia nacionales y locales administrables y permitir a la ciudadanía encontrar los contactos correspondientes a su distrito.

## ADDED Requirements

### Requirement: Publicación territorial de contactos
La consulta pública SHALL entregar contactos nacionales activos y contactos locales activos del distrito solicitado. Cada entrada SHALL identificar nombre, teléfono, ámbito, institución y sede cuando existan y sean publicables. La consulta sin distrito SHALL conservar la publicación de contactos nacionales.

#### Scenario: Distrito con contactos locales
- **WHEN** el ciudadano elige uno de los cinco distritos metropolitanos
- **THEN** recibe sus contactos locales y los contactos nacionales activos

#### Scenario: Distrito sin contactos locales
- **WHEN** el distrito seleccionado carece de contactos locales
- **THEN** se informa esa condición y siguen visibles los contactos nacionales disponibles

### Requirement: Administración territorial de contactos
El panel SHALL permitir crear, editar y desactivar contactos autorizados con nombres de institución, distrito y sede. Los contactos locales SHALL requerir distrito y los asociados a sede SHALL validar su pertenencia institucional. El formulario SHALL ofrecer las acciones permitidas por el rol y mostrar carga, error y confirmación.

#### Scenario: Administrador institucional
- **WHEN** un administrador institucional agrega un contacto
- **THEN** puede gestionar contactos locales de su ámbito y el formulario ofrece únicamente los ámbitos que puede administrar

#### Scenario: Número corregido o desactivado
- **WHEN** un administrador autorizado guarda la corrección o desactivación de un teléfono
- **THEN** la siguiente consulta pública refleja el cambio y existe su evento auditado

#### Scenario: Asociación ajena
- **WHEN** se intenta asociar una sede de otra institución o modificar un contacto ajeno
- **THEN** la API rechaza la solicitud y conserva los datos vigentes

### Requirement: Contactos nacionales disponibles sin conexión
La app SHALL usar la publicación administrada como fuente al completar una actualización en línea y conservar la última lista nacional confirmada para uso sin conexión. SHALL disponer de números nacionales de respaldo para la primera apertura sin Internet y señalar la vigencia de los datos almacenados.

#### Scenario: Actualización en línea
- **WHEN** se carga correctamente una lista nacional con un número corregido o desactivado
- **THEN** la app sustituye su lista nacional almacenada y muestra la publicación vigente sin duplicar las tarjetas de respaldo

#### Scenario: Fallo de red o primera apertura
- **WHEN** falla la consulta pública
- **THEN** se informa el fallo y se muestran los nacionales almacenados o los números de respaldo si todavía no existe una actualización confirmada

### Requirement: Llamada iniciada por la persona
La app SHALL ofrecer una acción para abrir el marcador con el número seleccionado y SHALL informar si el dispositivo no permite abrirlo.

#### Scenario: Pulsar Llamar
- **WHEN** el ciudadano pulsa Llamar en un contacto
- **THEN** se abre el marcador con ese teléfono para que la persona confirme la llamada
