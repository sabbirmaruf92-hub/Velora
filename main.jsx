import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { SettingsProvider } from './app-core.jsx';
import Shell from './app-shell.jsx';

// Every file named page-*.jsx or admin-*.jsx is picked up automatically.
// A page file only needs: export const route = '/path'; export default function Page() {...}
const modules = import.meta.glob(['./page-*.jsx', './admin-*.jsx'], { eager: true });
const routes = Object.values(modules)
  .filter((m) => m.route && m.default)
  .map((m) => ({ route: m.route, Page: m.default }));

function match(pattern, path) {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

function currentPath() {
  const h = window.location.hash.replace(/^#/, '') || '/';
  return h.split('?')[0] || '/';
}

function ComingSoon() {
  return (
    <div className="page center">
      <h1 className="h1">Coming soon</h1>
      <p className="muted">This page is being built. Please check back shortly.</p>
      <a className="btn" href="#/">Back to home</a>
    </div>
  );
}

function App() {
  const [path, setPath] = useState(currentPath());

  useEffect(() => {
    const onHash = () => {
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  let Page = null;
  let params = {};
  for (const r of routes) {
    const p = match(r.route, path);
    if (p) {
      Page = r.Page;
      params = p;
      break;
    }
  }

  return <Shell path={path}>{Page ? <Page params={params} /> : <ComingSoon />}</Shell>;
}

createRoot(document.getElementById('root')).render(
  <SettingsProvider>
    <App />
  </SettingsProvider>
);
