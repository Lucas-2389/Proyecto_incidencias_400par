# Spec Delta

## ADDED Requirements

### Requirement: Distrito compartido en consultas operativas
Dashboard y bandeja SHALL ofrecer distrito por nombre desde el catálogo metropolitano, con Todos los distritos. El Dashboard SHALL aplicar la selección tanto a incidentes recientes como a indicadores. La bandeja SHALL combinar distrito con sus filtros vigentes y todas las consultas SHALL conservar el ámbito autorizado.

#### Scenario: Dashboard de un distrito
- **WHEN** el usuario selecciona San Juan Bautista
- **THEN** los indicadores y hasta seis incidentes recientes se calculan sobre los reportes autorizados de ese distrito y muestran su periodo efectivo

#### Scenario: Combinación de filtros de bandeja
- **WHEN** se seleccionan distrito y estado u otros filtros existentes
- **THEN** la API aplica su intersección antes del límite de resultados y la bandeja identifica cada incidente por categoría y referencia

#### Scenario: Distrito sin datos
- **WHEN** un distrito carece de incidentes visibles
- **THEN** el listado muestra un estado vacío y los indicadores muestran cero o Sin datos según la medida

#### Scenario: Filtro territorial manipulado
- **WHEN** un usuario consulta un distrito que contiene incidentes fuera de su ámbito
- **THEN** la consulta entrega únicamente los resultados autorizados y mantiene las restricciones del detalle
