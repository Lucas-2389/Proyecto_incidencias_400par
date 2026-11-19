import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from './session';

export const roleLabels = { Operador: 'Operador', AdministradorInstitucional: 'Administrador institucional', SuperAdministrador: 'Superadministrador', Ciudadano: 'Ciudadano' };

export default function AccountMenu() {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const area = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (!area.current?.contains(event.target)) { setOpen(false); setConfirmExit(false); } };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      setConfirmExit(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  function signOut() {
    void logout();
    navigate('/login', { replace: true });
  }
  return <div className="account-area" ref={area}>
    <button className="account-trigger" ref={trigger} aria-label={`Cuenta de ${session.user.name}`} aria-expanded={open} aria-controls="account-options" onClick={() => { setOpen(!open); setConfirmExit(false); }}>
      <span className="avatar" aria-hidden="true">{session.user.name?.[0]?.toUpperCase() ?? 'U'}</span>
      <span className="account-identity"><strong>{session.user.name}</strong><small>{session.user.roles.map((role) => roleLabels[role] ?? role).join(' · ')}</small></span>
      <span aria-hidden="true">⌄</span>
    </button>
    {open && <div id="account-options" className="account-options">
      <Link to="/perfil" onClick={() => setOpen(false)}>Mi perfil</Link>
      <Link to="/perfil#seguridad" onClick={() => setOpen(false)}>Cambiar contraseña</Link>
      {confirmExit ? <div role="alertdialog" aria-label="Confirmar cierre de sesión"><p>¿Cerrar tu sesión en este equipo?</p>
        <button onClick={signOut}>Sí, cerrar sesión</button>
        <button onClick={() => setConfirmExit(false)}>Continuar trabajando</button></div>
        : <button onClick={() => setConfirmExit(true)}>Cerrar sesión</button>}
    </div>}
  </div>;
}
