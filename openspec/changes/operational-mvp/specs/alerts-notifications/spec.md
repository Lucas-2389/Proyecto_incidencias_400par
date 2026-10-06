# Spec Delta

## Purpose

Comunicar alertas públicas y novedades de atención a destinatarios pertinentes dentro de la plataforma durante el piloto.

## ADDED Requirements

### Requirement: Alertas públicas vigentes
Un usuario institucional autorizado SHALL poder publicar alertas con autor, zona, tipo y vigencia; la consulta pública SHALL mostrar solo alertas vigentes aplicables.

#### Scenario: Alerta activa
- **WHEN** se consulta una zona cubierta durante la vigencia de una alerta publicada
- **THEN** la alerta aparece con su título y mensaje

#### Scenario: Alerta vencida
- **WHEN** ha terminado la vigencia
- **THEN** la alerta deja de aparecer en la lista pública

### Requirement: Notificaciones internas
El sistema SHALL crear notificaciones internas para cambios de estado relevantes y nuevas asignaciones, con destinatario y estado de lectura.

#### Scenario: Estado actualizado
- **WHEN** cambia el estado de un reporte ciudadano
- **THEN** su reportante registrado recibe una notificación consultable dentro de la app

#### Scenario: Asignación operativa
- **WHEN** se asigna una atención a un Operador
- **THEN** el Operador recibe una notificación interna sin exponer el incidente a usuarios ajenos

### Requirement: Entrega externa opcional
Si hay un canal push configurado, el sistema SHALL poder enviar las notificaciones pertinentes sin hacer depender de ese canal la persistencia de la operación principal.

#### Scenario: Canal no configurado
- **WHEN** no hay credenciales push en el entorno
- **THEN** la notificación interna sigue disponible y el incidente se guarda normalmente
