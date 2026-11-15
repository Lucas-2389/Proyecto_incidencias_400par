# Documentación del proyecto

## Entrega académica — leer en este orden

| Orden | Documento | Pregunta que responde |
| --- | --- | --- |
| 1 | [SRS — Requisitos](01-entrega/SRS.md) | ¿Qué debe resolver el sistema? |
| 2 | [SDD — Diseño de software](01-entrega/SDD.md) | ¿Cómo está diseñada la solución? |
| 3 | [Plan y verificación](01-entrega/PLAN_Y_VERIFICACION.md) | ¿Cómo se organiza y comprueba el trabajo? |

Esta es la ruta principal para el docente. El SDD contiene arquitectura, datos, componentes e interfaz; las tablas de requisitos y el trabajo pendiente se consultan por separado. Los documentos están preparados para revisión, sin afirmar aprobación académica.

## Organización

```text
docs/
  01-entrega/       SRS, SDD y plan/verificación
  02-guias/         Instalación, usuarios, convenciones y operación
  03-validacion/    Evidencias fechadas e informe de esta revisión
  04-historial/     Antecedentes que no describen necesariamente la versión actual
```

## Guías de uso y desarrollo

- [Clonar y trabajar con un compañero](02-guias/COLABORACION.md).
- [Usuarios, acceso y módulos](02-guias/USUARIOS.md).
- [Convenciones de implementación](02-guias/CONVENCIONES.md).
- [Operación y preparación de Render](02-guias/OPERACION_RENDER.md): revisar las fechas de sus comprobaciones.
- Guías específicas: [API](../apps/api/README.md), [React](../apps/admin/README.md), [Android](../apps/mobile/README.md) y [migraciones](../apps/api/migrations/README.md).
- [Contribuir](../CONTRIBUTING.md) y [contrato HTTP](../packages/contracts/openapi.yaml).

## Validación y antecedentes

- [Validación del piloto](03-validacion/PILOTO.md).
- [Informe del esquema Aiven](03-validacion/MIGRACIONES_AIVEN.md).
- [Revisión documental de esta entrega](03-validacion/REVISION_DOCUMENTAL.md).
- [Índice histórico](04-historial/README.md).

Los changes y sus tareas se mantienen en [OpenSpec](../openspec/), en su estructura original para conservar la trazabilidad y compatibilidad con la herramienta. No son documentos adicionales que el docente necesite leer para comprender el SDD.

El sistema es un piloto académico; no sustituye los canales oficiales de emergencia. No incluir `.env`, certificados, credenciales, APK ni dependencias en el paquete documental.
