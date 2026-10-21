import React, { useEffect, useState } from 'react';
import { supabase } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin/design';
export const tab = { label: 'Design', order: 9 };

const PRESETS = [
  ['Soft pink (default)', { soft_pink: '#F8DDE8', white: '#FFFFFF', black: '#171717', dusty_pink: '#E9B9CC' }],
  ['Black, white and gold', { soft_pink: '#F5EBD0', white: '#FFFFFF', black: '#111111', dusty_pink: '#C9A24B' }],
];
const NAMES = [['soft_pink', 'Soft background'], ['white', 'Page background'], ['black', 'Text and buttons'], ['dusty_pink', 'Accent']];
const HEX = /^#[0-9a-fA-F]{6}$/;

export default function AdminDesign() {
  const [theme, setTheme] = useState(PRESETS[0][1]);
  const [welcome, setWelcome] = useState({ enabled: true, text: 'Welcome to Velora' });
  const [logo, setLogo] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('store_settings').select('key,value').in('key', ['theme', 'welcome', 'logo_url']).then(({ data }) => {
      (data || []).forEach((r) => {
        if (r.key === 'theme') setTheme({ ...PRESETS[0][1], ...r.value });
        if (r.key === 'welcome') setWelcome({ enabled: true, text: '', ...r.value });
        if (r.key === 'logo_url' && typeof r.value === 'string') setLogo(r.value);
      });
    });
  }, []);

  async function save() {
    setMsg(null);
    if (NAMES.some(([k]) => !HEX.test(theme[k]))) { setMsg({ bad: true, text: 'Each colour must look like #AABBCC.' }); return; }
    setBusy(true);
    try {
      let logoUrl = logo;
      if (file) {
        if (file.size > 1024 * 1024) throw new Error('The logo is too big. Please use a file under 1 MB (smaller is better).');
        const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = 'logo/' + Date.now() + '.' + ext;
        const up = await supabase.storage.from('site-assets').upload(path, file, { contentType: file.type });
        if (up.error) throw new Error(up.error.message);
        logoUrl = supabase.storage.from('site-assets').getPublicUrl(path).data.publicUrl;
      }
      const rows = [
        { key: 'theme', value: theme, is_public: true },
        { key: 'welcome', value: { enabled: welcome.enabled, text: welcome.text.trim() || 'Welcome' }, is_public: true },
      ];
      const r = await supabase.from('store_settings').upsert(rows, { onConflict: 'key' });
      if (r.error) throw new Error(r.error.message);
      if (logoUrl) {
        const l = await supabase.from('store_settings').upsert({ key: 'logo_url', value: logoUrl, is_public: true }, { onConflict: 'key' });
        if (l.error) throw new Error(l.error.message);
      } else {
        await supabase.from('store_settings').delete().eq('key', 'logo_url');
      }
      setLogo(logoUrl);
      setFile(null);
      setMsg({ bad: false, text: 'Saved. Reload the shop to see the new look.' });
    } catch (e) {
      setMsg({ bad: true, text: e.message });
    }
    setBusy(false);
  }

  return (
    <AdminLayout>
      <div className="row-head"><h1 className="h1" style={{ fontSize: 20 }}>Design</h1></div>

      <div className="fsec">
        <h2>Colours</h2>
        <div className="chips" style={{ marginBottom: 10 }}>
          {PRESETS.map(([label, t]) => <button key={label} className="chip" onClick={() => setTheme(t)}>{label}</button>)}
        </div>
        {NAMES.map(([k, label]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <input type="color" aria-label={label} value={HEX.test(theme[k]) ? theme[k] : '#000000'} onChange={(e) => setTheme({ ...theme, [k]: e.target.value })} style={{ width: 48, height: 40, padding: 2 }} />
            <input value={theme[k]} onChange={(e) => setTheme({ ...theme, [k]: e.target.value })} aria-label={label + ' code'} style={{ maxWidth: 120 }} />
            <span className="meta">{label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', height: 36, marginTop: 8, border: '1px solid var(--line)' }}>
          {NAMES.map(([k]) => <div key={k} style={{ flex: 1, background: theme[k] }} />)}
        </div>
      </div>

      <div className="fsec">
        <h2>Welcome animation</h2>
        <label style={{ display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={welcome.enabled} onChange={(e) => setWelcome({ ...welcome, enabled: e.target.checked })} /> Show it when a visitor opens the shop</label>
        <label>Text under the shop name</label>
        <input value={welcome.text} onChange={(e) => setWelcome({ ...welcome, text: e.target.value })} />
      </div>

      <div className="fsec">
        <h2>Logo</h2>
        {logo && !file && (
          <div style={{ marginBottom: 8 }}>
            <img src={logo} alt="Current logo" style={{ height: 40, maxWidth: 200, objectFit: 'contain' }} />
            <button className="btn small danger" style={{ marginLeft: 10 }} onClick={() => setLogo('')}>Remove</button>
          </div>
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setFile(e.target.files[0] || null)} />
        <p className="meta" style={{ margin: '6px 0 0' }}>Use a small PNG or WebP with a see-through background, under 300 KB if you can. Without a logo, the shop name is shown.</p>
      </div>

      {msg && <p className={msg.bad ? 'notice' : 'okmsg'} role={msg.bad ? 'alert' : 'status'}>{msg.text}</p>}
      <div className="formbar"><button className="btn dark" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save design'}</button></div>
    </AdminLayout>
  );
      }
