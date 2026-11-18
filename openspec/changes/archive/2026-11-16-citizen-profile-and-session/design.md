# Design

## Context

Ver motivación y alcance en `proposal.md`. La base `users` contiene nombre y correo, pero carece de teléfono. `ProfileScreen` combina ingreso y registro, y muestra un perfil de consulta. `ReportScreen` ya envía un contacto opcional y guarda ese valor en los pendientes. Su validación admite hasta 20 caracteres y entre 7 y 15 dígitos.

`ApiClient` guarda refresh token en FlutterSecureStorage, pero `main.dart` omite `restore()`. La restauración actual elimina las credenciales ante cualquier error. Además, `/auth/refresh` entrega tokens sin usuario, por lo que restaurar tokens por sí solo no recupera el perfil. El shell escucha cambios de API y limpia las vistas privadas al cambiar la identidad.

La API dispone de bcrypt, política de 12 a 128 caracteres, `credential_version`, tokens revocables y transacciones de recuperación de contraseña. Los tests de sesión y los widgets existentes permiten ampliar la cobertura desde sus entradas habituales.

## Goals / Non-Goals

### Goals

Guardar el perfil en servidor, preservar contactos por reporte, restaurar identidad y datos de forma consistente y organizar cada formulario alrededor de una acción principal. Incorporar protección de concurrencia al renovar sesiones y cambiar contraseñas.

### Non-Goals

El alcance acordado comprende nombre y teléfono editables, consulta de correo y cambio de contraseña autenticado. Verificación por SMS, cambio de correo, foto de perfil y recuperación por correo quedan para propuestas posteriores.

## Decisions

### 1. Perfil propio en servidor

Agregar `users.phone VARCHAR(20) NULL` mediante la siguiente migración disponible, preservando cuentas anteriores con teléfono nulo. Crear `GET /auth/me` y `PATCH /auth/me`, autenticados, derivados de `req.auth.user.id`. Responder con `id`, `name`, `email` y `phone`, excluyendo hashes y secretos.

PATCH admite únicamente `name` y `phone`. Un campo omitido conserva su valor, y teléfono vacío o nulo lo elimina. Nombre se recorta y valida con el límite existente de 150 caracteres. Reutilizar la validación telefónica del reporte, extrayendo solo la lógica compartida cuando sea necesario y conservando sus formatos admitidos. Rechazar claves adicionales, en particular correo, rol, id y contraseña, con 422 y sin actualización parcial. La autorización de identidad siempre se resuelve en servidor.

Persistir en servidor permite recuperar los datos desde otro dispositivo. Un teléfono almacenado solo en preferencias locales no cumpliría ese comportamiento. Documentar endpoints, campos y errores en OpenAPI. El perfil es privado y mantiene las cabeceras `no-store` existentes.

### 2. Cambio de contraseña y sesiones

Crear `POST /auth/password/change` autenticado con `currentPassword` y `newPassword`. La confirmación se compara en la IU. Reutilizar bcrypt y su política vigente. Bajo bloqueo del usuario, verificar la contraseña actual y guardar el hash nuevo, incrementar `credential_version`, revocar todos los refresh tokens y consumir enlaces de recuperación pendientes del usuario, en la misma transacción. Contraseña actual incorrecta devuelve 400 con un mensaje de corrección. Aplicar el limitador existente a esta operación por identidad y origen.

Responder 204 al confirmar. El cliente borra la sesión y los campos de contraseña, retira rutas privadas y muestra confirmación en ingreso. Los JWT emitidos anteriormente fallan por versión de credenciales. Cubrir renovación concurrente para que ningún token previo pueda sobrevivir al cambio. Si se pierde la respuesta después del commit, informar que el resultado es incierto y ofrecer ingresar de nuevo, conservando un mensaje comprensible ante la siguiente invalidación. La recuperación por enlace existente tiene un propósito distinto del cambio autenticado.

### 3. Restauración en segundo plano con perfil actualizado

Iniciar la restauración una vez tras montar la aplicación. Cargar el token guardado, renovar y consultar `/auth/me`. El ingreso y registro también cargan el perfil propio. Un endpoint propio evita cambiar la forma de respuesta de refresh que ya consumen otros clientes. Actualizar el estado de usuario y notificar al shell cuando corresponda.

