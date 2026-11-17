# admin-navigation Specification

## Purpose

Organizar el acceso al panel institucional alrededor del seguimiento de incidentes y la administración institucional autorizada.

## Requirements

### Requirement: Navegación administrativa simplificada
El panel SHALL retirar los enlaces y pantallas de Unidades y Personal para todos los roles. SHALL conservar los accesos autorizados a Dashboard, Incidentes, Mapa, Instituciones, Directorio e Historial.

#### Scenario: Menú administrativo
- **WHEN** un superadministrador o administrador institucional abre el panel
- **THEN** el menú excluye Unidades y Personal y permite acceder a las demás secciones correspondientes a su rol

#### Scenario: Enlaces anteriores a recursos
- **WHEN** se abre directamente `/unidades` o `/personal`
- **THEN** la aplicación aplica su redirección de ruta desconocida y evita montar una pantalla de recursos

#### Scenario: Organización institucional
- **WHEN** un administrador autorizado abre Instituciones
- **THEN** puede consultar la organización institucional y sus sedes

#### Scenario: Acceso de operador
- **WHEN** un operador abre el panel e intenta acceder a una sección reservada a administración
- **THEN** conserva el acceso a sus operaciones y recibe la restricción de acceso correspondiente para la sección administrativa

### Requirement: Menú de cuenta institucional
La cabecera SHALL ofrecer un control de cuenta con avatar, nombre y roles legibles para Operador, AdministradorInstitucional y SuperAdministrador. El menú SHALL incluir Mi perfil, Cambiar contraseña y Cerrar sesión. Cambiar contraseña SHALL abrir directamente la sección Seguridad del perfil.

#### Scenario: Perfil desde la cabecera
- **WHEN** un usuario institucional abre el menú de cuenta y selecciona Mi perfil
- **THEN** accede a su perfil dentro del panel

#### Scenario: Acceso directo a seguridad
- **WHEN** selecciona Cambiar contraseña
- **THEN** accede a la sección Seguridad con el formulario de cambio de contraseña disponible

#### Scenario: Roles legibles
- **WHEN** una cuenta tiene el rol AdministradorInstitucional o SuperAdministrador
- **THEN** la cabecera muestra Administrador institucional o Superadministrador según corresponda

### Requirement: Uso accesible del menú de cuenta
El control de cuenta SHALL permitir abrirse por teclado, comunicar su estado expandido, mostrar foco visible y cerrarse con Escape o al pulsar fuera. Al cerrarse con Escape SHALL devolver el foco al control de cuenta. Los accesos al perfil SHALL aplicar los permisos institucionales también en navegación directa.

#### Scenario: Menú por teclado
- **WHEN** el usuario abre el control con teclado, recorre sus opciones y pulsa Escape
- **THEN** puede alcanzar las opciones, el menú se cierra y el foco regresa al control

#### Scenario: Ruta privada
- **WHEN** una persona sin sesión abre directamente el perfil
- **THEN** el panel solicita iniciar sesión antes de mostrar datos privados

#### Scenario: Rol ciudadano
- **WHEN** una cuenta exclusivamente ciudadana intenta abrir el perfil institucional
- **THEN** el panel aplica la restricción de acceso correspondiente

### Requirement: Cierre explícito de sesión
La acción Cerrar sesión SHALL borrar inmediatamente la sesión local, iniciar la revocación de su token de renovación y llevar al usuario al ingreso. Un fallo de revocación remota SHALL conservar el cierre local. Las respuestas pendientes SHALL evitar restaurar la identidad cerrada o sus datos privados.

#### Scenario: Cierre de sesión
- **WHEN** el usuario selecciona Cerrar sesión desde el menú o el perfil
- **THEN** llega al ingreso y las pantallas privadas requieren autenticarse nuevamente

#### Scenario: Error de red al cerrar
- **WHEN** la petición de revocación falla por conexión
- **THEN** el cierre local se mantiene y el usuario llega al ingreso

#### Scenario: Respuesta tardía
- **WHEN** llega una lectura, edición o renovación iniciada antes del cierre de sesión
- **THEN** esa respuesta no restablece la sesión ni los datos de la cuenta anterior
