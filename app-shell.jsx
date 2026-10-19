import React, { useCallback, useEffect, useState } from 'react';
import { useSettings, configured } from './app-core.jsx';

function Svg({ children }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const icons = {
  home: (
    <Svg>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </Svg>
  ),
  shop: (
    <Svg>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </Svg>
  ),
  heart: (
    <Svg>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  ),
  cart: (
    <Svg>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </Svg>
  ),
  user: (
    <Svg>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  ),
  menu: (
    <Svg>
      <circle cx="12" cy="5" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="12" cy="19" r="1.2" />
    </Svg>
  ),
};

const NAV = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/shop', label: 'Shop', icon: 'shop' },
  { to: '/wishlist', label: 'Wishlist', icon: 'heart' },
  { to: '/cart', label: 'Cart', icon: 'cart' },
  { to: '/account', label: 'Account', icon: 'user' },
];

const MENU = [
  ['Home', '/'],
  ['Shop', '/shop'],
  ['Reseller', '/reseller'],
  ['Delivery', '/delivery'],
  ['Help & Support', '/help'],
  ['Contact', '/contact'],
  ['My Account', '/account'],
  ['Settings', '/settings'],
];

function Splash({ brand, text, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3300);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="splash" onClick={onDone} role="presentation">
      <div className="splash-word" aria-label={brand}>
        {String(brand).toUpperCase().split('').map((c, i) => (
          <span key={i} style={{ animationDelay: 0.1 + i * 0.1 + 's' }}>{c}</span>
        ))}
      </div>
      <p className="splash-text">{text}</p>
      <div className="splash-line" />
    </div>
  );
}

function isActive(path, to) {
  if (to === '/') return path === '/';
  return path === to || path.startsWith(to + '/');
}

export default function Shell({ path, children }) {
  const settings = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(() => {
    try {
      if (sessionStorage.getItem('velora_welcomed')) return false;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch (e) {
      return true;
    }
    return true;
  });

  const finish = useCallback(() => {
    try {
      sessionStorage.setItem('velora_welcomed', '1');
    } catch (e) {
      /* ignore */
    }
    setShowSplash(false);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  const welcome = settings.welcome || {};
  const splashOn = showSplash && welcome.enabled !== false;
  const isAdmin = path.startsWith('/admin');

  return (
    <>
      {splashOn && <Splash brand={settings.brand_name} text={welcome.text || 'Welcome'} onDone={finish} />}

      <header className="header">
        <a className="brand" href="#/">{settings.brand_name}</a>
        <button className="icon-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {icons.menu}
        </button>
        {menuOpen && (
          <nav className="menu" aria-label="Main menu">
            {MENU.map(([label, to]) => (
              <a key={to} href={'#' + to}>{label}</a>
            ))}
          </nav>
        )}
      </header>

      <main className="main">
        {configured ? (
          children
        ) : (
          <div className="page center">
            <h1 className="h1">Setup needed</h1>
            <p className="muted">The store is not connected to its database yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_KEY in the hosting settings, then redeploy.</p>
          </div>
        )}
      </main>

      {!isAdmin && (
        <nav className="bottom-nav" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.to} href={'#' + n.to} className={isActive(path, n.to) ? 'on' : ''} aria-current={isActive(path, n.to) ? 'page' : undefined}>
              {icons[n.icon]}
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
