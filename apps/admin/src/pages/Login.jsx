import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../session';
import { Field, Notice } from '../ui';

export default function Login() {
  const { login, session } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (session) return <Navigate to="/" replace />;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await login(email, password); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  return <div className="login-page"><div className="login-card">
    <div className="brand-mark">●</div><span className="eyebrow">Plataforma de gestión de incidencias</span>
    <h1>Centro de operaciones</h1><p>Ingresa con tu cuenta institucional para coordinar la atención del piloto.</p>
    <form onSubmit={submit} className="stack">
      <Field label="Correo institucional"><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Contraseña"><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Notice kind="error">{error}</Notice><button className="button primary" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
    </form><small>Acceso restringido · Piloto Ayacucho</small>
  </div></div>;
}
