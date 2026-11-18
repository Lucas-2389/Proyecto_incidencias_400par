# Tasks

## 1. Datos de incidentes recientes

- [x] 1.1 Ampliar `apps/api/src/dispatch/operations.js` para devolver `categoryName` nullable mediante la relación con categorías, incluyendo inactivas. Verificar con una prueba de consulta autorizada que conserva campos, filtros, ámbito y nombres de categorías históricas.
- [x] 1.2 Actualizar `packages/contracts/openapi.yaml` con el nombre de categoría del listado operativo y verificar el contrato con `npm run contract:check` desde `apps/api`.

## 2. Dashboard accesible

- [x] 2.1 Integrar las ediciones locales existentes de Dashboard y sustituir las filas por bloques con enlace completo, categoría destacada, referencia secundaria, estado y `PriorityBadge`. Verificar por clic y Enter el acceso al incidente correcto, foco visible y ausencia de Ver reporte y columna Acción.
- [x] 2.2 Resolver nombre y prioridad desconocidos y estados de carga, error y vacío, conservando hasta seis incidentes recientes. Verificar esos casos y las cuatro prioridades, reutilizando o ampliando las pruebas de flujo administrativo pertinentes.

## 3. Consulta institucional del perfil

- [x] 3.1 Ampliar GET `/auth/me` para cuentas institucionales con roles y todas sus membresías activas, nombres de institución y sede y relación de cada asignación. Verificar varias membresías, administración sin sede, superadministrador global y ausencia de asignaciones en pruebas de perfil.
- [x] 3.2 Conservar para cuentas exclusivamente ciudadanas los cuatro campos actuales y para PATCH la lista de campos editables y su respuesta actual. Verificar `apps/api/test/profile.test.js`, incluyendo rechazo de modificaciones de privilegios, correo e identidad y lectura sin credenciales.
- [x] 3.3 Documentar en `packages/contracts/openapi.yaml` las variantes de GET institucional y ciudadano y sus respuestas, manteniendo el contrato de PATCH. Verificar `npm run contract:check` y las pruebas de contrato de autenticación desde `apps/api`.

## 4. Sesión y menú de cuenta

- [x] 4.1 Proteger en `apps/admin/src/api/client.js` la renovación y publicación de datos frente a cierre o cambio de identidad. Añadir una prueba de regresión con respuestas diferidas que demuestre que una renovación o guardado anterior no restablece ni elimina la nueva sesión.
- [x] 4.2 Incorporar en Shell el menú de cuenta con avatar, nombre, roles legibles y accesos a Mi perfil, Cambiar contraseña y Cerrar sesión. Verificar teclado, estado expandido, Escape, cierre exterior y retorno de foco.
- [x] 4.3 Registrar `/perfil` y el acceso a Seguridad mediante `/perfil#seguridad` para los tres roles institucionales y dirigir el cierre de sesión a `/login`. Verificar acceso directo sin sesión y con rol ciudadano y cierre local incluso con fallo de revocación remota.

## 5. Datos personales y seguridad

- [x] 5.1 Crear la página de perfil con Datos personales e Información institucional, carga, error y reintento. Mostrar todas las asignaciones y los estados Todas las sedes, Ámbito global y Sin asignación institucional activa. Verificar visualmente esos casos y el correo como dato de consulta.
- [x] 5.2 Conectar la edición de nombre y teléfono con PATCH `/auth/me`, actualizar el nombre confirmado de cabecera para la misma identidad y conservar cambios ante errores. Verificar guardado, eliminación de teléfono, rechazo de datos inválidos y prevención de envíos duplicados en el flujo de perfil.
- [x] 5.3 Incorporar el formulario de contraseña actual, nueva y confirmación con visibilidad y validaciones vigentes. Reutilizar la API y mostrar confirmación en Login al limpiar la sesión tras 204. Verificar contraseña incorrecta, longitud, confirmación, respuesta perdida y ausencia de reintentos automáticos del cambio.
- [x] 5.4 Ejecutar las pruebas pertinentes de perfil y sesión en API, incluida la integración MySQL con `RUN_MYSQL_INTEGRATION=1` sobre la base de pruebas configurada. Verificar la invalidación de tokens tras cambio de contraseña y la continuidad del cliente ciudadano.

## 6. Verificación integrada

- [x] 6.1 Ejecutar las pruebas administrativas pertinentes con `npm test` y compilar con `npm run build` desde `apps/admin`. Verificar el flujo Dashboard → detalle y menú → perfil → guardar → cambiar contraseña → ingresar para Operador, Administrador institucional y Superadministrador.
- [x] 6.2 Revisar escritorio y pantalla compacta, clic en todo el bloque, navegación por teclado, focos, etiquetas y mensajes de resultado. Verificar el resaltado sin subrayado y la distribución adaptable de Cobertura y reglas, que los campos y acciones son alcanzables y que el panel conserva la autorización por ámbito.

## 7. Ampliación a la bandeja de Incidentes

- [x] 7.1 Mostrar categoría destacada y referencia secundaria y extender el enlace a toda la fila, retirando Abrir y su columna. Verificar los flujos existentes de apertura desde la bandeja, sus indicadores y los nombres de categorías en respuestas actuales e históricas.

## 8. Ajustes visuales de la bandeja y Cobertura y reglas

- [x] 8.1 Aplicar una regla específica para presentar categoría y referencia sin subrayado al pasar el cursor, conservando el cambio de color y contorno de foco de la fila. Verificar la precedencia del selector en los estilos y la compilación de producción, con comprobación visual registrada en 6.2.
- [x] 8.2 Reorganizar Cobertura y reglas con sugerencias y formulario en áreas diferenciadas, jerarquía de institución, sede y motivo, campos agrupados y confirmación al pie. Verificar las 21 pruebas existentes de despacho y flujo y la compilación de producción, con revisión visual adaptable registrada en 6.2.

## Estado de verificación

- Implementación de 5.1 comprobada mediante pruebas de componentes y revisión visual de varias membresías, Todas las sedes, Ámbito global y Sin asignación institucional activa. El correo se presenta como dato de consulta.
- Verificación automatizada aprobada el 17 de noviembre de 2026 con 52 pruebas del panel, compilación de producción, validación OpenAPI y 7 pruebas seleccionadas de API con integración MySQL habilitada sobre la base aislada configurada.
- Después de los ajustes visuales de la bandeja y Cobertura y reglas, se ejecutaron las 21 pruebas de `dispatch-interface.test.jsx` y `flow.test.jsx` y la compilación de producción, con resultados aprobados.
- Revisión visual completada el 17 de noviembre de 2026 en Chrome a 1707 px de ancho y mediante emulación iPhone SE a 375 × 667 px. Se revisaron perfil, Dashboard, bandeja y Cobertura y reglas, con el perfil DEMO abierto y escenarios temporales de datos de prueba renderizados con los componentes reales.
- Se verificaron el resaltado sin subrayado, el foco visible de toda la fila y su apertura con Enter, la apertura al pulsar el estado y el espacio libre del bloque, la selección de sede, el foco de los campos y la confirmación alcanzable en móvil. Se corrigió un desbordamiento del encabezado y la tarjeta de la bandeja mediante estilos de contenedor, conservando el desplazamiento horizontal dentro de la tabla.
- Comprobación final aprobada con las 52 pruebas del panel, compilación de producción y tres integraciones MySQL de autorización por rol y ámbito, perfil institucional y perfil ciudadano. El archivo temporal de revisión y su pestaña fueron retirados al terminar.
