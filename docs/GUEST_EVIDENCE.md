# Fotografías de invitado — 2026-10-09

## Requisito SDD

Implementa el flujo de reporte preliminar sin cuenta con foto opcional (RF-02 y RF-08), manteniendo lectura privada de evidencias (RF-42). No convierte el reporte en una denuncia formal ni elimina la verificación institucional.

## Comportamiento

- Invitado y ciudadano pueden abrir cámara o galería antes de enviar.
- Al confirmar un reporte de invitado, la API devuelve `guestEvidenceToken`, un JWT con audiencia y propósito exclusivos de subida, sujeto al ID del reporte y vencimiento fijo 24 horas después de su creación.
- Repetir una solicitud idempotente no extiende ese plazo. Un reporte antiguo no recibe permiso nuevo después de vencer.
- Flutter extrae el permiso del comprobante y lo guarda en FlutterSecureStorage, separado de SharedPreferences. Se envía exclusivamente mediante `X-Evidence-Token`, nunca en URL o logs.
- POST evidencia acepta el permiso de invitado o la autorización autenticada existente. El invitado solo puede subir a su reporte sin reportante registrado. GET evidencia sigue exigiendo autenticación y ámbito autorizado; las fotos son privadas en Cloudinary.
- Se conservan validación de contenido, limpieza de metadatos, JPEG/PNG/WebP, 5 MB por foto y máximo 3 por reporte. Invitados tienen además límite de 10 intentos de subida por ventana de 15 minutos.
- Si falla la foto, el reporte confirmado permanece y la app conserva el pendiente para reintentar. Si vence el permiso, se informa al usuario sin dar acceso general ni cambiar la contraseña.
- No hay migración: `evidence.uploader_user_id` ya admite NULL. No se modifican datos ni tablas de dominio.

## Publicación y aceptación

Publicar el backend antes de utilizar la nueva subida en producción. El APK 1.0.2+3 apunta a Render por HTTPS; un backend anterior no emite el permiso y la foto queda pendiente, sin perder el reporte.

Pruebas locales: backend 54 aprobadas, 0 fallidas, 22 integraciones MySQL omitidas. Flutter analyze sin incidencias; 10 pruebas aprobadas, prueba remota optativa omitida. La prueba HTTP con almacenamiento simulado valida subida sin cuenta, permiso ausente/falsificado, aislamiento entre reportes y rechazo de lectura. La suite Flutter valida que el servicio no exige sesión para enviar la foto. Registrar por separado el build, instalación y prueba remota; estos resultados no certifican aún una toma manual de cámara.
