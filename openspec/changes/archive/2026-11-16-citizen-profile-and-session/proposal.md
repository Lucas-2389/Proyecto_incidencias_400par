# Proposal

## Why

El perfil móvil solo muestra nombre y correo, y el teléfono debe escribirse en cada reporte. La edición de datos, el cambio de contraseña y la restauración de sesión permitirán mantener la cuenta desde el móvil, con formularios más claros y espaciados.

## What Changes

- Ofrecer Mi perfil con accesos a Datos personales y Seguridad. Permitir editar nombre y teléfono opcional, mostrando el correo como dato de consulta.
- Guardar el teléfono en la cuenta y autocompletar el contacto de nuevos reportes, permitiendo modificarlo o borrarlo para cada envío.
- Cambiar contraseña mediante contraseña actual, nueva y confirmación. Invalidar todas las sesiones al completar el cambio y solicitar un nuevo ingreso.
- Restaurar la sesión en segundo plano al abrir la app, manteniendo el acceso inmediato a las vistas públicas y distinguiendo errores de red de credenciales inválidas.
- Reorganizar registro, ingreso y formularios de cuenta con márgenes, separación entre campos, ayudas, visibilidad de contraseña y mensajes de resultado.

## Capabilities

### New Capabilities

- `citizen-mobile` — Gestión del perfil ciudadano, contacto reutilizable en reportes, cambio autenticado de contraseña, continuidad de sesión y formularios móviles. La capacidad todavía carece de spec principal y aparece en los cambios activos `operational-mvp` y `citizen-mobile-identity-and-tracking`. Se conserva el mismo nombre y se añaden requisitos específicos para reconciliarlos al sincronizar.

### Modified Capabilities

## Impact

- Flutter en `screens/profile.dart`, `screens/report.dart`, `core/api.dart`, `main.dart` y navegación del shell. Pruebas de cliente, sesión, widgets y envío.
- API autenticada de perfil propio y contraseña en `src/auth`, migración aditiva de teléfono en `users`, contrato `packages/contracts/openapi.yaml` y pruebas API/MySQL.
- Reutilización de validación de teléfono de reportes, política de contraseña, `credential_version` y revocación de refresh tokens.
- Parte de la navegación entregada por `citizen-mobile-identity-and-tracking`. Ese cambio conserva su tarea pendiente de comprobación móvil/panel local. La entrega de este cambio también usará el entorno local acordado y migraciones separadas para bases de aplicación y test.
