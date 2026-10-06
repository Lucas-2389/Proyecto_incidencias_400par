# Migraciones

Archivos `NNN_nombre.sql` en orden ascendente. Separar cada sentencia completa con una línea `-- statement`. No modificar un archivo aplicado: el ejecutor detecta diferencias mediante SHA-256. Las migraciones se invocan explícitamente con `node scripts/migrate.js --target=test` o `--target=app`; no forman parte del arranque de la API.
