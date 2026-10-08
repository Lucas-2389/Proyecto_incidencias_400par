# Panel institucional

Panel React del piloto `operational-mvp`. Usa la API `/api/v1` para Login, Dashboard, bandeja y detalle de incidentes, asignación, estados, mapa operativo, mapa de calor, recursos, instituciones, directorio e historial. La API vuelve a comprobar todos los permisos por rol y sede.

## Desarrollo en Windows

Iniciar MySQL y la API como se explica en el [README raíz](../../README.md). En PowerShell, desde la raíz:

```powershell
Copy-Item apps/admin/.env.example apps/admin/.env
npm --prefix apps/admin ci
npm --prefix apps/admin run dev
```

Abrir la URL que imprime Vite. `VITE_API_BASE_URL` indica la base de la API que usa el navegador; por defecto se configura `/api/v1`. `VITE_API_PROXY_TARGET` apunta al backend para el servidor de desarrollo y evita problemas de origen cruzado. Para producción, colocar el panel y `/api` bajo el mismo origen mediante proxy o configurar la URL pública de API en `VITE_API_BASE_URL` y permitir el origen en el servidor. `VITE_OSM_TILE_URL` configura las teselas OpenStreetMap. La atribución `© OpenStreetMap contributors` debe permanecer visible. No se guardan secretos en variables `VITE_`: Vite las incluye en el paquete del navegador.

## Cuentas de prueba

Ejecutar migraciones y `db:seed:demo:test` o `db:seed:demo:app` de la API en una base aislada antes de iniciar sesión. El seed crea `superadmin@demo.invalid`, `admin-pnp@demo.invalid`, `operator-pnp@demo.invalid` y equivalentes para SAMU, Bomberos y Municipalidad. La contraseña es la variable local `DEMO_PASSWORD` usada al sembrar los datos; no se versiona. Todas las instituciones, coberturas y reportes DEMO son ficticios y no se usan para despacho real.

## Comprobaciones

### Usabilidad del panel

La portada ofrece accesos directos a reportes y mapa. Estados y prioridades se presentan en español; el historial permite seleccionar institución y tipo de registro por nombre, con identificadores técnicos desplegables. El directorio selecciona distritos por nombre. Los formularios de recursos explican su identificación, bloquean el guardado sin sede y muestran el progreso; desactivar recursos o contactos requiere confirmación. Estos cambios conservan los valores del contrato HTTP y los permisos del backend.

Las pruebas de interfaz verifican que cancelar una desactivación no envía una petición y que los filtros del historial se pueden elegir y limpiar sin escribir identificadores internos.

Botones, navegación, enlaces y campos responden al cursor, foco de teclado y pulsación mediante bordes y colores. Las sedes sugeridas conservan su selección con `aria-pressed` y una marca visible; cambiar de sede limpia los recursos elegidos de la anterior. Las animaciones respetan `prefers-reduced-motion` y los botones deshabilitados no simulan una pulsación disponible.

```powershell
npm --prefix apps/admin test
npm --prefix apps/admin run build
```

La suite prueba sesión, renovación del token y el recorrido login → bandeja → asignación → cambio de estado con una API simulada. El bundle de producción queda en `apps/admin/dist` (ignorado por Git). La sesión se conserva solo en memoria; al recargar se vuelve a ingresar. Los puntos exactos solo se solicitan en el mapa operativo con JWT; el mapa de calor consulta agregados públicos protegidos por la API.

