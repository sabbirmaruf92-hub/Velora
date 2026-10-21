import React, { useCallback, useEffect, useState } from 'react';
import { useSettings, configured, supabase } from './app-core.jsx';
import { loadCartItems, onCartChange } from './app-store.jsx';
import { POLICY_SLUGS, DEFAULT_PAGES, waLink } from './app-pages.jsx';
import './theme.css';

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

const SOCIAL = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['tiktok', 'TikTok']];

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

function Footer({ settings }) {
  const social = settings.social_links || {};
  const contact = settings.contact || {};
  const wa = waLink(social.whatsapp);
  const links = SOCIAL.filter(([k]) => social[k]);
  return (
    <footer className="footer">
      <div className="footer-in">
        <div className="tiles">
          <div className="tile"><strong>Cash on Delivery</strong><span>Pay when it arrives</span></div>
          <div className="tile"><strong>Delivery across Bangladesh</strong><span>Charge shown before you order</span></div>
          <div className="tile"><strong>Secure orders</strong><span>Your details stay private</span></div>
          <div className="tile"><strong>Support</strong><span>We are here to help</span></div>
        </div>
        <div className="footer-cols">
          <div>
            <h3>Shop</h3>
            <a href="#/shop">All products</a>
            <a href="#/delivery">Delivery</a>
            <a href="#/reseller">Become a reseller</a>
          </div>
          <div>
            <h3>Care</h3>
            <a href="#/help">Help &amp; Support</a>
            <a href="#/contact">Contact</a>
            {POLICY_SLUGS.map((s) => <a key={s} href={'#/policy/' + s}>{DEFAULT_PAGES[s].title}</a>)}
          </div>
          <div>
            <h3>Follow us</h3>
            {wa && <a href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
            {links.map(([k, label]) => <a key={k} href={social[k]} target="_blank" rel="noreferrer">{label}</a>)}
            {!wa && links.length === 0 && <span className="muted">Coming soon</span>}
            {contact.phone && <a href={'tel:' + contact.phone}>{contact.phone}</a>}
          </div>
        </div>
        <p className="footer-copy">&copy; {new Date().getFullYear()} {settings.brand_name}. All rights reserved.</p>
      </div>
    </footer>
  );
}

function isActive(path, to) {
  if (to === '/') return path === '/';
  return path === to || path.startsWith(to + '/');
}

export default function Shell({ path, children }) {
  const settings = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
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

  useEffect(() => {
    if (!configured) return undefined;
    let alive = true;
    const refresh = () => {
      loadCartItems()
        .then((items) => { if (alive) setCartCount(items.reduce((s, i) => s + i.qty, 0)); })
        .catch(() => {});
    };
    refresh();
    const off = onCartChange(refresh);
    const { data: sub } = supabase.auth.onAuthStateChange(() => { setTimeout(refresh, 0); });
    return () => {
      alive = false;
      off();
      sub.subscription.unsubscribe();
    };
  }, []);

  const welcome = settings.welcome || {};
  const isAdmin = path.startsWith('/admin');
  const splashOn = showSplash && welcome.enabled !== false && !isAdmin;

  return (
    <>
      {splashOn && <Splash brand={settings.brand_name} text={welcome.text || 'Welcome'} onDone={finish} />}

      <header className="header">
        <a className="brand" href="#/">
          {settings.logo_url ? <img className="logo-img" src={settings.logo_url} alt={settings.brand_name} /> : settings.brand_name}
        </a>
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
        {!isAdmin && configured && <Footer settings={settings} />}
      </main>

      {!isAdmin && (
        <nav className="bottom-nav" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.to} href={'#' + n.to} className={isActive(path, n.to) ? 'on' : ''} aria-current={isActive(path, n.to) ? 'page' : undefined}>
              {icons[n.icon]}
              {n.icon === 'cart' && cartCount > 0 && <span className="cart-badge" aria-label={cartCount + ' items in cart'}>{cartCount > 99 ? '99+' : cartCount}</span>}
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
      )}
    </>
  );
            }
