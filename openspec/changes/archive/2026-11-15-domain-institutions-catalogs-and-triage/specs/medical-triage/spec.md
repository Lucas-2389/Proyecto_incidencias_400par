# Spec Delta

## Purpose

Registrar observaciones clínicas iniciales útiles para SAMU y conservar su significado al recibir, consultar y reenviar reportes de incidentes.

## ADDED Requirements

### Requirement: Observaciones clínicas opcionales
La API SHALL aceptar `isConscious`, `isBreathing` y `hasBleeding` como booleanos opcionales y anulables en las altas móviles, invitadas y telefónicas. El valor desconocido SHALL representarse como `null`.

#### Scenario: Observaciones conocidas
- **WHEN** se crea un reporte válido con conciencia falsa, respiración verdadera y sangrado verdadero
- **THEN** el detalle autorizado conserva exactamente `false`, `true` y `true`

#### Scenario: Observaciones desconocidas
- **WHEN** el cliente omite alguno de los campos o lo envía como `null`
- **THEN** ese campo queda desconocido y los demás conservan sus valores

#### Scenario: Tipo inválido
- **WHEN** un campo clínico contiene una cadena, un número, un arreglo o un objeto
- **THEN** la API responde 422 y conserva la consistencia del reporte

### Requirement: Observaciones de la persona principal
Las tres observaciones clínicas SHALL describir a la persona principal indicada en la descripción del reporte. `affectedPeople` SHALL representar la cantidad total de personas afectadas.

#### Scenario: Varias personas afectadas
- **WHEN** se registra un reporte con `affectedPeople=3`, cuya descripción identifica a una persona principal con conciencia falsa, respiración verdadera y sangrado verdadero
- **THEN** el detalle conserva el total de tres personas, la descripción que identifica a la persona principal y las observaciones `false`, `true` y `true` asociadas a esa persona

### Requirement: Compatibilidad de datos clínicos
El sistema MUST conservar los reportes anteriores y sus referencias. SHALL reutilizar `affectedPeople` y `subcategoryId` para la cantidad de afectados y el subtipo, y SHALL mantener los campos clínicos desconocidos en reportes anteriores.

#### Scenario: Reporte anterior a la ampliación
- **WHEN** se consulta un reporte creado antes de la migración clínica
- **THEN** su cantidad de afectados y subtipo conservan sus valores y las tres observaciones clínicas son `null`

#### Scenario: Datos compartidos
- **WHEN** se registra un reporte con cantidad de afectados, subtipo y observaciones clínicas
- **THEN** el detalle devuelve una única cantidad de afectados y un único subtipo junto a las observaciones

### Requirement: Reintentos de reportes clínicos
La API MUST incluir las observaciones clínicas conocidas en la comparación idempotente y conservar la validez de reintentos de solicitudes anteriores que carecen de estos campos.

#### Scenario: Reenvío con el mismo contenido clínico
- **WHEN** se repite una solicitud válida con igual clave y contenido clínico
- **THEN** se devuelve la referencia original sin duplicar el incidente

#### Scenario: Cambio de una observación
- **WHEN** una clave existente se reutiliza con un booleano clínico diferente
- **THEN** la API responde 409 y conserva el registro original

#### Scenario: Reenvío de un cliente anterior
- **WHEN** se reenvía una solicitud previa a la ampliación usando la misma clave y sin observaciones clínicas conocidas
- **THEN** el servidor reconoce la solicitud original y devuelve su referencia

### Requirement: Consulta clínica dentro del ámbito
Las observaciones clínicas SHALL devolverse en el detalle de incidente a quienes ya tengan acceso autorizado a ese reporte. Su inclusión MUST respetar los controles existentes de identidad y ámbito.

#### Scenario: Consulta autorizada
- **WHEN** el reportante o un usuario institucional autorizado consulta el detalle
- **THEN** recibe los valores clínicos asociados al incidente

#### Scenario: Acceso fuera del ámbito
- **WHEN** un usuario ajeno intenta consultar las observaciones de un incidente
- **THEN** el servidor deniega el acceso conforme a la autorización existente
