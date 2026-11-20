# Evaluación local del mapa y referencias

## Preparación reproducible

Con MySQL local disponible y `apps/api/.env` configurado para desarrollo, usuario `incidencias_app` y base `incidencias`:

```powershell
npm.cmd run db:migrate:app --prefix apps/api
node apps/api/scripts/prepare-local-evaluation.js --apply-local
npm.cmd start --prefix apps/api
# En otra terminal:
npm.cmd run dev --prefix apps/admin
```

El preparador rechaza hosts remotos y producción. Es idempotente: no sobrescribe registros existentes. No genera notificaciones ni asignaciones. No utilizarlo para producción.

## Ocho casos ficticios

Todos llevan `is_demo=true`, referencia EVAL y descripción SIMULACIÓN DE EVALUACIÓN. No representan emergencias reales. Comparten un punto aproximado deliberado para probar agrupación; no acredita la ubicación de ningún suceso.

| Referencia | Caso | Evaluación manual sugerida |
|---|---|---|
| EVAL-AY-001 | Agua acumulada, prioridad alta | Verificar, priorizar y ensayar coordinación municipal. |
| EVAL-AY-002 | Tierra y piedras en vía, alta | Comprobar acceso y registrar el motivo de la verificación. |
| EVAL-AY-003 | Humo en comercio, crítica | Revisar derivación a Bomberos, sin despacho real. |
| EVAL-AY-004 | Posible dificultad respiratoria, crítica | Practicar coordinación SAMU sin paciente ni llamada real. |
| EVAL-AY-005 | Colisión, alta | Revisar coordinación interinstitucional y disponibilidad de recursos. |
| EVAL-AY-006 | Sustracción ficticia, normal | Revisar competencia PNP y permisos de acceso. |
| EVAL-AY-007 | Aviso incompleto de humo, normal | Practicar conclusión no verificable con motivo explícito. |
| EVAL-AY-008 | Segundo aviso de agua, normal | Contrastar con 001 antes de marcar duplicado. |

En Mapa, escoger un periodo que incluya la preparación y activar Reportes. Comprobar número del grupo, símbolos de categorías, alerta de prioridad alta/crítica y etiqueta de simulación en el popup. Cambiar categorías sin perder zoom ni desplazamiento. La visibilidad sigue los permisos del perfil; no se amplía para la evaluación.

## Referencias institucionales

Se incorporan siete candidatos documentales, separados de las sedes operativas. Sus direcciones y fuentes necesitan revisión; ninguna coordenada se inventa. No se incluye una base SAMU sin evidencia ni se convierte DIRESA en SAMU. La información de Bomberos histórica no demuestra vigencia actual.

En Instituciones o Directorio se consultan fuentes y pendientes. Solo el superadministrador registra una ubicación con coordenadas, método, URL de evidencia y notas. La API exige coincidencia inequívoca con el distrito de la cartografía operativa cargada; los límites regionales de consulta no habilitan por sí solos nuevos distritos operativos. Una revisión se audita y puede retirarse sin borrar la referencia. No guardar coordenadas ficticias para hacer aparecer sedes.

Una ubicación revisada aparece al actualizar el mapa y activar su entidad; continúa siendo referencia documental y no permite despachar recursos. No equivale a certificación legal ni confirma disponibilidad institucional.

## Verificación ejecutada — 19 de noviembre de 2026

- Backend: 94 pruebas, 64 aprobadas, 30 omitidas por configuración de integración y 0 fallidas. Las omitidas no se consideran aprobadas.
- Panel: 68 pruebas aprobadas; compilación de producción correcta.
- Contrato OpenAPI: 68 rutas válidas. `git diff --check` sin errores.
- MySQL local: migración 015 aplicada; segunda ejecución del preparador agrega 0 referencias y 0 incidentes, sin notificaciones.
- HTTP local: ambos health checks 200; referencias sin sesión 401; consulta municipal 200 con siete pendientes; intento de revisión municipal 403; coordenadas inválidas del superadministrador 422.
- Edge mediante Playwright (plugin Browser no disponible): consulta de siete fichas pendientes y activación de Reportes con marcador agrupado y alerta de prioridad. Sin errores JavaScript; ancho móvil de 390 px sin desbordamiento horizontal. La cuenta municipal vio tres reportes autorizados; no se amplió su acceso para mostrar los ocho escenarios.
- No se ejecutó despliegue, commit ni push, ni se verificaron coordenadas reales mediante esta prueba.

## Ampliación municipal regional — 19 de noviembre de 2026

Se incorporó el inventario de 124 municipalidades del directorio INEI 2026, con direcciones e identificación distrital. La fuente informa vigencia de datos al 13/03/2026; las páginas de sedes se consultaron el 19/11/2026. Las coordenadas de capitales del Excel no se utilizaron para ubicar sedes.

- Vista previa contra MySQL local: 33 puntos publicados dentro del distrito, dos en conflicto y 89 sin coordenadas extraíbles. Los 91 pendientes del inventario permanecen sin marcador.
- Primera carga: 120 fichas creadas, tres actualizadas y una revisión previa conservada, con 123 eventos de auditoría. Segunda carga: cero altas y cero actualizaciones; 33 revisiones conservadas. Cero notificaciones.
- Consulta SQL posterior: 126 fichas municipales en 124 distritos (incluye dos sedes secundarias de Carmen Alto previas), 33 con ubicación. No se reemplazaron las sedes operativas ni los ejemplos.
- Backend: 98 pruebas, 68 aprobadas, 30 omitidas por configuración de integración y cero fallidas. Panel: 68 aprobadas. Build de React y contrato de 68 rutas correctos. Health y database health locales: 200. `git diff --check` sin errores.
- Edge/Playwright: 33 marcadores municipales con simulación desactivada, cuatro al seleccionar Huanta; búsqueda «Andres Avelino» encuentra una ficha revisada, filtros de revisión y lotes de 12 fichas operativos. Escritorio y móvil 390 px, sin desbordamiento, errores JavaScript, errores de consola ni overlay de Vite. Se esperó la carga de teselas antes de capturar el mapa.
- La validación de referencias usa el interior del polígono regional con `ST_Contains`; la cobertura de atención y asignaciones conserva su lógica operativa independiente. La revisión documental no es certificación legal ni confirmación de disponibilidad.
- Todo se ejecutó en desarrollo local con `incidencias_app`. No hubo importación en Aiven, despliegue, commit ni push.
