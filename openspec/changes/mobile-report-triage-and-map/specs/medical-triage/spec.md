# Spec Delta

## ADDED Requirements

### Requirement: Cuestionario móvil SAMU condicional
El formulario móvil SHALL mostrar un bloque SAMU opcional después de la categoría y antes de la descripción únicamente para los códigos `medical_emergency` y `traffic_accident`. SHALL presentar juntas las preguntas de conciencia, respiración y sangrado con respuestas Sí, No y No sé, inicialmente desconocidas.

#### Scenario: Categoría habilitada
- **WHEN** se selecciona Emergencia médica o Accidente de tránsito
- **THEN** aparecen las tres preguntas con No sé seleccionado y el usuario puede enviar sin responderlas

#### Scenario: Cambio de categoría
- **WHEN** se cambia la categoría seleccionada
- **THEN** se restablecen observaciones, subtipo y cantidad a desconocidos
- **AND** el bloque queda oculto si la nueva categoría carece de cuestionario SAMU

#### Scenario: Respuestas independientes
- **WHEN** el usuario selecciona No para conciencia, Sí para respiración y No sé para sangrado
- **THEN** el envío conserva `isConscious=false`, `isBreathing=true` y `hasBleeding=null` o ausente

### Requirement: Subtipo y cantidad de afectados en móvil
El bloque SAMU SHALL permitir seleccionar un subtipo activo de la categoría elegida y una cantidad entera no negativa de afectados o desconocida. El subtipo médico SHALL usar las opciones de emergencia médica y el de tránsito las opciones de tránsito. Ambos datos SHALL ser opcionales.

#### Scenario: Subtipo médico
- **WHEN** se selecciona Emergencia médica
- **THEN** se ofrecen sus subtipos activos y el envío usa el identificador de la opción seleccionada

#### Scenario: Subtipo de tránsito
- **WHEN** se selecciona Accidente de tránsito
- **THEN** se ofrecen exclusivamente sus subtipos activos y el envío valida su pertenencia a esa categoría

#### Scenario: Varias personas
- **WHEN** se elige 3 o más afectados
- **THEN** se solicita una cantidad exacta entera mínima de 3 y se indica que las observaciones corresponden a la persona principal identificada en la descripción

#### Scenario: Opciones de cantidad
- **WHEN** se abre el selector de afectados
- **THEN** se ofrecen No sé, 0, 1, 2 y 3 o más, con No sé inicialmente seleccionado
- **AND** No sé conserva la cantidad desconocida y las opciones 0, 1 y 2 envían su valor explícito

#### Scenario: Cantidad menor a tres en la entrada exacta
- **WHEN** se selecciona 3 o más y se introduce 0, 1 o 2
- **THEN** el formulario solicita un entero mínimo de 3 antes del envío y permite elegir otra opción del selector

#### Scenario: Cantidad inválida
- **WHEN** se introduce una cantidad negativa, decimal o no numérica
- **THEN** el formulario solicita corregirla antes del envío y permite elegir desconocida

#### Scenario: Error al cargar subtipos
- **WHEN** falla la consulta de subtipos o una respuesta corresponde a una categoría anterior
- **THEN** se permite reintentar y enviar sin subtipo, y se evita seleccionar opciones de otra categoría

### Requirement: Persistencia móvil del contenido clínico enviado
El cliente SHALL incluir los datos conocidos en el reporte y conservarlos junto con los desconocidos al guardar un pendiente. Los reintentos SHALL conservar contenido e identificador originales. Tras confirmación o guardado como pendiente, el formulario SHALL restablecer el bloque para el siguiente reporte.

#### Scenario: Pendiente clínico tras reiniciar
- **WHEN** un reporte con observaciones, subtipo y afectados se guarda sin conexión y la app se reinicia
- **THEN** el reintento envía el mismo contenido y clave de idempotencia y obtiene una única referencia

#### Scenario: Fallo recuperable de envío
- **WHEN** la API rechaza el reporte antes de confirmarlo o guardarlo como pendiente
- **THEN** las respuestas permanecen disponibles para corregir y reintentar

#### Scenario: Nuevo reporte
- **WHEN** el reporte anterior queda confirmado o guardado en pendientes
- **THEN** las observaciones y cantidad vuelven a desconocidas y el subtipo queda sin selección
