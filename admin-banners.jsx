import React, { useEffect, useState } from 'react';
import { supabase } from './app-core.jsx';
import { AdminLayout, compressImage } from './app-admin.jsx';

export const route = '/admin/banners';
export const tab = { label: 'Banners', order: 11 };

const DEFAULT_HERO = { kicker: 'New collection', title: 'Your style, your choice', subtitle: '', button: 'Shop now', image_url: '' };

async function uploadImage(file, folder, max) {
  const blob = await compressImage(file, max, 0.82);
  const path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.jpg';
  const up = await supabase.storage.from('site-assets').upload(path, blob, { contentType: 'image/jpeg' });
  if (up.error) throw new Error(up.error.message);
  return supabase.storage.from('site-assets').getPublicUrl(path).data.publicUrl;
}

function Hero() {
  const [h, setH] = useState(DEFAULT_HERO);
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('store_settings').select('value').eq('key', 'hero').maybeSingle().then(({ data }) => {
      if (data) setH({ ...DEFAULT_HERO, ...data.value });
    });
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      let image = h.image_url;
      if (file) image = await uploadImage(file, 'hero', 1600);
      const value = { ...h, image_url: image };
      const { error } = await supabase.from('store_settings').upsert({ key: 'hero', value, is_public: true }, { onConflict: 'key' });
      if (error) throw new Error(error.message);
      setH(value);
      setFile(null);
      setMsg({ bad: false, text: 'Saved. Reload the shop to see it.' });
    } catch (e) {
      setMsg({ bad: true, text: e.message });
    }
    setBusy(false);
  }

  return (
    <div className="fsec">
      <h2>Home page cover</h2>
      <label>Small line above the title</label>
      <input value={h.kicker} onChange={(e) => setH({ ...h, kicker: e.target.value })} />
      <label>Title</label>
      <input value={h.title} onChange={(e) => setH({ ...h, title: e.target.value })} />
      <label>Short text under the title</label>
      <input value={h.subtitle} onChange={(e) => setH({ ...h, subtitle: e.target.value })} placeholder="Leave empty for the standard line" />
      <label>Button text</label>
      <input value={h.button} onChange={(e) => setH({ ...h, button: e.target.value })} />
      <label>Cover photo (optional)</label>
      {h.image_url && !file && (
        <div style={{ marginBottom: 8 }}>
          <img src={h.image_url} alt="Current cover" style={{ width: '100%', maxWidth: 320, borderRadius: 10 }} />
          <button className="btn small danger" style={{ marginTop: 6 }} onClick={() => setH({ ...h, image_url: '' })}>Remove photo</button>
        </div>
      )}
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
      {msg && <p className={msg.bad ? 'notice' : 'okmsg'} role={msg.bad ? 'alert' : 'status'} style={{ marginTop: 8 }}>{msg.text}</p>}
      <button className="btn dark" style={{ marginTop: 10 }} onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save cover'}</button>
    </div>
  );
}

function Promos() {
  const [rows, setRows] = useState(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('banners').select('*').order('sort_order');
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!file) { setMsg({ bad: true, text: 'Please choose a banner photo.' }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const url = await uploadImage(file, 'banners', 1400);
      const { error } = await supabase.from('banners').insert({ image_url: url, title: title.trim() || null, link_url: link.trim() || null, sort_order: (rows || []).length + 1 });
      if (error) throw new Error(error.message);
      setFile(null);
      setTitle('');
      setLink('');
      load();
    } catch (e) {
      setMsg({ bad: true, text: e.message });
    }
    setBusy(false);
  }

  async function toggle(b) {
    await supabase.from('banners').update({ is_active: !b.is_active }).eq('id', b.id);
    load();
  }
  async function remove(b) {
    if (!window.confirm('Delete this banner?')) return;
    await supabase.from('banners').delete().eq('id', b.id);
    load();
  }

  return (
    <div className="fsec">
      <h2>Promo banners</h2>
      <p className="meta" style={{ margin: 0 }}>Wide photos shown under the cover on the home page. A link can be a shop page like #/shop?cat=sarees.</p>
      {(rows || []).map((b) => (
        <div key={b.id} className="pitem" style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <img src={b.image_url} alt="" style={{ width: 90, height: 50, objectFit: 'cover', borderRadius: 6 }} />
            <div><strong>{b.title || 'No title'}</strong><p className="meta">{b.link_url || 'No link'}</p></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className={'btn small' + (b.is_active ? '' : ' dark')} onClick={() => toggle(b)}>{b.is_active ? 'Hide' : 'Show'}</button>
            <button className="btn small danger" onClick={() => remove(b)}>Delete</button>
          </div>
        </div>
      ))}
      {rows && rows.length === 0 && <p className="muted">No banners yet.</p>}
      <h2 style={{ marginTop: 14 }}>Add a banner</h2>
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
      <label>Title (optional)</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <label>Link (optional)</label>
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="#/shop" />
      {msg && <p className="notice" role="alert" style={{ marginTop: 8 }}>{msg.text}</p>}
      <button className="btn dark" style={{ marginTop: 10 }} onClick={add} disabled={busy}>{busy ? 'Uploading...' : 'Add banner'}</button>
    </div>
  );
}

export default function AdminBanners() {
  return (
    <AdminLayout>
      <div className="row-head"><h1 className="h1" style={{ fontSize: 20 }}>Banners</h1></div>
      <Hero />
      <Promos />
    </AdminLayout>
  );
                                   }
