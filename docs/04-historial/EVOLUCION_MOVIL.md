# Evolución del flujo ciudadano y evidencias

Registro histórico consolidado el 2026-10-20. Conserva decisiones y resultados de versiones anteriores; sus notas de publicación y pendientes describen la fecha original. El comportamiento vigente se define en el [SRS](../01-entrega/SRS.md) y el [SDD](../01-entrega/SDD.md). No ejecutar instrucciones antiguas como procedimiento actual.

---

<!-- Fuente consolidada: docs/CITIZEN_EMERGENCY_FLOW.md -->

## Flujo de emergencia ciudadano y acceso institucional

Decisión de producto autorizada el 2026-10-09. Versión Android 1.0.4+5.

### Requisitos y alcance

SDD RF-02 y RN-02: reporte preliminar sin cuenta/no verificado. RF-08: fotografía opcional. RF-42: lectura privada de evidencias. Se simplifica la app para este flujo: sin pantallas de login, registro, Perfil ni historial privado. RF-01/RF-03 y el historial autenticado permanecen implementados en la API y como capacidad previa, fuera de la navegación ciudadana actual. La autenticación institucional sigue obligatoria.

No se modifica SQL ni se elimina ninguna cuenta. No se convierte el reporte en una denuncia formal. No se promete despacho real en este piloto.

### Diseño

- Inicio ofrece reporte, mapa público agregado, contactos, alertas y presentación. La presentación no bloquea el reporte con una introducción obligatoria.
- La app no restaura sesiones. El envío de reporte fuerza `auth: false`, aunque exista un token antiguo en almacenamiento. Los permisos de foto son independientes y se conservan para pendientes.
- La API confirma antes de subir la foto. El permiso de invitado dura 24 horas desde la creación, no permite leer fotos y solo sirve para ese incidente. Se mantienen límites de tamaño, contenido, cantidad y frecuencia.
- La referencia identifica recepción, no permite consultar información privada. Conservarla manualmente; no se implementa historial local permanente en esta versión.
- Teléfonos oficiales en Android: 105 Policía, 116 Bomberos, 106 SAMU y 100 orientación ante violencia. Disponibles sin descarga remota; abrir marcador requiere acción del usuario. SAMU según cobertura y Serenazgo según municipio. Fuente: https://www.gob.pe/547-telefonos-de-emergencia (revisada 2026-10-09).
- Portada web enfocada en presentación y acceso institucional, sin tarjetas de llamada ciudadanas. El directorio administrativo sigue disponible para las entidades.

### Seguridad de cuentas

El panel conserva login, validación de cuenta activa, contraseña con hash, JWT, refresh y permisos de rol/institución/sede en la API. El menú no concede permisos. El login tiene límite de 5 intentos por ventana de 15 minutos por IP/correo; invitados también tienen límites. CORS acepta únicamente los orígenes configurados. No se muestran credenciales ni se desactiva TLS. No se afirma que estas medidas hagan imposible un ataque; la protección debe continuar revisándose.

### Criterios verificables

- Abrir Android y reportar/fotografiar sin autenticación; no hay login en navegación.
- Contactos oficiales visibles cuando falla la API y sin IDs técnicos en el buscador.
- Web pública sin enlaces tel y con acceso institucional; rutas privadas exigen sesión/rol.
- GET privado como invitado responde 401; el permiso de evidencia no permite lectura ni cruce de reportes.
- Flutter analyze/test, prueba remota invitado, backend test, React test/build y git diff --check. Registrar resultados reales al cerrar.

Guías vigentes: apps/mobile/README.md y docs/USER_GUIDE.md. Los registros de pruebas anteriores conservan su valor histórico y no describen necesariamente la interfaz actual.

### Validación ejecutada — 2026-10-09

- Backend: 54 aprobadas, 0 fallidas, 22 integraciones omitidas en la suite general.
- Autorización real en Aiven `incidencias_remote_test`: 1 aprobada; token ausente 401 y acceso cruzado por institución/incidente 403. Usa cuenta de aplicación y base aislada; no altera la base operativa.
- React: 15 aprobadas, 0 fallidas; incluye URL privada sin sesión y cuenta ciudadana sin acceso institucional. Build de producción satisfactorio.
- Flutter: 11 aprobadas, 0 fallidas, 1 remota omitida en suite general; análisis sin incidencias. La prueba remota se ejecutó por separado: 1 aprobada, creando reporte DEMO y foto real en Render sin login y comprobando GET privado 401. La prueba de sesión antigua verifica que POST reporte no envía Authorization y guarda el permiso fuera del comprobante.
- APK release 1.0.4+5 generado, firma verificada e instalado con reemplazo conservando datos en TECNO KJ6. La portada sin login se revisó visualmente. No se certifica una nueva captura manual de cámara/GPS; la foto de la prueba remota fue generada por la suite.
- La portada web se revisó en navegador local. Los cambios de presentación requieren publicación posterior para verse en el dominio.


---

<!-- Fuente consolidada: docs/GUEST_EVIDENCE.md -->

## Fotografías de invitado — 2026-10-09

### Requisito SDD

