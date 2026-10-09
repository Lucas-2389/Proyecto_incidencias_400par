# Interfaz móvil: navegación y claridad

Actualización 1.0.3+4. Requisito: facilitar el acceso ciudadano a reportes, mapa, alertas y directorio, preservando el flujo invitado y las restricciones de acceso existentes.

- Tema Material 3 compartido: verde petróleo, fondos suaves, tarjetas blancas redondeadas y campos con borde de foco destacado.
- Portada con degradado, acción principal de reporte y cuatro accesos con icono, título y explicación. Colores acompañados de texto para no depender exclusivamente del color.
- Accesos a mapa, directorio, alertas y seguimiento conectados a las pantallas existentes; no representan nuevas integraciones.
- Menú lateral con cabecera identificable. En pantallas secundarias se evita marcar Inicio como seleccionado incorrectamente.
- Texto del perfil actualizado para explicar que las fotos pueden enviarse sin cuenta.

Verificación: flutter analyze, flutter test, build release y comprobación visual en Android. La prueba remota optativa no forma parte de la validación visual. No se modifican contratos, base de datos ni permisos de cámara.

Resultado ejecutado: flutter analyze sin incidencias; flutter test 10 aprobadas, 0 fallidas, 1 remota optativa omitida; build release satisfactorio, firma APK verificada. Instalación con adb install -r en TECNO KJ6 satisfactoria, versión 1.0.3 (4), conservando datos. Capturas de portada y accesos revisadas visualmente en el dispositivo: sin desbordamientos visibles. git diff --check sin errores. Cambios pendientes de commit.

## Actualización 1.0.4+5

La navegación actual reemplaza Mis reportes por Contactos y añade Conoce la app. No hay Perfil ni login en la navegación; la guía de emergencia está siempre accesible sin introducción obligatoria. La documentación vigente del flujo está en CITIZEN_EMERGENCY_FLOW.md. Los resultados 1.0.3 anteriores se conservan como históricos.
