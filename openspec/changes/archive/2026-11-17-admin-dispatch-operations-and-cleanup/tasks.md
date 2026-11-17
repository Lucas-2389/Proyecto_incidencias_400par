# Tasks

## 1. Contrato operativo y consistencia del despacho

- [x] 1.1 Añadir `GET /ops/incidents/{id}/operators?siteId={siteId}` con validación de sede, ámbito del incidente y sede, rol operativo y proyección deduplicada de operadores activos `{ id, name }`. Verificar acceso con Operador, administrador y superadministrador, lista vacía, sede inactiva, identificador inválido y rechazos por ámbito en las pruebas de API correspondientes.
- [x] 1.2 Documentar el endpoint en `packages/contracts/openapi.yaml`, incluidos parámetros, proyección mínima y errores. Verificar `npm.cmd --prefix apps/api run contract:check` y el contrato de rutas operativas.
- [x] 1.3 Reutilizar la regla de etapa mínima entre alta y avance de asignaciones y recalcular el global bajo el bloqueo del incidente. Verificar en `incident-lifecycle.test.js` que añadir una sede durante En atención actualiza el global a Asignado, preserva el estado de las otras sedes y registra un único evento global cuando cambia.
- [x] 1.4 Ampliar los casos de integración existentes de despacho para dos altas simultáneas de sedes distintas, duplicación de la misma sede, fallo con rollback y rechazo de altas sobre Resuelto o Cerrado. Verificar unicidad, estados, historial y auditoría en una base de pruebas con `RUN_MYSQL_INTEGRATION=1`, conservando cobertura de reservas para consumidores con recursos.

## 2. Navegación administrativa

- [x] 2.1 Retirar enlaces, rutas e importación `Resources` en `App.jsx` conservando `Organization`. Verificar en las pruebas existentes de acceso y navegación que los roles administrativos carecen de esos enlaces, las URL antiguas redirigen y la sección Instituciones sigue disponible según rol.
- [x] 2.2 Ajustar el apartado de navegación de `docs/02-guias/USUARIOS.md` y las referencias concretas afectadas de `operational-mvp`. Verificar que la documentación describe las secciones realmente accesibles y conserva el ámbito del resto de capacidades.

## 3. Mapa operativo y filtros

- [x] 3.1 Eliminar de `MapView.jsx` el modo de calor, su solicitud, controles y representación. Verificar con las pruebas de interfaz aplicables que abrir el mapa consulta puntos operativos y conserva marcadores, grupos, sedes, leyenda y enlaces al detalle.
- [x] 3.2 Reordenar Tipo de incidente, Distrito y Fechas opcionales, cargar distritos por nombre desde el catálogo y presentar carga, error y reintento. Verificar orden y etiquetas accesibles, selección por identificador, Todos los distritos y transmisión conjunta de filtros.
- [x] 3.3 Aplicar siete días con fechas inicialmente vacías, mostrar el periodo efectivo y validar el par de fechas personalizadas en America/Lima con fin exclusivo del día posterior y máximo de 90 días. Verificar un mismo día, ambas vacías, una fecha, intervalo invertido, límite de 90 días y persistencia de filtros ante error.
- [ ] 3.4 Actualizar la guía de uso del mapa y las referencias afectadas de `operational-mvp`. Verificar visualmente el orden de filtros y la documentación del periodo predeterminado y de las consultas demasiado amplias.

## 4. Información del reporte y minimapa

- [x] 4.1 Incorporar el bloque Triage rápido con booleanos explícitos, valores desconocidos, cantidad, subtipo y referencia a la persona principal descrita. Verificar mediante las pruebas del detalle respuestas `false`, `true`, `null`, cero afectados, reporte histórico y subtipo fuera del catálogo activo.
- [x] 4.2 Incorporar el minimapa diferido con coordenadas del detalle, configuración cartográfica existente, referencia y alternativa textual ante error. Verificar punto correcto, coordenadas cero, rangos inválidos, ausencia de ubicación y cambio de incidente sin conservar el centro anterior.
- [ ] 4.3 Ajustar estilos responsivos del bloque clínico y minimapa y documentar su lectura en la guía. Verificar visualmente la información y el minimapa en escritorio y ancho móvil, incluyendo fallo de teselas sin bloquear el resto del detalle.

## 5. Despacho directo y seguimiento concurrente

