# Spec Delta

## Purpose

Proporcionar a instituciones una interfaz React para revisar reportes, coordinar recursos y consultar datos de su ámbito.

## ADDED Requirements

### Requirement: Vistas institucionales
El panel SHALL ofrecer Login, Dashboard, Incidentes, Detalle, Mapa, Unidades, Personal, Institución/Sede, Directorio e Historial.

#### Scenario: Operación normal
- **WHEN** un Operador inicia sesión y abre una incidencia autorizada
- **THEN** puede ver su detalle, ubicación, historial y acciones operativas permitidas

### Requirement: Alcance de cada rol
El panel SHALL mostrar funciones y datos según el rol, mientras la API MUST volver a comprobar cada permiso.

#### Scenario: SuperAdministrador
- **WHEN** un SuperAdministrador abre el panel
- **THEN** puede administrar el ámbito global configurado

#### Scenario: Administrador institucional
- **WHEN** un AdministradorInstitucional abre Recursos
- **THEN** gestiona únicamente unidades y personal de su institución

#### Scenario: Operador
- **WHEN** un Operador abre la bandeja
- **THEN** ve y opera únicamente incidentes de su ámbito asignado

### Requirement: Registro telefónico y despacho
El panel SHALL permitir al Operador crear reportes por llamada, revisar sugerencias, corregir derivaciones y asignar recursos permitidos.

#### Scenario: Llamada atendida
- **WHEN** el Operador registra una llamada y confirma una asignación
- **THEN** el panel muestra la referencia, fuente PHONE y recursos asignados

### Requirement: Indicadores básicos
El dashboard SHALL presentar conteos y tiempos de hitos operativos del ámbito autorizado.

#### Scenario: Métricas de sede
- **WHEN** un administrador filtra por fecha y sede propia
- **THEN** ve conteos y tiempos derivados de las incidencias visibles de esa sede

### Requirement: Configuración de API por entorno
El panel SHALL usar una URL de API configurable para desarrollo y producción, sin `localhost` fijado en el código cliente.

#### Scenario: Cambio de destino
- **WHEN** se configura la URL de un entorno distinto
- **THEN** el panel consulta ese destino sin modificar código fuente
