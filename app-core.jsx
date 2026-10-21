import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;

export const money = (n) => '\u09F3' + new Intl.NumberFormat('en-IN').format(Number(n) || 0);

const defaults = {
  brand_name: 'Velora',
  theme: { soft_pink: '#F8DDE8', white: '#FFFFFF', black: '#171717', dusty_pink: '#E9B9CC' },
  welcome: { enabled: true, text: 'Welcome to Velora' },
};

// ---------- light / dark / auto (saved on this device) ----------
const THEME_KEY = 'velora_theme';
export function getThemeMode() {
  try {
    const m = localStorage.getItem(THEME_KEY);
    return m === 'dark' || m === 'light' || m === 'auto' ? m : 'light';
  } catch (e) {
    return 'light';
  }
}
export function setThemeMode(mode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch (e) { /* ignore */ }
  window.dispatchEvent(new Event('velora-theme'));
}

function applyTheme(t, mode, systemDark) {
  const root = document.documentElement.style;
  const dark = mode === 'dark' || (mode === 'auto' && systemDark);
  if (dark) {
    root.setProperty('--white', '#141214');
    root.setProperty('--black', '#F4EEF1');
    root.setProperty('--soft-pink', 'color-mix(in srgb, ' + t.soft_pink + ' 20%, #141214)');
    root.setProperty('--dusty-pink', t.dusty_pink);
    root.setProperty('--line', 'color-mix(in srgb, ' + t.dusty_pink + ' 30%, #141214)');
    root.setProperty('--muted', '#b8adb2');
    root.colorScheme = 'dark';
  } else {
    root.setProperty('--soft-pink', t.soft_pink);
    root.setProperty('--white', t.white);
    root.setProperty('--black', t.black);
    root.setProperty('--dusty-pink', t.dusty_pink);
    root.removeProperty('--line');
    root.removeProperty('--muted');
    root.colorScheme = 'light';
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#141214' : t.soft_pink);
}

const SettingsContext = createContext(defaults);
export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaults);
  const [mode, setMode] = useState(getThemeMode());
  const [systemDark, setSystemDark] = useState(
    () => (window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false)
  );

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('store_settings')
      .select('key,value')
      .then(({ data }) => {
        if (!data) return;
        const next = { ...defaults };
        data.forEach((row) => {
          next[row.key] = row.value;
        });
        setSettings(next);
      });
  }, []);

  useEffect(() => {
    const onTheme = () => setMode(getThemeMode());
    window.addEventListener('velora-theme', onTheme);
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const onSystem = (e) => setSystemDark(e.matches);
    if (mq && mq.addEventListener) mq.addEventListener('change', onSystem);
    return () => {
      window.removeEventListener('velora-theme', onTheme);
      if (mq && mq.removeEventListener) mq.removeEventListener('change', onSystem);
    };
  }, []);

  useEffect(() => {
    applyTheme({ ...defaults.theme, ...(settings.theme || {}) }, mode, systemDark);
  }, [settings, mode, systemDark]);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

// Fades content in when it scrolls into view.
export function Reveal({ children, className = '' }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) {
      setOn(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={'reveal ' + (on ? 'in ' : '') + className}>
      {children}
    </div>
  );
            }