- [x] 5.1 Simplificar el formulario a Sede y Operador opcional, eliminando estados, consultas y controles de recursos. Usar la nueva consulta operativa con carga, error y vacío, limpiar operador al cambiar sede y descartar respuestas tardías. Verificar un despacho desde el rol Operador, el envío sin arreglos de recursos y la corrección manual con motivo.
- [x] 5.2 Presentar tarjetas por asignación con institución, sede, operador o indisponibilidad, estado y fechas, cerradas al final y avance individual. Verificar dos instituciones con estados distintos, operador pendiente, operador histórico ausente y acciones con el `assignmentId` correcto en las pruebas de flujo.
- [x] 5.3 Contextualizar el historial con institución y sede de las asignaciones visibles y usar el estado global del detalle. Verificar una vista parcial y eventos de asignación visibles y ajenos sin exponer identificadores internos como etiquetas.
- [x] 5.4 Añadir actualización manual, ciclo de aproximadamente 15 segundos en pestaña visible y recarga al recuperar visibilidad, coordinando respuestas para evitar datos anteriores y conservando la edición y última lectura válida. Verificar con temporizadores controlados pausa y limpieza al desmontar o cambiar incidente, respuesta tardía, error de lectura y actualización desde otra sesión.
- [x] 5.5 Bloquear el doble envío por acción pendiente y recuperar conflictos 409 mediante lectura actualizada, conservando el formulario. Verificar que una escritura exitosa seguida de fallo de lectura muestra confirmación y permite reintentar únicamente la lectura.
- [x] 5.6 Documentar despacho sin recursos, participación simultánea, tarjetas y estado global en la guía y reconciliar las referencias concretas de despacho de `operational-mvp`. Verificar el recorrido documentado con las pruebas de flujo existentes ampliadas.

## 6. Control replegable

- [x] 6.1 Hacer Verificar y priorizar expandible mediante teclado y `aria-expanded`, replegado inicialmente después de Fotografías y tras confirmar Guardar verificación o Iniciar verificación. Incluir prioridad editable con motivo. Verificar reapertura, resultado visible fuera del contenido, edición conservada ante rechazo y guardado de prioridad con el resultado de verificación seleccionado.
- [x] 6.2 Documentar el repliegue del panel de Control y verificar en una prueba de flujo que el despacho y las tarjetas siguen disponibles tras la confirmación y que abrir otro incidente restablece el control replegado.

## 7. Validación integrada

- [x] 7.1 Ejecutar `npm.cmd --prefix apps/admin test`, `npm.cmd --prefix apps/admin run build`, `npm.cmd --prefix apps/api test` y la validación de contrato. Registrar por separado los casos de integración MySQL ejecutados y cualquier caso omitido, verificando el cumplimiento de los escenarios del cambio.
- [ ] 7.2 Recorrer el panel con dos sesiones institucionales y un superadministrador para confirmar sedes, observar sus estados independientes, recuperar un conflicto y consultar triage y ubicación. Verificar el ámbito visible, el estado agregado y el repliegue del control en el recorrido completo.
- [x] 7.3 Ejecutar `openspec validate admin-dispatch-operations-and-cleanup --strict` y revisar la correspondencia entre los requisitos, las tareas completadas y los cambios reales antes de solicitar el cierre del cambio.

## Registro de verificación

- Panel verificado con 33 pruebas aprobadas en 8 archivos, build de producción correcto y `git diff --check` sin incidencias. Incluye la distribución revisada de ubicación y Control, prioridad editable y presentación uniforme de filtros de fecha.
- API verificada con `RUN_MYSQL_INTEGRATION=1` en la base aislada `incidencias_dispatch_test`, creada con las 13 migraciones y seeds de referencia y DEMO. Resultado de la suite completa de 84 casos, 83 aprobados y 1 omitido. La prueba omitida es la reconciliación de seed que exige `DB_SEED_TEST_NAME`, ajena a este cambio. Después del ajuste final de existencia de incidente, se repitieron las pruebas de despacho y contrato con 2/2 aprobadas.
- OpenAPI válido con 63 rutas y 4 roles. Validación estricta de este cambio y `operational-mvp` aprobada.
- La primera ejecución de la suite en `incidencias_test` encontró 7 subtipos médicos frente a los 3 esperados por el test de catálogo. La repetición en la base aislada con seeds del proyecto aprobó esa prueba.
- Recorrido HTTP real con sesiones PNP, SAMU y SuperAdministrador sobre el reporte DEMO `INC-2026-C3B8885EC24C`, identificador `3194a582-6ab8-422d-9373-bb439e40976c`. Se confirmaron dos sedes sin recursos, un avance independiente, conflicto 409 ante transición repetida, visibilidad de 1/1/2 asignaciones por cuenta, estado global Asignado, triage fiel, coordenadas y entrega del frontend con HTTP 200.
- Las tareas 3.4 y 4.3 tienen documentación y estilos implementados. Su comprobación visual en escritorio y ancho móvil sigue pendiente. La tarea 7.2 tiene recorrido HTTP y cobertura automatizada de interfaz, con recorrido visual real pendiente. El host de navegador de computer-use estuvo indisponible y la selección de Chrome agotó el tiempo de aprobación de la aplicación. Estas tres casillas permanecen abiertas.
