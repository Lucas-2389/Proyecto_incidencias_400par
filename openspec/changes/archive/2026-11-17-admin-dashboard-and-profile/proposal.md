# Proposal

## Why

El Dashboard muestra prioridades sin los colores utilizados en el resto del panel y exige abrir los reportes desde una acción pequeña. Identificar cada caso por su categoría y ofrecer un perfil institucional completo facilitará reconocer incidentes y gestionar los datos de la cuenta.

## What Changes

- Mostrar en Dashboard las insignias existentes de prioridad, con texto, color y alertas para Alta y Crítica.
- Abrir cada incidente desde su bloque completo, con acceso por teclado, y retirar «Ver reporte» y la columna «Acción».
- Usar la categoría como título principal y conservar la referencia del reporte como dato secundario.
- Extender a la bandeja de Incidentes el nombre de categoría destacado y la apertura desde la fila completa, retirando Abrir.
- Resaltar la fila mediante cambio de color al pasar el cursor, manteniendo categoría y referencia sin subrayado.
- Ordenar Cobertura y reglas con sedes sugeridas, formulario de asignación y confirmación al pie, con distribución adaptable y conservación de sus acciones y validaciones.
- Incorporar un menú de cuenta con nombre y rol legibles y accesos a Mi perfil, Cambiar contraseña y Cerrar sesión.
- Ofrecer a operadores y administradores edición de nombre y teléfono, consulta de correo y asignaciones institucionales y cambio de contraseña con nuevo ingreso obligatorio.

## Capabilities

### New Capabilities

- `admin-dashboard`: reconocimiento de incidentes mediante categoría, referencia y prioridad, y apertura accesible desde el Dashboard y la bandeja.
- `institutional-profile`: consulta y edición del perfil propio y cambio de contraseña de usuarios institucionales.

### Modified Capabilities

- `admin-navigation`: acceso al perfil y seguridad desde el menú de cuenta y cierre explícito de sesión.
- `admin-incident-detail`: organización visual de Cobertura y reglas para consultar sugerencias y completar la asignación.

## Impact

- Frontend en `apps/admin`, especialmente Dashboard, Incidentes, Shell, rutas, sesión y estilos. Se reutilizará `PriorityBadge`.
- API de incidentes operativos con `categoryName` adicional y API de perfil con información institucional de consulta, conservando los campos publicados para los clientes actuales.
- Reutilización de `/auth/me` y `/auth/password/change`, de las membresías y de la política vigente de contraseñas. Actualización del contrato OpenAPI y verificaciones pertinentes.
- El cambio de correo y las preferencias de notificaciones quedan como propuestas futuras.
- Los ajustes de resaltado y Cobertura y reglas se limitan a presentación, jerarquía visual y distribución de los controles existentes.
