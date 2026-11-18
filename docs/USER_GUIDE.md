# Guía rápida de usuarios y módulos

## Entrar al sistema

Panel institucional: https://gestionincidencias.cfd/login

Para desarrollar en otra computadora, usar el panel local `http://127.0.0.1:5173/login` después de [preparar el entorno](02-guias/COLABORACION.md). Sus cuentas y datos pertenecen a la base local y son independientes del servicio publicado.

Las cuentas siguientes son DEMO. La contraseña es la definida al ejecutar el seed correspondiente; solicitarla al responsable por un canal privado. No está en Git, no se incluye en esta guía y no se debe volver a sembrar la base para intentar corregir un login.

| Perfil | Cuenta de ejemplo | Uso |
| --- | --- | --- |
| SuperAdministrador | `superadmin@demo.invalid` | Supervisión global e instituciones/sedes; módulos administrativos y operativos. |
| Administración municipal | `admin-municipalidad@demo.invalid` | Recursos y atención dentro del ámbito municipal autorizado. |
| Administración PNP | `admin-pnp@demo.invalid` | Gestión institucional de PNP. |
| Administración SAMU | `admin-samu@demo.invalid` | Gestión institucional de SAMU. |
| Administración Bomberos | `admin-bomberos@demo.invalid` | Gestión institucional de Bomberos. |
| Operación institucional | `operator-municipalidad@demo.invalid`, `operator-pnp@demo.invalid`, `operator-samu@demo.invalid`, `operator-bomberos@demo.invalid` | Atención operativa limitada por institución y sede. |
| Ciudadano (Android) | Invitado o cuenta ciudadana propia | Puede reportar sin cuenta. Perfil permite registrarse, ingresar y consultar Mis reportes con sesión activa. |


Los permisos se comprueban en la API. La visibilidad de un menú no concede acceso a información de otra institución. Las cuentas disponibles dependen del seed aplicado a la base del ambiente elegido.

## Panel institucional

| Módulo | Qué permite revisar o hacer |
| --- | --- |
| Dashboard | Indicadores e incidentes recientes del distrito seleccionado y del ámbito autorizado. |
| Incidentes | Bandeja, detalle, evidencias, atención, asignaciones y cambios de estado autorizados. |
| Mapa | Ubicación operativa de reportes y sedes, con filtros y límites distritales referenciales del INEI. |
| Instituciones | Sedes agrupadas por institución, distrito y cuentas individuales con acceso por sede. |
| Contactos de emergencia | Teléfonos nacionales y locales publicados para la app ciudadana. Conserva la ruta `/directorio`. |
| Historial | Quién cambió qué, valores anteriores y nuevos disponibles, búsqueda, filtros y páginas de eventos autorizados. |
| Campana | Avisos internos y acceso al incidente relacionado. |

Operadores acceden a Dashboard, Incidentes y Mapa. Administradores acceden también a los módulos administrativos según su ámbito. El ciudadano utiliza la app Android.

## Recorrido de demostración

Los selectores territoriales utilizan Ayacucho, Carmen Alto, San Juan Bautista, Jesús Nazareno y Andrés Avelino Cáceres Dorregaray. El distrito del incidente se calcula mediante su ubicación. En los mapas se destaca y encuadra el distrito seleccionado, incluso cuando carece de reportes. La app publica ubicaciones aproximadas, por lo que un marcador cercano a una frontera puede aparecer visualmente al otro lado del contorno.

En **Instituciones**, guardar una sede ofrece **Crear usuario para esta sede**. Completar nombre, correo, contraseña inicial de 12 a 128 caracteres y rol autorizado. Si falla el alta del usuario, el mensaje **Sede creada. Usuario pendiente** permite reintentar sobre la sede guardada. Cada persona utiliza su cuenta individual. El superadministrador crea operadores y administradores institucionales y cada administrador institucional gestiona operadores de las sedes autorizadas. Las cuentas con varios ámbitos requieren permiso sobre todos los ámbitos afectados por una edición global.

