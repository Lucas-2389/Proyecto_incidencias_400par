# Guía rápida de usuarios y módulos

## Entrar al sistema

Panel institucional: https://gestionincidencias.cfd/login

Las cuentas siguientes son DEMO. La contraseña es la definida al ejecutar el seed correspondiente; solicitarla al responsable por un canal privado. No está en Git, no se incluye en esta guía y no se debe volver a sembrar la base para intentar corregir un login.

| Perfil | Cuenta de ejemplo | Uso |
| --- | --- | --- |
| SuperAdministrador | `superadmin@demo.invalid` | Supervisión global e instituciones/sedes; módulos administrativos y operativos. |
| Administración municipal | `admin-municipalidad@demo.invalid` | Organización y atención dentro del ámbito municipal autorizado. |
| Administración PNP | `admin-pnp@demo.invalid` | Gestión institucional de PNP. |
| Administración SAMU | `admin-samu@demo.invalid` | Gestión institucional de SAMU. |
| Administración Bomberos | `admin-bomberos@demo.invalid` | Gestión institucional de Bomberos. |
| Operación institucional | `operator-municipalidad@demo.invalid`, `operator-pnp@demo.invalid`, `operator-samu@demo.invalid`, `operator-bomberos@demo.invalid` | Atención operativa limitada por institución y sede. |
| Ciudadano (Android) | Sin cuenta | Reporte preliminar, foto opcional, referencia de recepción y contactos. La cuenta ciudadana anterior se conserva en la API, fuera de la navegación actual. |

Los permisos se comprueban en la API. La visibilidad de un menú no concede acceso a información de otra institución. Las cuentas disponibles dependen del seed aplicado a la base del ambiente elegido.

## Panel institucional

| Módulo | Qué permite revisar o hacer |
| --- | --- |
| Dashboard | Resumen de actividad y acceso a incidentes recientes. |
| Incidentes | Bandeja, detalle, evidencias, atención, asignaciones y cambios de estado autorizados. |
| Mapa | Ubicación operativa de reportes con pictogramas, filtros por tipo y distrito y fechas opcionales. |
| Instituciones | Organización y sedes; SuperAdministrador gestiona el ámbito global. |
| Directorio | Contactos de emergencia administrados por el ámbito autorizado. |
| Historial | Eventos de auditoría según institución y sede. |
| Campana | Avisos internos y acceso al incidente relacionado. |

Operadores acceden a Dashboard, Incidentes y Mapa. Administradores acceden también a los módulos administrativos según su ámbito. El ciudadano utiliza la app Android.

### Mapa operativo

Seleccionar **Tipo de incidente**, después **Distrito** por su nombre y, si se necesita, completar **Desde** y **Hasta**. Al dejar ambas fechas vacías se consultan los últimos siete días y se muestra el periodo aplicado. Las fechas personalizadas incluyen los días completos en hora de Perú y admiten hasta 90 días. Una consulta demasiado amplia requiere reducir el periodo o filtrar el tipo y distrito. **Actualizar** permite reintentar sin perder los filtros. Abrir un marcador permite consultar el detalle autorizado.

### Información del reporte y control

El detalle incluye descripción, contacto disponible y **Triage rápido** con conciencia, respiración, sangrado, subtipo y cantidad de afectados cuando fueron informados. **No** representa una respuesta negativa y **No informado** representa un dato desconocido. Las observaciones clínicas corresponden a la persona principal descrita en el reporte.

El minimapa muestra el punto del incidente junto con su referencia y coordenadas. Si la cartografía falla, las coordenadas y el resto del reporte permanecen consultables. Un reporte sin punto indica **Ubicación no disponible**.

La ubicación tiene su propia tarjeta junto a Información y triage. **Control · Verificar y priorizar** se encuentra después de Fotografías e inicia replegado. **Abrir control** permite editar resultado, prioridad y motivo. Al confirmar **Guardar verificación** o **Iniciar verificación**, el panel se repliega y el resultado permanece visible. Si la acción es rechazada, el control conserva los valores para corregirlos.

La prioridad aparece mediante una insignia en la bandeja y junto al estado del detalle. Baja usa gris, Normal azul, Alta ámbar y Crítica rojo. Las prioridades Alta y Crítica incluyen un símbolo de alerta. El selector del control muestra el valor actual y permite guardar un cambio con su motivo.

### Despacho y atención de varias instituciones

Seleccionar **Sede responsable** y, opcionalmente, un **Operador** activo de esa sede. Es posible confirmar con operador pendiente. Una sede fuera de las sugerencias requiere un motivo de corrección. **Confirmar asignación** agrega la participación de esa sede. Repetir con otra sede permite atención simultánea de varias instituciones.

Cada tarjeta de **Asignaciones visibles** identifica institución, sede, operador, estado y fecha. Sus botones avanzan únicamente la atención de esa sede. Las cerradas aparecen al final con su fecha de cierre. La cabecera muestra el estado global, correspondiente a la etapa menos avanzada entre todas las participaciones. Incorporar una sede nueva durante la atención puede llevar el estado global a **Asignado**.

La vista se actualiza cada 15 segundos mientras la pestaña está visible y permite actualizar manualmente. Ante un conflicto con otra sesión, revisar los datos recargados antes de confirmar de nuevo. Una confirmación guardada seguida de un error de lectura permite reintentar **Actualizar**. El historial identifica las sedes de las asignaciones visibles para la cuenta.

## Recorrido de demostración

1. Instalar el APK descrito en [la guía móvil](../../apps/mobile/README.md). Producción conecta a Render sin depender del PC.
2. Abrir la app y entrar directamente a **Reportar**, sin registro ni contraseña.
3. Elegir categoría, describir un caso claramente ficticio y escribir una referencia de calle/lugar. Usar ubicación actual o seleccionar el punto en el mapa; el teléfono de contacto es opcional.
4. Enviar y conservar la referencia. Adjuntar una foto de prueba sin datos personales. Si falta conexión, distinguir el envío pendiente de la confirmación del servidor.
5. Entrar al panel con la institución que corresponda al reporte y su cobertura. Revisar **Incidentes**, detalle, foto y ubicación. Un incidente fuera de cobertura puede no aparecer para esa cuenta.
6. Asignar directamente una sede y, si corresponde, su operador. Agregar otras sedes autorizadas y avanzar cada atención mediante sus tarjetas. Revisar los avisos y el historial autorizado.
7. Conservar la referencia de recepción en Android. Revisar Alertas y Contactos sin cuenta. El estado privado se consulta desde el panel institucional autorizado; el mapa público entrega datos agregados.

La subida de foto y el flujo HTTP se probaron contra Render. La comprobación física de cámara, galería, GPS y recorrido completo Android → panel → Android debe registrarse por separado; no equivale a la suite automatizada.

## Si algo falla

| Síntoma | Comprobación |
| --- | --- |
| Credenciales inválidas | Ambiente elegido, correo y contraseña vigente del seed; evitar espacios añadidos. |
| No aparecen incidentes | Institución/sede, cobertura y filtros de fecha/estado. |
| Foto pendiente | Conectividad, confirmación del reporte y vigencia del permiso de invitado; revisar el reintento de la app. No requiere login. |
| GPS denegado | Conceder permiso o seleccionar manualmente el lugar en el mapa. |
| API no disponible | Revisar `/api/health` y `/api/health/database`; comunicar hora y mensaje sin tokens ni contraseñas. |

No publicar capturas con datos personales, tokens o contraseñas. Todos los casos DEMO son ficticios y no deben provocar un despacho real.
