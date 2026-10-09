# Flujo de emergencia ciudadano y acceso institucional

Decisión de producto autorizada el 2026-10-09. Versión Android 1.0.4+5.

## Requisitos y alcance

SDD RF-02 y RN-02: reporte preliminar sin cuenta/no verificado. RF-08: fotografía opcional. RF-42: lectura privada de evidencias. Se simplifica la app para este flujo: sin pantallas de login, registro, Perfil ni historial privado. RF-01/RF-03 y el historial autenticado permanecen implementados en la API y como capacidad previa, fuera de la navegación ciudadana actual. La autenticación institucional sigue obligatoria.

No se modifica SQL ni se elimina ninguna cuenta. No se convierte el reporte en una denuncia formal. No se promete despacho real en este piloto.

## Diseño

- Inicio ofrece reporte, mapa público agregado, contactos, alertas y presentación. La presentación no bloquea el reporte con una introducción obligatoria.
- La app no restaura sesiones. El envío de reporte fuerza `auth: false`, aunque exista un token antiguo en almacenamiento. Los permisos de foto son independientes y se conservan para pendientes.
- La API confirma antes de subir la foto. El permiso de invitado dura 24 horas desde la creación, no permite leer fotos y solo sirve para ese incidente. Se mantienen límites de tamaño, contenido, cantidad y frecuencia.
- La referencia identifica recepción, no permite consultar información privada. Conservarla manualmente; no se implementa historial local permanente en esta versión.
- Teléfonos oficiales en Android: 105 Policía, 116 Bomberos, 106 SAMU y 100 orientación ante violencia. Disponibles sin descarga remota; abrir marcador requiere acción del usuario. SAMU según cobertura y Serenazgo según municipio. Fuente: https://www.gob.pe/547-telefonos-de-emergencia (revisada 2026-10-09).
- Portada web enfocada en presentación y acceso institucional, sin tarjetas de llamada ciudadanas. El directorio administrativo sigue disponible para las entidades.

## Seguridad de cuentas

El panel conserva login, validación de cuenta activa, contraseña con hash, JWT, refresh y permisos de rol/institución/sede en la API. El menú no concede permisos. El login tiene límite de 5 intentos por ventana de 15 minutos por IP/correo; invitados también tienen límites. CORS acepta únicamente los orígenes configurados. No se muestran credenciales ni se desactiva TLS. No se afirma que estas medidas hagan imposible un ataque; la protección debe continuar revisándose.

## Criterios verificables

- Abrir Android y reportar/fotografiar sin autenticación; no hay login en navegación.
- Contactos oficiales visibles cuando falla la API y sin IDs técnicos en el buscador.
- Web pública sin enlaces tel y con acceso institucional; rutas privadas exigen sesión/rol.
- GET privado como invitado responde 401; el permiso de evidencia no permite lectura ni cruce de reportes.
- Flutter analyze/test, prueba remota invitado, backend test, React test/build y git diff --check. Registrar resultados reales al cerrar.

Guías vigentes: apps/mobile/README.md y docs/USER_GUIDE.md. Los registros de pruebas anteriores conservan su valor histórico y no describen necesariamente la interfaz actual.

## Validación ejecutada — 2026-10-09

- Backend: 54 aprobadas, 0 fallidas, 22 integraciones omitidas en la suite general.
- Autorización real en Aiven `incidencias_remote_test`: 1 aprobada; token ausente 401 y acceso cruzado por institución/incidente 403. Usa cuenta de aplicación y base aislada; no altera la base operativa.
- React: 15 aprobadas, 0 fallidas; incluye URL privada sin sesión y cuenta ciudadana sin acceso institucional. Build de producción satisfactorio.
- Flutter: 11 aprobadas, 0 fallidas, 1 remota omitida en suite general; análisis sin incidencias. La prueba remota se ejecutó por separado: 1 aprobada, creando reporte DEMO y foto real en Render sin login y comprobando GET privado 401. La prueba de sesión antigua verifica que POST reporte no envía Authorization y guarda el permiso fuera del comprobante.
- APK release 1.0.4+5 generado, firma verificada e instalado con reemplazo conservando datos en TECNO KJ6. La portada sin login se revisó visualmente. No se certifica una nueva captura manual de cámara/GPS; la foto de la prueba remota fue generada por la suite.
- La portada web se revisó en navegador local. Los cambios de presentación requieren publicación posterior para verse en el dominio.