Implementa el flujo de reporte preliminar sin cuenta con foto opcional (RF-02 y RF-08), manteniendo lectura privada de evidencias (RF-42). No convierte el reporte en una denuncia formal ni elimina la verificación institucional.

### Comportamiento

- Invitado y ciudadano pueden abrir cámara o galería antes de enviar.
- Al confirmar un reporte de invitado, la API devuelve `guestEvidenceToken`, un JWT con audiencia y propósito exclusivos de subida, sujeto al ID del reporte y vencimiento fijo 24 horas después de su creación.
- Repetir una solicitud idempotente no extiende ese plazo. Un reporte antiguo no recibe permiso nuevo después de vencer.
- Flutter extrae el permiso del comprobante y lo guarda en FlutterSecureStorage, separado de SharedPreferences. Se envía exclusivamente mediante `X-Evidence-Token`, nunca en URL o logs.
- POST evidencia acepta el permiso de invitado o la autorización autenticada existente. El invitado solo puede subir a su reporte sin reportante registrado. GET evidencia sigue exigiendo autenticación y ámbito autorizado; las fotos son privadas en Cloudinary.
- Se conservan validación de contenido, limpieza de metadatos, JPEG/PNG/WebP, 5 MB por foto y máximo 3 por reporte. Invitados tienen además límite de 10 intentos de subida por ventana de 15 minutos.
- Si falla la foto, el reporte confirmado permanece y la app conserva el pendiente para reintentar. Si vence el permiso, se informa al usuario sin dar acceso general ni cambiar la contraseña.
- No hay migración: `evidence.uploader_user_id` ya admite NULL. No se modifican datos ni tablas de dominio.

### Publicación y aceptación

Publicar el backend antes de utilizar la nueva subida en producción. El APK 1.0.2+3 apunta a Render por HTTPS; un backend anterior no emite el permiso y la foto queda pendiente, sin perder el reporte.

Pruebas locales: backend 54 aprobadas, 0 fallidas, 22 integraciones MySQL omitidas. Flutter analyze sin incidencias; 10 pruebas aprobadas, prueba remota optativa omitida. La prueba HTTP con almacenamiento simulado valida subida sin cuenta, permiso ausente/falsificado, aislamiento entre reportes y rechazo de lectura. La suite Flutter valida que el servicio no exige sesión para enviar la foto. Registrar por separado el build, instalación y prueba remota; estos resultados no certifican aún una toma manual de cámara.

#### APK instalado

Build release completado; firma APK verificada. Instalación mediante `adb install -r` en TECNO KJ6 completada sin desinstalar: versionName 1.0.2, versionCode 3. La actividad inicia y el proceso permanece activo. No se certifica una captura manual de cámara.

Backend publicado en main: `ab3f903`. La primera comprobación remota posterior al push todavía devuelve `UNAUTHORIZED` para el permiso de invitado inválido, comportamiento de la versión anterior; la validación de subida real queda pendiente de que Render termine el despliegue automático.

### Interfaz vigente 1.0.4+5

La app ciudadana actual no ofrece login; usa el flujo de invitado para todas las nuevas solicitudes, incluso si una versión anterior había guardado una sesión. Las capacidades autenticadas de la API permanecen protegidas para compatibilidad y operación institucional. La prueba remota actual verifica creación y foto como invitado, sin contraseña.


---

<!-- Fuente consolidada: docs/MOBILE_INTERFACE.md -->

## Interfaz móvil: navegación y claridad

Actualización 1.0.3+4. Requisito: facilitar el acceso ciudadano a reportes, mapa, alertas y directorio, preservando el flujo invitado y las restricciones de acceso existentes.

- Tema Material 3 compartido: verde petróleo, fondos suaves, tarjetas blancas redondeadas y campos con borde de foco destacado.
- Portada con degradado, acción principal de reporte y cuatro accesos con icono, título y explicación. Colores acompañados de texto para no depender exclusivamente del color.
- Accesos a mapa, directorio, alertas y seguimiento conectados a las pantallas existentes; no representan nuevas integraciones.
- Menú lateral con cabecera identificable. En pantallas secundarias se evita marcar Inicio como seleccionado incorrectamente.
- Texto del perfil actualizado para explicar que las fotos pueden enviarse sin cuenta.

Verificación: flutter analyze, flutter test, build release y comprobación visual en Android. La prueba remota optativa no forma parte de la validación visual. No se modifican contratos, base de datos ni permisos de cámara.

Resultado ejecutado: flutter analyze sin incidencias; flutter test 10 aprobadas, 0 fallidas, 1 remota optativa omitida; build release satisfactorio, firma APK verificada. Instalación con adb install -r en TECNO KJ6 satisfactoria, versión 1.0.3 (4), conservando datos. Capturas de portada y accesos revisadas visualmente en el dispositivo: sin desbordamientos visibles. git diff --check sin errores. Cambios pendientes de commit.

### Actualización 1.0.4+5

La navegación actual reemplaza Mis reportes por Contactos y añade Conoce la app. No hay Perfil ni login en la navegación; la guía de emergencia está siempre accesible sin introducción obligatoria. La documentación vigente del flujo está en CITIZEN_EMERGENCY_FLOW.md. Los resultados 1.0.3 anteriores se conservan como históricos.
