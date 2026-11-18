# Spec Delta

## Purpose

Permitir que invitados y ciudadanos usen la app móvil, vinculando los nuevos reportes autenticados con su cuenta y ofreciendo seguimiento privado con actualización manual.

## ADDED Requirements

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
