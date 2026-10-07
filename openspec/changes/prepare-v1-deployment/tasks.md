# Tasks

## 1. Auditoría y documentación

- [x] 1.1 Inventariar archivos versionados, ignorados, Markdown y el estado Git; verificar ausencia de `.env`, APK, `build`, `dist` y secretos reales versionados.
- [x] 1.2 Clasificar archivos para eliminar, revisar o conservar antes de borrar; verificar que migraciones, pruebas, SDD y OpenSpec permanecen intactos.
- [x] 1.3 Ampliar `.gitignore` para cachés Android, APK/AAB y temporales; verificar con `git check-ignore` que los artefactos se ignoran y las plantillas `.env.production.example` sí se pueden versionar.
- [x] 1.4 Corregir el README raíz y los README por paquete, integrar la guía breve de acceso y conservar documentación no redundante; verificar enlaces y rutas de arranque.

## 2. API preparada para producción

- [x] 2.1 Añadir `APP_ENV`, `CORS_ORIGINS`, `PUBLIC_API_URL` y `UPLOAD_CONFIGURATION` a la configuración central; verificar pruebas de configuración válida e inválida.
- [x] 2.2 Exigir en producción HTTPS, secreto JWT, orígenes CORS y ruta absoluta de fotos; verificar que configuraciones inseguras impiden el arranque sin revelar secretos.
- [x] 2.3 Implementar preflight y denegación de orígenes web no autorizados, más encabezados HTTP básicos; verificar prueba HTTP para 204, 403, `no-store` y ausencia de `X-Powered-By`.
- [x] 2.4 Añadir plantillas de entorno de producción para API y panel sin credenciales reales; verificar rutas, variables y exclusiones de Git.

## 3. Procedimiento V1

- [x] 3.1 Documentar topología de una VM, Pages, DNS, TLS, CDN, caché, WAF, bots, APK, respaldos y rollback en `docs/DEPLOYMENT_V1.md`; verificar que no declara URLs ni servicios desplegados.
- [x] 3.2 Registrar dependencias pendientes para una publicación real: dominio, VM, bootstrap institucional no DEMO, correo y recorrido móvil completo; verificar coherencia con SDD y `operational-mvp`.

## 4. Integración final

- [x] 4.1 Instalar dependencias y ejecutar API/MySQL, React, Flutter, APK, OpenAPI y health checks reales; registrar los resultados observados sin atribuir éxitos a pasos no ejecutados.
- [x] 4.2 Ejecutar build React con URL pública de ejemplo, validar todos los cambios OpenSpec en strict, comprobar `git diff --check` y `git status`, y resumir riesgos restantes.