Representar restauración en curso y fallo recuperable de forma explícita. Un 401 definitivo descarta credenciales. Fallos de transporte o 5xx conservan el refresh token y ofrecen Reintentar desde Perfil. Si la renovación tuvo éxito y luego falla `/auth/me`, conservar el token rotado y reintentar la consulta de perfil. Evitar bucles de renovación.

Compartir una sola renovación en curso entre peticiones para respetar la rotación de tokens del servidor. Usar una generación de sesión que cambie al salir o ingresar con otra cuenta, comprobándola antes de aplicar respuestas y escrituras tardías. Serializar la persistencia para que una respuesta vieja no restaure el token borrado durante logout. Limpiar datos de perfil y teléfono al cambiar identidad, reutilizando el listener del shell. Las vistas públicas siguen accesibles durante este proceso.

### 4. Teléfono inicial y copia por reporte

Inicializar el contacto al abrir un reporte nuevo con el teléfono del usuario actual. Escuchar la llegada del perfil si aún se está restaurando. Distinguir el campo intacto de una edición manual, incluido el borrado, y aplicar el autocompletado solo al primero. Después de un envío, inicializar el formulario nuevo con el teléfono vigente.

Cambiar el teléfono únicamente dentro del reporte conserva el perfil. Su valor final se copia al cuerpo enviado y a `PendingReport`, como ya ocurre con `callerContact`. Reintentar un pendiente conserva ese cuerpo. El servidor no consulta el perfil para rellenar contactos omitidos, porque el usuario puede borrarlos deliberadamente. Tras logout o cambio de cuenta, eliminar del campo el contacto de la identidad anterior, preservando los demás datos del borrador. Los datos históricos confirmados y pendientes conservan su copia original.

### 5. Distribución de pantallas

Mi perfil muestra nombre y correo, seguido de accesos a Datos personales, Seguridad y Cerrar sesión. Datos personales muestra nombre y teléfono editables, correo como texto de consulta y Guardar cambios. Seguridad abre el formulario de contraseña actual, nueva y confirmación. Mantener la navegación de Perfil y sus rutas privadas integrada con la limpieza existente del shell.

Aplicar 24 px de margen horizontal, 16 px entre campos y 24–32 px entre secciones a los formularios de cuenta. Reutilizar ThemeData, ScreenPadding y componentes actuales cuando encajen. Usar contenido desplazable y SafeArea, controlar la apertura del teclado y probar escala de texto ampliada. Añadir controles con etiqueta accesible para ver contraseñas, ayudas de longitud, errores junto al campo, progreso, bloqueo de envíos duplicados y confirmaciones. Actualizar nombre en cabecera tras guardar, sin cerrar rutas por un cambio del nombre.

## Risks / Trade-offs

- Rotación de refresh tokens y respuestas tardías. Mitigar con renovación compartida, generación de sesión y pruebas con respuestas controladas y logout concurrente.
- Teléfono autocompletado que llega durante una edición. Mitigar registrando cambios manuales y comprobando identidad antes de aplicar datos.
- Formularios apretados con teclado o texto grande. Verificar tamaños compactos, desplazamiento y una revisión visual en Android.
- Esquema de aplicación distinto del esquema de test. Aplicar y verificar la migración aditiva en ambas bases antes de instalar el APK local.
- Tres cambios activos comparten `citizen-mobile`. Conservar nombres específicos de requisitos y reconciliar los deltas antes de sincronizar. Este cambio amplía el alcance previo que dejaba la restauración de sesión para trabajo posterior.

## Migration Plan

1. Ejecutar la migración aditiva en la base aislada de test, probar cuentas previas y endpoints, y actualizar OpenAPI.
2. Aplicar la migración en la base de aplicación local y verificar el esquema antes de distribuir el APK. Publicar API antes de usar el nuevo cliente.
3. Compilar con `APP_ENV=development` y `API_BASE_URL=http://127.0.0.1:3000/api/v1`, activar `adb reverse tcp:3000 tcp:3000` e instalar con `adb install -r`, conforme a la entrega local ya acordada.
4. Verificar perfil, teléfono en reporte, reapertura y contraseña en el dispositivo. Para revertir, reinstalar el cliente previo y conservar la columna aditiva. El cambio de contraseña confirmado sigue vigente y requiere ingreso con la credencial nueva.
