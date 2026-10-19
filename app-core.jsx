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

const SettingsContext = createContext(defaults);
export const useSettings = () => useContext(SettingsContext);

function applyTheme(t) {
  const root = document.documentElement.style;
  root.setProperty('--soft-pink', t.soft_pink);
  root.setProperty('--white', t.white);
  root.setProperty('--black', t.black);
  root.setProperty('--dusty-pink', t.dusty_pink);
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaults);

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
    applyTheme({ ...defaults.theme, ...(settings.theme || {}) });
  }, [settings]);

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
