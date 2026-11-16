# Tasks

## 1. Perfil propio persistido

- [x] 1.1 Crear la siguiente migración aditiva disponible para `users.phone` nullable. Verificar con la base aislada de test que preserva cuentas existentes y que repetir el runner no reaplica la migración.
- [x] 1.2 Implementar GET y PATCH `/auth/me` con identidad de sesión, nombre y teléfono opcional. Reutilizar la validación telefónica del reporte preservando su comportamiento. Verificar pruebas API/MySQL para lectura, edición, eliminación de teléfono, nombre vacío, teléfono inválido y acceso sin sesión.
- [x] 1.3 Rechazar campos adicionales en PATCH y omitir secretos en respuestas. Verificar pruebas de intento de modificar correo, rol, id y contraseña, garantizando que un rechazo no guarde cambios parciales ni afecte otra cuenta.
- [x] 1.4 Documentar endpoints, campos y errores de perfil en `packages/contracts/openapi.yaml`. Verificar pruebas de contrato y `npm.cmd run contract:check` desde `apps/api`.

## 2. Cambio autenticado de contraseña

- [x] 2.1 Implementar POST `/auth/password/change` con contraseña actual, política existente y limitación de intentos. Actualizar hash, versión de credenciales, revocación de refresh tokens y consumo de enlaces de recuperación pendientes de forma transaccional. Verificar pruebas API/MySQL de éxito, credencial actual incorrecta, longitud inválida y rollback ante fallo.
- [x] 2.2 Cubrir cambio de contraseña concurrente con renovación y uso posterior de tokens. Verificar que las sesiones anteriores dejan de autorizar solicitudes y que la contraseña nueva permite un nuevo ingreso.
- [x] 2.3 Añadir el contrato de cambio de contraseña, respuesta 204 y errores en OpenAPI. Verificar la comprobación de contrato y rechazo de solicitudes sin autenticación.

## 3. Cliente y continuidad de sesión

- [x] 3.1 Añadir operaciones de consulta y guardado de perfil y cambio de contraseña en `ApiClient`, sincronizando los datos del usuario tras ingreso, registro y edición. Verificar con MockClient los cuerpos enviados, correo inmutable, errores sin pérdida de edición y actualización de nombre/teléfono.
- [x] 3.2 Implementar una renovación compartida y proteger respuestas y persistencia tardías con generación de sesión. Verificar pruebas de peticiones simultáneas, logout y cambio de cuenta durante renovación para evitar recuperar la identidad o el token anterior.
- [x] 3.3 Iniciar restauración en segundo plano desde el arranque, recuperar `/auth/me` y ofrecer reintento ante fallo transitorio. Verificar pruebas de inicio con sesión válida, ausencia de token, credenciales invalidadas, fallo de red y fallo de perfil tras una renovación exitosa, conservando las vistas públicas accesibles.

## 4. Formularios de cuenta y distribución

- [x] 4.1 Reorganizar Perfil con accesos a Datos personales, Seguridad y Cerrar sesión. Implementar nombre/teléfono editables y correo de consulta, con Guardar cambios, progreso, errores y confirmación. Verificar navegación por AppBar y menú, guardado, borrado de teléfono y limpieza al cambiar identidad mediante widgets.
- [x] 4.2 Crear el formulario de cambio de contraseña con contraseña actual, nueva, confirmación y controles de visibilidad. Tras éxito limpiar la sesión y rutas privadas y mostrar confirmación en ingreso. Verificar widgets de discrepancia, fallo del servidor, doble pulsación, éxito e intento de volver a la vista privada con Atrás.
- [x] 4.3 Aplicar 24 px de margen horizontal, 16 px entre campos y 24–32 px entre grupos a ingreso, registro y edición, con ayudas de longitud y etiquetas accesibles. Verificar widgets en pantalla compacta, teclado abierto y texto ampliado para asegurar desplazamiento, acciones alcanzables y ausencia de overflow.
- [x] 4.4 Actualizar los apartados de cuenta y sesión de `apps/mobile/README.md` para reflejar las pantallas y su comportamiento. Verificar coherencia con los flujos de widgets y comandos locales existentes.

## 5. Contacto inicial del reporte

