## Qué cambia y por qué

<!-- Requisito SDD / change OpenSpec / tarea. -->

## Validación ejecutada

<!-- Comandos y resultados reales; indicar tests omitidos y su motivo. -->

- [ ] Revisé contrato, permisos y separación de datos por institución si aplica.
- [ ] Ejecuté las comprobaciones aplicables de CONTRIBUTING.md.
- [ ] Actualicé documentación y artifacts OpenSpec que corresponden.
- [ ] Revisé el diff: sin .env, secretos, certificados ni archivos locales.
- [ ] No ejecuté seeds, migraciones ni carga de prueba sobre producción.

## Impacto y publicación

<!-- Variables nuevas sin valores, migraciones, compatibilidad, reversión y riesgos. -->

Integrar en `main` puede activar el autodeploy de Render. Las migraciones nunca se ejecutan automáticamente al iniciar la API.
