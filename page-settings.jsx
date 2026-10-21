import React, { useState } from 'react';
import { getThemeMode, setThemeMode } from './app-core.jsx';

export const route = '/settings';

const OPTIONS = [['light', 'Light', 'Bright background'], ['dark', 'Dark', 'Easier on the eyes at night'], ['auto', 'Auto', 'Follows your phone setting']];

export default function SettingsPage() {
  const [mode, setMode] = useState(getThemeMode());

  function choose(m) {
    setThemeMode(m);
    setMode(m);
  }

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <h1 className="h1" style={{ marginTop: 16 }}>Settings</h1>
      <h2 className="h2">Theme</h2>
      <div className="plist" role="radiogroup" aria-label="Theme">
        {OPTIONS.map(([k, label, hint]) => (
          <label key={k} className="pitem" style={{ cursor: 'pointer', border: mode === k ? '2px solid var(--black)' : undefined }}>
            <div><strong>{label}</strong><p className="meta">{hint}</p></div>
            <input type="radio" name="theme" checked={mode === k} onChange={() => choose(k)} />
          </label>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 12 }}>This choice is saved on this phone only.</p>
    </div>
  );
}
