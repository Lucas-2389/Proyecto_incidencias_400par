# Design

## Context

Véase `proposal.md`. El piloto usa Express 5, MySQL por pool, React/Vite y Flutter con URL API configurable. `compose.yaml` solo publica MySQL en loopback y los secretos locales ya se excluyen de Git. La API tenía encabezados `no-store`, pero no una lista CORS ni una validación diferenciada de producción.

## Goals / Non-Goals

**Goals:** preparar una API que pueda servir al panel en un origen HTTPS distinto, documentar una instalación V1 reproducible y comprobar que la limpieza no elimina activos del proyecto.

**Non-Goals:** publicar dominio o infraestructura real, cambiar el esquema MySQL, distribuir por Google Play, añadir correo de producción, montar varias réplicas o prometer operación con datos reales.

## Decisions

1. **Configuración explícita.** `APP_ENV` distingue desarrollo y producción. `PUBLIC_API_URL`, `CORS_ORIGINS`, `JWT_SECRET` y `EVIDENCE_DIR` se validan al arrancar en producción; `UPLOAD_CONFIGURATION=local` refleja el único adaptador implementado. Se evita detectar el ambiente por hostname o imponer valores locales al servidor cloud.
2. **CORS en Express.** Un middleware anterior a health y `/api/v1` resuelve preflight y devuelve cabeceras solo para orígenes autorizados. Los clientes Flutter sin `Origin` continúan usando la API. Se evita `*` porque el panel tratará información institucional.
3. **Encabezados mínimos en la API y TLS en el proxy.** La API agrega `nosniff`, bloqueo de marcos, política de referencia y permisos; elimina `X-Powered-By`. El proxy inverso y Cloudflare terminan HTTPS, y el firewall cierra el puerto Node. `Cache-Control: no-store` continúa en health y rutas funcionales. Se evita acoplar la API a un proveedor cloud concreto.
4. **Topología V1 de una VM.** MySQL 9 en Compose permanece en loopback; Node corre como proceso supervisado en la misma VM; un volumen persistente guarda fotos; Pages sirve los estáticos React. Se elige esta variante para no introducir todavía TLS del cliente MySQL hacia un servicio administrado remoto. Una futura base remota requiere diseño y prueba explícitos de TLS.
5. **Conservación documental.** El SDD original queda en su ruta porque es fuente de verdad y está enlazado por el repositorio. Los README por paquete conservan comandos concretos y la evidencia del piloto conserva resultados; la guía breve de acceso se integra al README raíz. Los artefactos OpenSpec se conservan íntegros.

## Risks / Trade-offs

- [Una VM es punto único de fallo] → respaldo consistente de MySQL y fotos, prueba de restauración y procedimiento de rollback.
- [Directorio local de fotos se perdería en disco efímero] → exigir ruta absoluta y montaje persistente en producción.
- [WAF/Bot Fight Mode puede desafiar Flutter] → validar clientes reales antes de activar reglas de bots.
- [La recuperación usa un buzón local de desarrollo] → dejarla indisponible en producción hasta incorporar transporte de correo.
- [El seed DEMO es el bootstrap institucional actual] → usarlo solo en demostración aislada; diseñar bootstrap real antes de datos personales.

## Migration Plan

Mantener `.env` locales ignorados. Desplegar primero MySQL y migraciones revisadas con respaldo, después API con nuevas variables, verificar health y CORS, y finalmente compilar Pages y APK con la URL pública. Para volver atrás, restaurar el binario anterior solo si conserva compatibilidad de esquema; si no, restaurar conjuntamente base y fotos desde un respaldo consistente. La publicación real queda sujeta a dominio, VM y cierre del recorrido físico pendiente.
