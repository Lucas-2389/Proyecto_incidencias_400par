# Spec Delta

## Purpose

Permitir que los usuarios institucionales exploren las ubicaciones autorizadas mediante marcadores y filtros comprensibles de tipo de incidente, distrito y periodo.

## ADDED Requirements

### Requirement: Mapa operativo con marcadores
El mapa administrativo SHALL presentar marcadores por tipo de incidente, agrupación de puntos cercanos, acceso al detalle y sedes autorizadas. SHALL eliminar el control y la representación de mapa de calor y sus solicitudes desde esta pantalla.

#### Scenario: Apertura del mapa
- **WHEN** un usuario institucional abre el mapa
- **THEN** ve el mapa operativo con sus marcadores y leyenda y la pantalla consulta los puntos autorizados sin solicitar datos de calor

#### Scenario: Apertura de reporte
- **WHEN** el usuario selecciona un marcador individual o un reporte de un grupo
- **THEN** puede abrir el detalle del incidente correspondiente

### Requirement: Filtros territoriales comprensibles
El mapa SHALL presentar los filtros en el orden Tipo de incidente, Distrito y Fechas opcionales. El tipo SHALL corresponder a una categoría del catálogo. El distrito SHALL seleccionarse por nombre desde el catálogo territorial y SHALL incluir Todos los distritos.

#### Scenario: Categoría y distrito
- **WHEN** el usuario selecciona un tipo y un distrito por sus nombres
- **THEN** la consulta transmite sus identificadores y muestra únicamente los incidentes autorizados que cumplen ambos filtros

#### Scenario: Carga fallida de distritos
- **WHEN** falla la consulta del catálogo territorial
- **THEN** la pantalla informa el error y permite reintentar sin solicitar al usuario un identificador numérico de distrito

#### Scenario: Distritos con nombres repetidos
- **WHEN** el catálogo contiene distritos con el mismo nombre
- **THEN** sus opciones incluyen el código territorial para distinguirlos y transmiten el identificador del distrito seleccionado

### Requirement: Filtros alineados y adaptables
El mapa SHALL alinear Tipo de incidente, Distrito, Desde (opcional) y Hasta (opcional) en una fila en escritorio, con controles de igual altura y fechas en columnas más estrechas. SHALL adaptar la distribución al ancho disponible y presentar el periodo aplicado y Actualizar debajo de los filtros.

#### Scenario: Filtros en escritorio
- **WHEN** el usuario consulta el mapa en un ancho de escritorio
- **THEN** los cuatro controles aparecen alineados en el orden establecido y el periodo aplicado y Actualizar aparecen en la fila inferior

#### Scenario: Filtros en pantalla pequeña
- **WHEN** el usuario consulta el mapa en un ancho móvil
- **THEN** Tipo de incidente y Distrito ocupan una fila cada uno y Desde (opcional) y Hasta (opcional) comparten la siguiente fila

#### Scenario: Ancho intermedio
- **WHEN** el mapa se presenta en un ancho intermedio
- **THEN** los filtros se distribuyen en dos filas, conservando su orden y etiquetas

### Requirement: Periodo opcional con límites explícitos
Las fechas SHALL estar inicialmente vacías y permitir consultar los últimos siete días mediante un periodo predeterminado indicado en pantalla. Un periodo personalizado SHALL requerir ambas fechas, incluir los días seleccionados en America/Lima y respetar el máximo de 90 días del servicio operativo.

#### Scenario: Sin fechas
- **WHEN** el usuario abre el mapa o borra ambas fechas
- **THEN** se consulta el periodo predeterminado de siete días y se informa el periodo aplicado

#### Scenario: Rango personalizado
- **WHEN** el usuario selecciona ambas fechas válidas dentro del límite admitido
- **THEN** se consultan desde el inicio del primer día hasta el inicio exclusivo del día posterior al último en America/Lima

#### Scenario: Periodo incompleto o inválido
- **WHEN** el usuario introduce una sola fecha, invierte los días o supera 90 días de consulta
- **THEN** recibe una indicación para corregir el intervalo y no se envía esa consulta inválida

#### Scenario: Sin coincidencias
- **WHEN** la consulta válida devuelve cero incidentes
- **THEN** el mapa conserva sus filtros y presenta un estado vacío comprensible

### Requirement: Ubicaciones operativas sujetas al ámbito
El mapa SHALL obtener los puntos exactos mediante el servicio institucional autenticado y SHALL respetar sus filtros de autorización y límites de consulta.

#### Scenario: Reporte ajeno
- **WHEN** un usuario consulta un territorio que contiene reportes ajenos a su ámbito
- **THEN** la respuesta y el mapa excluyen esos reportes

#### Scenario: Consulta demasiado amplia
- **WHEN** el servicio rechaza una consulta por superar el límite de resultados
- **THEN** la pantalla muestra la indicación de reducir el periodo o los filtros y permite corregirlos
