import React, { useEffect, useState } from 'react';
import { supabase, useSettings } from './app-core.jsx';
import './admin.css';

// Admin tabs register themselves: any admin-*.jsx file that exports
//   export const route = '/admin/...';  export const tab = { label: 'Name', order: 1 };
// shows up in the admin menu automatically (main.jsx collects them).
let tabs = [];
export function registerAdminTabs(list) {
  tabs = [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
}

const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL'];

// Numeric sizes sort by number, letter sizes by size order, everything else last.
export function sizeOrder(size) {
  const s = String(size || '').trim().toUpperCase();
  if (/^\d+(\.\d+)?$/.test(s)) return 1000 + Number(s);
  const i = LETTER_SIZES.indexOf(s);
  if (i >= 0) return i + 1;
  return 5000;
}

// Shrinks a photo to at most 1000px wide JPEG so it stays small on the free plan.
export async function compressImage(file, max = 1000, quality = 0.8) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not process the image'))),
      'image/jpeg',
      quality
    );
  });
}

function useSession() {
  const [state, setState] = useState({ loading: true, session: null });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ loading: false, session: data.session }));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ loading: false, session });
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError('Login failed. Please check your email and password.');
  }

  return (
    <div className="page">
      <form className="login" onSubmit={submit}>
        <h1 className="h1">Admin login</h1>
        <label htmlFor="adm-email">Email</label>
        <input id="adm-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="adm-pass">Password</label>
        <input id="adm-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="notice" role="alert">{error}</p>}
        <button className="btn dark" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </div>
  );
}

export function AdminLayout({ children }) {
  const settings = useSettings();
  const { loading, session } = useSession();
  const [isAdmin, setIsAdmin] = useState(null);
  const userId = session ? session.user.id : null;

  useEffect(() => {
    if (!userId) {
      setIsAdmin(null);
      return undefined;
    }
    let alive = true;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data, error }) => {
        if (alive) setIsAdmin(!error && !!data);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const signOut = () => supabase.auth.signOut();

  if (loading) return <div className="page center muted">Loading...</div>;
  if (!session) return <LoginForm />;
  if (isAdmin === null) return <div className="page center muted">Checking access...</div>;
  if (!isAdmin) {
    return (
      <div className="page center">
        <h1 className="h1">Not authorised</h1>
        <p className="muted">This account is not an administrator.</p>
        <button className="btn" onClick={signOut}>Sign out</button>
      </div>
    );
  }

  const here = window.location.hash.replace(/^#/, '').split('?')[0] || '/';

  return (
    <div className="admin">
      <div className="admin-bar">
        <strong>{settings.brand_name} Admin</strong>
        <div className="admin-bar-links">
          <a href="#/">View store</a>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </div>
      <nav className="admin-tabs" aria-label="Admin sections">
        {tabs.map((t) => (
          <a key={t.route} href={'#' + t.route} className={here === t.route ? 'on' : ''}>{t.label}</a>
        ))}
      </nav>
      <div className="admin-body">{children}</div>
    </div>
  );
}
