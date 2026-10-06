# Spec Delta

## Purpose

Controlar la verificación, prioridad, progreso y cierre de cada incidente, conservando una línea de tiempo consultable.

## ADDED Requirements

### Requirement: Verificación y prioridad
Los usuarios autorizados SHALL poder marcar un reporte como verificado, no verificable, falso o duplicado, y ajustar su prioridad con motivo.

#### Scenario: Reporte invitado verificado
- **WHEN** un Operador verifica un reporte preliminar y registra motivo
- **THEN** la verificación y el actor quedan en su historial

#### Scenario: Ciudadano intenta descartar
- **WHEN** un Ciudadano intenta marcar un reporte como falso, duplicado o cerrado
- **THEN** la API rechaza la acción

### Requirement: Transiciones de atención
La plataforma SHALL admitir Reportado, En verificación, Asignado, Unidad en camino, En atención, Resuelto y Cerrado, y SHALL impedir transiciones inválidas.

#### Scenario: Avance válido
- **WHEN** un Operador autorizado pasa de Asignado a Unidad en camino
- **THEN** se actualiza el estado y se registra fecha, actor y nota

#### Scenario: Salto inválido
- **WHEN** se intenta cerrar directamente un incidente Reportado sin la justificación y permisos previstos
- **THEN** la API rechaza la transición y conserva el estado anterior

### Requirement: Historial y vínculo de duplicados
Cada cambio operativo SHALL conservarse en la línea de tiempo; los reportes del mismo evento SHALL poder vincularse sin perder su referencia original.

#### Scenario: Duplicado vinculado
- **WHEN** un Operador marca un reporte como duplicado de otro incidente autorizado
- **THEN** ambos identificadores permanecen consultables y el vínculo queda en el historial

#### Scenario: Cierre
- **WHEN** se cierra una incidencia resuelta
- **THEN** sus asignaciones, hitos e historial permanecen disponibles para usuarios autorizados

### Requirement: Consulta de estado propio
El ciudadano autenticado SHALL poder consultar el estado de sus reportes sin recibir datos internos de personal o de otros reportantes.

#### Scenario: Mis reportes
- **WHEN** el ciudadano consulta su bandeja
- **THEN** ve referencias y estados propios, pero ningún incidente ajeno
