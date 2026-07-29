import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from './api';
import type { Profile, QrStatus, Session } from './types';

const Icon = ({ name }: { name: 'grid' | 'phone' | 'plus' | 'refresh' | 'trash' | 'logout' | 'shield' }) => {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/></>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></>,
    shield: <path d="M12 3l8 4v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V7l8-4z"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
};

function Login({ onLogin }: { onLogin: (profile: Profile) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try { onLogin(await api.login(username, password)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in'); }
    finally { setBusy(false); }
  }

  return <main className="login-page">
    <section className="login-aside">
      <div className="brand brand-large"><span className="brand-mark">V</span><span>VenusConnect</span></div>
      <div className="login-copy">
        <span className="eyebrow">WhatsApp infrastructure</span>
        <h1>One calm place for every connection.</h1>
        <p>Monitor device health, connect new numbers, and keep your gateway under control.</p>
      </div>
      <div className="security-note"><Icon name="shield"/><span>Credentials stay protected by a signed, HTTP-only session.</span></div>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="mobile-brand"><span className="brand-mark">V</span> VenusConnect</div>
        <span className="eyebrow">Private workspace</span>
        <h2>Welcome back</h2>
        <p className="muted">Sign in to manage your WhatsApp sessions.</p>
        <label>Username<input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
      </form>
    </section>
  </main>;
}

function SessionCard({ session, onQr, onDelete }: { session: Session; onQr: () => void; onDelete: () => void }) {
  const state = session.connected ? 'connected' : session.hasQr ? 'qr_ready' : session.status || 'disconnected';
  return <article className="session-card">
    <div className="session-head">
      <div className={`device-icon ${session.connected ? 'online' : ''}`}><Icon name="phone"/></div>
      <span className={`status ${state}`}>{state.replaceAll('_', ' ')}</span>
    </div>
    <h3>{session.session_id}</h3>
    <p>{session.name || session.phone_number || 'Device is not linked yet'}</p>
    <dl>
      <div><dt>Phone</dt><dd>{session.phone_number || '—'}</dd></div>
      <div><dt>Last connected</dt><dd>{session.last_connected ? new Date(session.last_connected).toLocaleString() : 'Never'}</dd></div>
    </dl>
    <div className="card-actions">
      {!session.connected && <button className="secondary" onClick={onQr}>{session.hasQr ? 'Show QR code' : 'Connect device'}</button>}
      <button className="icon-button danger" title="Delete session" onClick={onDelete}><Icon name="trash"/></button>
    </div>
  </article>;
}

function Dashboard({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [qr, setQr] = useState<(QrStatus & { id: string }) | null>(null);

  const load = useCallback(async () => {
    try { setSessions(await api.sessions()); setNotice(''); }
    catch (err) {
      if (err instanceof ApiError && err.status === 401) onLogout();
      else setNotice(err instanceof Error ? err.message : 'Unable to load sessions');
    } finally { setLoading(false); }
  }, [onLogout]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!qr || qr.status === 'connected') return;
    const timer = window.setInterval(async () => {
      try {
        const next = await api.qr(qr.id);
        setQr({ ...next, id: qr.id });
        if (next.status === 'connected') void load();
      } catch (err) { setNotice(err instanceof Error ? err.message : 'QR refresh failed'); }
    }, 2500);
    return () => clearInterval(timer);
  }, [qr?.id, qr?.status, load]);

  const stats = useMemo(() => ({
    total: sessions.length,
    connected: sessions.filter(s => s.connected).length,
    attention: sessions.filter(s => !s.connected).length,
  }), [sessions]);

  async function showQr(session: Session) {
    setQr({ id: session.session_id, session_id: session.session_id, status: 'connecting', message: 'Preparing secure QR code…' });
    try {
      const data = session.hasQr
        ? await api.qr(session.session_id)
        : await api.createSession({ session_id: session.session_id });
      setQr({ ...data, id: session.session_id });
    } catch (err) { setQr(null); setNotice(err instanceof Error ? err.message : 'Unable to connect'); }
  }

  async function remove(session: Session) {
    if (!window.confirm(`Delete “${session.session_id}” and log out its WhatsApp device?`)) return;
    try { await api.deleteSession(session.session_id); await load(); }
    catch (err) { setNotice(err instanceof Error ? err.message : 'Unable to delete session'); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">V</span><span>VenusConnect</span></div>
      <nav><a className="active"><Icon name="grid"/>Overview</a><a><Icon name="phone"/>Sessions <span>{stats.total}</span></a></nav>
      <div className="sidebar-foot"><div className="avatar">{profile.username.slice(0,2).toUpperCase()}</div><div><strong>{profile.username}</strong><small>Workspace admin</small></div><button title="Sign out" onClick={onLogout}><Icon name="logout"/></button></div>
    </aside>
    <main className="content">
      <header className="topbar"><div><span className="eyebrow">Workspace overview</span><h1>Good to see you, {profile.username}</h1><p>Here’s what’s happening with your gateway right now.</p></div><div className="top-actions"><button className="secondary" onClick={()=>void load()}><Icon name="refresh"/>Refresh</button><button className="primary" onClick={()=>setCreateOpen(true)}><Icon name="plus"/>New session</button></div></header>
      {notice && <div className="notice" role="alert">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
      <section className="stats">
        <article><span>Total sessions</span><strong>{stats.total}</strong><small>Linked to this workspace</small></article>
        <article><span>Connected now</span><strong className="green">{stats.connected}</strong><small><i className="pulse"/>Live and ready</small></article>
        <article><span>Needs attention</span><strong className={stats.attention ? 'amber' : ''}>{stats.attention}</strong><small>Disconnected or awaiting scan</small></article>
      </section>
      <section className="section-head"><div><h2>Your sessions</h2><p>Manage every WhatsApp device connected to this gateway.</p></div></section>
      <section className="session-grid">
        {loading ? <div className="empty">Loading your sessions…</div> : sessions.length === 0 ? <div className="empty"><div className="empty-icon"><Icon name="phone"/></div><h3>No sessions yet</h3><p>Create your first session to connect a WhatsApp device.</p><button className="primary" onClick={()=>setCreateOpen(true)}><Icon name="plus"/>Create session</button></div> : sessions.map(session=><SessionCard key={session.session_id} session={session} onQr={()=>void showQr(session)} onDelete={()=>void remove(session)}/>)}
      </section>
    </main>
    {createOpen && <CreateModal onClose={()=>setCreateOpen(false)} onCreated={async data=>{setCreateOpen(false); await load(); setQr({...data,id:data.session_id});}} />}
    {qr && <QrModal data={qr} onClose={()=>{setQr(null);void load();}} />}
  </div>;
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (data: QrStatus) => void }) {
  const [id, setId] = useState(''); const [webhook, setWebhook] = useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{onCreated(await api.createSession({...(id.trim()&&{session_id:id.trim()}),...(webhook.trim()&&{webhook_url:webhook.trim()})}));}catch(err){setError(err instanceof Error?err.message:'Unable to create session');setBusy(false);}}
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><form className="modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}>×</button><span className="eyebrow">New connection</span><h2>Create a session</h2><p className="muted">Give this device a memorable name. You’ll scan a QR code next.</p><label>Session ID <small>optional</small><input value={id} onChange={e=>setId(e.target.value)} pattern="[A-Za-z0-9_-]+" maxLength={80} placeholder="e.g. support-team"/></label><label>Webhook URL <small>optional</small><input value={webhook} onChange={e=>setWebhook(e.target.value)} type="url" placeholder="https://example.com/webhook"/></label>{error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?'Creating…':'Create & connect'}</button></div></form></div>;
}

function QrModal({data,onClose}:{data:QrStatus&{id:string};onClose:()=>void}) {
  const connected=data.status==='connected';
  return <div className="modal-backdrop"><div className="modal qr-modal"><button className="modal-close" onClick={onClose}>×</button><span className="eyebrow">{connected?'Device connected':'Secure pairing'}</span><h2>{connected?'You’re connected':'Scan with WhatsApp'}</h2><p className="muted">{connected?'This session is live and ready to use.':'Open WhatsApp → Linked devices → Link a device.'}</p><div className={`qr-frame ${connected?'success':''}`}>{connected?<><div className="check">✓</div><strong>Connection successful</strong></>:data.qr?<img src={data.qr} alt="WhatsApp pairing QR code"/>:<><div className="spinner"/><span>{data.message||'Waiting for QR code…'}</span></>}</div><button className="primary wide" onClick={onClose}>{connected?'Done':'Close'}</button></div></div>;
}

export default function App() {
  const [profile,setProfile]=useState<Profile|null>(null); const [checking,setChecking]=useState(true);
  useEffect(()=>{api.session().then(setProfile).catch(()=>setProfile(null)).finally(()=>setChecking(false));},[]);
  const logout=useCallback(async()=>{try{await api.logout();}catch{/* clear local UI even if session already expired */}setProfile(null);},[]);
  if(checking)return <div className="boot"><span className="brand-mark">V</span><div className="spinner"/></div>;
  return profile?<Dashboard profile={profile} onLogout={logout}/>:<Login onLogin={setProfile}/>;
}
