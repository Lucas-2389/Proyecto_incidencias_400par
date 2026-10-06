import { Suspense, lazy } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { SessionProvider, hasRole, useSession } from './session';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { IncidentDetail, IncidentList } from './pages/Incidents';
import { Organization, Resources } from './pages/Resources';
import Directory from './pages/Directory';
import History from './pages/History';
import './style.css';

const MapView = lazy(() => import('./pages/MapView'));
const operational = ['SuperAdministrador', 'AdministradorInstitucional', 'Operador'];
const administrative = ['SuperAdministrador', 'AdministradorInstitucional'];

function Restricted({ roles, children }) {
  const { session } = useSession();
  if (!session) return <Navigate to="/login" replace />;
  if (!hasRole(session, ...roles)) return <Navigate to="/sin-acceso" replace />;
  return children;
}

function Shell({ children }) {
  const { session, logout } = useSession();
  const links = [
    ['/', '◫', 'Dashboard', operational],
    ['/incidentes', '▤', 'Incidentes', operational],
    ['/mapa', '◎', 'Mapa', operational],
    ['/instituciones', '▣', 'Instituciones', administrative],
    ['/unidades', '▰', 'Unidades', administrative],
    ['/personal', '♙', 'Personal', administrative],
    ['/directorio', '☎', 'Directorio', administrative],
    ['/historial', '↺', 'Historial', administrative],
  ];
  return <div className="app-shell"><aside className="sidebar"><Link className="brand" to="/"><span className="brand-symbol">●</span><span><strong>Centro de<br />operaciones</strong><small>Gestión de incidencias</small></span></Link>
    <div className="sidebar-label">PLATAFORMA</div><nav aria-label="Navegación principal">{links.filter(([, , , roles]) => hasRole(session, ...roles)).map(([path, icon, label]) => <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-icon">{icon}</span>{label}</NavLink>)}</nav>
    <div className="sidebar-footer"><div className="pilot"><span className="live-dot" /> Piloto Ayacucho</div><small>Datos DEMO · Uso de prueba</small></div></aside>
    <div className="main-area"><header className="topbar"><div className="topbar-title">Plataforma de respuesta y coordinación</div><div className="user-menu"><span className="avatar">{session?.user?.name?.[0]?.toUpperCase() ?? 'U'}</span><div><strong>{session?.user?.name}</strong><small>{session?.user?.roles?.join(' · ')}</small></div><button className="text-button" onClick={logout}>Salir</button></div></header><main>{children}</main></div>
  </div>;
}

function AppRoutes() {
  const secure = (roles, node) => <Restricted roles={roles}><Shell>{node}</Shell></Restricted>;
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={secure(operational, <Dashboard />)} />
    <Route path="/incidentes" element={secure(operational, <IncidentList />)} />
    <Route path="/incidentes/:id" element={secure(operational, <IncidentDetail />)} />
    <Route path="/mapa" element={secure(operational, <Suspense fallback={<div className="loading">Cargando mapa…</div>}><MapView /></Suspense>)} />
    <Route path="/instituciones" element={secure(administrative, <Organization />)} />
    <Route path="/unidades" element={secure(administrative, <Resources kind="units" />)} />
    <Route path="/personal" element={secure(administrative, <Resources kind="personnel" />)} />
    <Route path="/directorio" element={secure(administrative, <Directory />)} />
    <Route path="/historial" element={secure(administrative, <History />)} />
    <Route path="/sin-acceso" element={<div className="denied"><h1>Acceso no permitido</h1><p>Tu rol no permite abrir esta sección.</p><Link to="/">Volver al inicio</Link></div>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

export default function App({ client, Router = BrowserRouter }) {
  return <SessionProvider client={client}><Router><AppRoutes /></Router></SessionProvider>;
}