En **Contactos de emergencia**, elegir ámbito, distrito, institución y sede opcional. Editar o desactivar un teléfono actualiza su siguiente consulta pública. La app permite seleccionar distrito por nombre y mantiene la última lista nacional confirmada para uso sin conexión, con fecha de actualización. La primera apertura sin Internet utiliza los números nacionales de respaldo.

En **Historial**, periodo, distrito e institución también delimitan los indicadores operativos. Acción, sede, tipo y búsqueda se aplican al listado de eventos. **Ver cambio** muestra los campos disponibles y **Referencia técnica** conserva los identificadores para soporte. Un evento antiguo puede carecer de datos anteriores o de nombres recuperables. El promedio de asignación mide los minutos desde el registro hasta cada asignación visible de los incidentes del periodo.

1. Instalar el APK descrito en [la guía móvil](../apps/mobile/README.md). Producción conecta a Render sin depender del PC.
2. Abrir la app y entrar directamente a **Reportar**, sin registro ni contraseña.
3. Elegir categoría, describir un caso claramente ficticio y escribir una referencia de calle/lugar. Usar ubicación actual o seleccionar el punto en el mapa; el teléfono de contacto es opcional.
4. Enviar y conservar la referencia. Adjuntar una foto de prueba sin datos personales. Si falta conexión, distinguir el envío pendiente de la confirmación del servidor.
5. Entrar al panel con la institución que corresponda al reporte y su cobertura. Revisar **Incidentes**, detalle, foto y ubicación. Un incidente fuera de cobertura puede no aparecer para esa cuenta.
6. Usar los recursos disponibles para una asignación y avanzar mediante los estados que habilite el detalle. Revisar los avisos y el historial autorizado.
7. Conservar la referencia de recepción en Android. Revisar Alertas y Contactos sin cuenta. Con sesión ciudadana, abrir Mis reportes para consultar el seguimiento propio. El mapa público muestra posiciones aproximadas y excluye información sensible; el panel aplica los permisos institucionales.

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


## Iniciar los servidores locales

Para preparar otra computadora por primera vez, seguir [la guía de colaboración](02-guias/COLABORACION.md): configuración privada, dependencias, migraciones, carga territorial y cuentas DEMO. La tabla siguiente corresponde al arranque diario después de esa preparación. Ejecutar desde la raíz del repositorio y mantener API y panel en terminales distintas.

| Servicio | Comando | Comprobación |
| --- | --- | --- |
| MySQL | `docker compose up -d mysql` | Esperar `healthy` en `docker compose ps`. |
| Backend | `npm.cmd start --prefix apps/api` | `Invoke-RestMethod 'http://127.0.0.1:3000/api/health/database'`. |
| Panel web | `npm.cmd run dev --prefix apps/admin -- --strictPort` | Abrir `http://127.0.0.1:5173/login`. |
| App móvil USB | `powershell -ExecutionPolicy Bypass -File .\scripts\run-mobile-local.ps1` | Teléfono con depuración autorizada y API activa. El script prepara el túnel e inicia Flutter. |

Las cuentas y contraseñas locales son las de la propia base, no las del servicio publicado. Ctrl+C detiene API, Vite o Flutter. `docker compose stop mysql` detiene MySQL conservando los datos.

| Conexión | URL en Flutter | Requisito |
|---|---|---|
| Por USB | `http://127.0.0.1:3000/api/v1` | Ejecutar `adb reverse tcp:3000 tcp:3000` |
| Emulador Android estándar | `http://10.0.2.2:3000/api/v1` | API activa en el host; ejecutar Flutter con `APP_ENV=development`. |
| Por Wi-Fi | Por ejemplo, `http://192.168.1.25:3000/api/v1` | Usar la IP real del equipo, compartir red y permitir acceso al backend mediante el firewall |

Las conexiones móviles locales requieren `APP_ENV=development` y la URL correspondiente. Sin túnel, `127.0.0.1` se refiere al teléfono. Cambiar los argumentos `--dart-define` requiere detener y volver a ejecutar Flutter; el script USB ya configura ambos valores.