- [x] 5.1 Autocompletar contacto desde el perfil al abrir un reporte nuevo o al llegar un perfil restaurado, respetando cambios y borrados manuales. Verificar widgets con carga tardía, perfil sin teléfono, edición manual y nuevo formulario después de enviar.
- [x] 5.2 Limpiar el teléfono de la identidad anterior al salir o cambiar cuenta y conservar el resto del borrador. Verificar pruebas de invitado y dos cuentas para impedir reutilización del contacto privado anterior.
- [x] 5.3 Conservar la copia del contacto final en cada reporte y pendiente sin autocompletar desde servidor. Verificar envío con contacto modificado o eliminado, perfil actualizado después del envío, reintento offline y consulta de un reporte histórico.

## 6. Integración y entrega local

- [x] 6.1 Ejecutar Flutter analyze y la suite Flutter, API con RUN_MYSQL_INTEGRATION=1 en la base aislada y comprobación OpenAPI. Registrar resultados y resolver regresiones relacionadas con perfil, sesión, contacto y cambio de contraseña.
- [x] 6.2 Aplicar la migración en la base local de aplicación, comprobar salud HTTP y de base y compilar e instalar el APK de desarrollo por USB con los parámetros del diseño. Verificar el esquema real y apertura del APK usando la misma API que el panel local.
- [x] 6.3 Revisar visualmente ingreso, registro, Mi perfil, Datos personales y Seguridad en Android, incluyendo teclado abierto. Registrar cualquier ajuste de espaciado necesario y confirmar que campos y acciones son alcanzables.
- [x] 6.4 Verificar en el entorno local el recorrido de ingreso, edición de nombre/teléfono, reapertura de app, reporte con contacto autocompletado, consulta del contacto por personal autorizado y cambio de contraseña con nuevo ingreso. Registrar resultados y referencia DEMO sin copiar credenciales a los artefactos.
- [x] 6.5 Ejecutar `openspec validate citizen-profile-and-session --strict` y revisar la compatibilidad con los deltas ciudadanos de los otros cambios activos. Verificar que sus requisitos y tareas pendientes se conservan al preparar la sincronización.

## Resultados de verificación

- Suite Flutter completa con 27 pruebas aprobadas y una prueba remota opcional omitida. Análisis Flutter sin incidencias. Las pruebas de sesión cubren renovación compartida, red transitoria, perfil pendiente después de rotación y respuestas tardías tras logout o cambio de cuenta.
- API con MySQL real de test, 79 pruebas aprobadas y una prueba opcional de seed omitida por configuración. OpenAPI válido con 60 rutas y 4 roles.
- Migración 013 aplicada en `incidencias_test` y `incidencias`. Segunda ejecución en test con cero migraciones aplicadas. API local y base con salud HTTP 200.
- Recorrido HTTP local de cuenta DEMO con edición, renovación, reporte y cambio de contraseña confirmado. Referencia `INC-2026-C760C5905FDB`, descripción de prueba técnica. La comprobación en base confirmó que editar el teléfono después del envío preserva el contacto del reporte.
- APK de desarrollo local compilado e instalado en el Samsung `SM_A346M` con resultado Success tras autorizar ADB. Apertura de MainActivity y túnel USB al puerto 3000 verificados, junto con salud HTTP y de base en 200. Se agregó la ejecución VS Code Móvil local por USB para fijar los parámetros en próximas ejecuciones.
- Revisión visual Android completada el 2026-11-16 para ingreso, registro, Mi perfil, Datos personales y Seguridad. Se inspeccionaron capturas con teclado abierto y se comprobó el desplazamiento hasta la acción Ingresar. Los campos y acciones resultaron alcanzables, con separación legible y sin desbordamientos observados. No fueron necesarios ajustes adicionales de espaciado.
- Recorrido móvil local completado con una cuenta DEMO. Se inició sesión, se editó nombre y teléfono, se cerró y reabrió la app y se recuperaron la sesión y los datos guardados. El teléfono apareció autocompletado en Reportar y el envío desde el Samsung confirmó la referencia `INC-2026-27B9980CD821`, identificada como prueba técnica. Una consulta HTTP autenticada con una cuenta DEMO SuperAdministrador confirmó el contacto del reporte. Se cambió la contraseña desde Seguridad, se observó la confirmación de cierre de sesión y se ingresó correctamente con la nueva contraseña. Al terminar se cerró la sesión DEMO en el teléfono. Las credenciales permanecieron fuera de estos artefactos.
- OpenSpec validado en modo estricto. Se conserva la tarea pendiente 6.4 de `citizen-mobile-identity-and-tracking`, que corresponde a una verificación distinta del cambio anterior.
