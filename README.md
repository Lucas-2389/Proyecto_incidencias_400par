# Plataforma de gestión de incidencias

Piloto académico de Ayacucho: app ciudadana Android con Flutter, panel institucional React y API Node.js/Express. La API usa MySQL; el perfil publicado utiliza Render, Aiven con TLS y Cloudinary. El reporte ciudadano no requiere login; el acceso institucional sí.

> No sustituye servicios oficiales de emergencia ni constituye una denuncia formal. Las coberturas y cuentas DEMO no habilitan despacho real.

## Documentación para el docente

1. [SRS — Requisitos del sistema](docs/01-entrega/SRS.md).
2. [SDD — Arquitectura y diseño técnico](docs/01-entrega/SDD.md).
3. [Plan de trabajo, trazabilidad y verificación](docs/01-entrega/PLAN_Y_VERIFICACION.md).

El [índice documental](docs/README.md) separa entrega, guías, validación e historial. Los requisitos están en el SRS; el SDD explica el diseño; las tareas detalladas se conservan en OpenSpec.

## Ejecutar y colaborar

- [Instalar desde cero y trabajar con un compañero](docs/02-guias/COLABORACION.md).
- [Usuarios y módulos](docs/02-guias/USUARIOS.md).
- [Contribuir mediante ramas y pull requests](CONTRIBUTING.md).
- [API](apps/api/README.md), [React](apps/admin/README.md) y [Android](apps/mobile/README.md).
- [Operación Render](docs/02-guias/OPERACION_RENDER.md).

Cada desarrollador mantiene su configuración privada; no necesita credenciales productivas para comenzar. No versionar secretos, certificados ni archivos `.env`. El escalamiento horizontal se abordará en un cambio posterior autorizado.

## Estructura del repositorio

| Ruta | Contenido |
| --- | --- |
| `apps/api` | Backend modular, pruebas y migraciones. |
| `apps/admin` | Panel React institucional y presentación pública. |
| `apps/mobile` | App Flutter ciudadana Android. |
| `packages/contracts/openapi.yaml` | Contrato HTTP compartido. |
| `docs` | Documentación ordenada por propósito. |
| `openspec` | Especificaciones, diseños de cambios, tareas e historial. |

React consume la API; únicamente el backend se conecta a MySQL con la cuenta de aplicación. Las fotografías productivas se almacenan fuera del disco del servidor y de MySQL. Las rutas funcionales usan `/api/v1`; los health checks están en `/api/health` y `/api/health/database`.

La versión original del SDD se conserva en el [historial](docs/04-historial/README.md), fuera de la ruta principal de entrega. Las comprobaciones antiguas conservan su fecha y no equivalen a una nueva validación del servicio publicado.
