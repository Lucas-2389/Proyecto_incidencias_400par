# Guía rápida de usuarios y módulos

## Entrar al sistema

Panel institucional: https://gestion-incidencias-200e.onrender.com/login

Las cuentas siguientes son DEMO. La contraseña es la definida al ejecutar el seed correspondiente; solicitarla al responsable por un canal privado. No está en Git, no se incluye en esta guía y no se debe volver a sembrar la base para intentar corregir un login.

| Perfil | Cuenta de ejemplo | Uso |
| --- | --- | --- |
| SuperAdministrador | `superadmin@demo.invalid` | Supervisión global e instituciones/sedes; módulos administrativos y operativos. |
| Administración municipal | `admin-municipalidad@demo.invalid` | Recursos y atención dentro del ámbito municipal autorizado. |
| Administración PNP | `admin-pnp@demo.invalid` | Gestión institucional de PNP. |
| Administración SAMU | `admin-samu@demo.invalid` | Gestión institucional de SAMU. |
| Administración Bomberos | `admin-bomberos@demo.invalid` | Gestión institucional de Bomberos. |
| Operación institucional | `operator-municipalidad@demo.invalid`, `operator-pnp@demo.invalid`, `operator-samu@demo.invalid`, `operator-bomberos@demo.invalid` | Atención operativa limitada por institución y sede. |
| Ciudadano (Android) | `citizen@demo.invalid` | Reportar, consultar reportes propios y adjuntar fotos. También puede registrar una cuenta ciudadana desde Perfil. |

Los permisos se comprueban en la API. La visibilidad de un menú no concede acceso a información de otra institución. Las cuentas disponibles dependen del seed aplicado a la base del ambiente elegido.

## Panel institucional

| Módulo | Qué permite revisar o hacer |
| --- | --- |
| Dashboard | Resumen de actividad y acceso a incidentes recientes. |
| Incidentes | Bandeja, detalle, evidencias, atención, asignaciones y cambios de estado autorizados. |
| Mapa | Ubicación operativa de reportes con pictogramas, filtros y agrupaciones; vista pública agregada según permisos. |
| Instituciones | Organización y sedes; SuperAdministrador gestiona el ámbito global. |
| Unidades | Recursos móviles y disponibilidad del ámbito autorizado. |
| Personal | Personal institucional disponible para la operación. |
| Directorio | Contactos de emergencia administrados por el ámbito autorizado. |
| Historial | Eventos de auditoría según institución y sede. |
| Campana | Avisos internos y acceso al incidente relacionado. |

Operadores acceden a Dashboard, Incidentes y Mapa. Administradores acceden también a los módulos administrativos según su ámbito. El ciudadano utiliza la app Android.

## Recorrido de demostración

1. Instalar el APK descrito en [la guía móvil](../apps/mobile/README.md). Producción conecta a Render sin depender del PC.
2. Abrir **Perfil**, ingresar como ciudadano y entrar a **Reportar**.
3. Elegir categoría, describir un caso claramente ficticio y escribir una referencia de calle/lugar. Usar ubicación actual o seleccionar el punto en el mapa; el teléfono de contacto es opcional.
4. Enviar y conservar la referencia. Adjuntar una foto de prueba sin datos personales. Si falta conexión, distinguir el envío pendiente de la confirmación del servidor.
5. Entrar al panel con la institución que corresponda al reporte y su cobertura. Revisar **Incidentes**, detalle, foto y ubicación. Un incidente fuera de cobertura puede no aparecer para esa cuenta.
6. Usar los recursos disponibles para una asignación y avanzar mediante los estados que habilite el detalle. Revisar los avisos y el historial autorizado.
7. Volver a **Mis reportes** en Android y comprobar el estado y avisos. El mapa público entrega datos agregados, por lo que un reporte nuevo no tiene por qué aparecer como punto exacto.

La subida de foto y el flujo HTTP se probaron contra Render. La comprobación física de cámara, galería, GPS y recorrido completo Android → panel → Android debe registrarse por separado; no equivale a la suite automatizada.

## Si algo falla

| Síntoma | Comprobación |
| --- | --- |
| Credenciales inválidas | Ambiente elegido, correo y contraseña vigente del seed; evitar espacios añadidos. |
| No aparecen incidentes | Institución/sede, cobertura y filtros de fecha/estado. |
| Foto pendiente | Sesión activa, conectividad y confirmación del reporte; revisar el reintento de la app. |
| GPS denegado | Conceder permiso o seleccionar manualmente el lugar en el mapa. |
| API no disponible | Revisar `/api/health` y `/api/health/database`; comunicar hora y mensaje sin tokens ni contraseñas. |

No publicar capturas con datos personales, tokens o contraseñas. Todos los casos DEMO son ficticios y no deben provocar un despacho real.
