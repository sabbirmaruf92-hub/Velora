import React, { useEffect, useState } from 'react';
import { supabase } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';
import { DEFAULT_PAGES, DEFAULT_FAQ, POLICY_SLUGS } from './app-pages.jsx';

export const route = '/admin/pages';
export const tab = { label: 'Pages', order: 8 };

function PageEditor({ slug }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [custom, setCustom] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    const { data } = await supabase.from('store_settings').select('value').eq('key', 'page_' + slug).maybeSingle();
    const d = DEFAULT_PAGES[slug];
    setCustom(Boolean(data));
    setTitle((data && data.value.title) || d.title);
    setBody(data && typeof data.value.body === 'string' ? data.value.body : d.body);
    setMsg(null);
  }
  useEffect(() => { load(); }, [slug]);

  async function save() {
    if (!title.trim()) { setMsg({ bad: true, text: 'Please enter a title.' }); return; }
    const { error } = await supabase.from('store_settings').upsert({ key: 'page_' + slug, value: { title: title.trim(), body }, is_public: true }, { onConflict: 'key' });
    setMsg(error ? { bad: true, text: error.message } : { bad: false, text: 'Saved. Customers see it now.' });
    if (!error) setCustom(true);
  }

  async function reset() {
    if (!window.confirm('Go back to the standard text for this page?')) return;
    const { error } = await supabase.from('store_settings').delete().eq('key', 'page_' + slug);
    if (error) { setMsg({ bad: true, text: error.message }); return; }
    load();
  }

  return (
    <div className="fsec">
      <label>Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <label>Text</label>
      <textarea style={{ minHeight: 320 }} value={body} onChange={(e) => setBody(e.target.value)} />
      <p className="meta" style={{ margin: '6px 0 0' }}>Start a line with # for a heading and with - for a bullet. Leave an empty line between paragraphs.</p>
      {msg && <p className={msg.bad ? 'notice' : 'okmsg'} role={msg.bad ? 'alert' : 'status'} style={{ marginTop: 8 }}>{msg.text}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn dark" onClick={save}>Save</button>
        {custom && <button className="btn" onClick={reset}>Use standard text</button>}
      </div>
    </div>
  );
}

function FaqEditor() {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase.from('store_settings').select('value').eq('key', 'faq').maybeSingle().then(({ data }) => {
      setRows(data && Array.isArray(data.value) && data.value.length ? data.value : DEFAULT_FAQ);
    });
  }, []);

  const edit = (i, k, v) => setRows((rs) => rs.map((r, n) => (n === i ? { ...r, [k]: v } : r)));

  async function save() {
    const clean = rows.filter((r) => r.q.trim() && r.a.trim()).map((r) => ({ q: r.q.trim(), a: r.a.trim() }));
    const { error } = await supabase.from('store_settings').upsert({ key: 'faq', value: clean, is_public: true }, { onConflict: 'key' });
    setMsg(error ? { bad: true, text: error.message } : { bad: false, text: 'Saved.' });
    if (!error) setRows(clean);
  }

  if (!rows) return <p className="muted">Loading...</p>;
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} className="fsec">
          <label>Question</label>
          <input value={r.q} onChange={(e) => edit(i, 'q', e.target.value)} />
          <label>Answer</label>
          <textarea value={r.a} onChange={(e) => edit(i, 'a', e.target.value)} />
          <button className="btn small danger" style={{ marginTop: 8 }} onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))}>Remove</button>
        </div>
      ))}
      <button className="btn small" onClick={() => setRows((rs) => [...rs, { q: '', a: '' }])}>+ Add question</button>
      {msg && <p className={msg.bad ? 'notice' : 'okmsg'} style={{ marginTop: 8 }}>{msg.text}</p>}
      <div style={{ marginTop: 10 }}><button className="btn dark" onClick={save}>Save questions</button></div>
    </div>
  );
}

export default function AdminPages() {
  const [which, setWhich] = useState('privacy');
  const items = [...POLICY_SLUGS.map((s) => [s, DEFAULT_PAGES[s].title]), ['faq', 'Help questions']];
  return (
    <AdminLayout>
      <div className="row-head"><h1 className="h1" style={{ fontSize: 20 }}>Pages</h1></div>
      <p className="notice" style={{ fontSize: 13 }}>
        The standard texts are a starting point only. Please read each one and change it to match how your shop really works (return time, who pays courier, and so on). Consider asking a lawyer to review them.
      </p>
      <div className="chips" style={{ margin: '12px 0' }}>
        {items.map(([k, label]) => (
          <button key={k} className="chip" style={which === k ? { background: 'var(--black)', color: 'var(--white)' } : undefined} onClick={() => setWhich(k)}>{label}</button>
        ))}
      </div>
      {which === 'faq' ? <FaqEditor /> : <PageEditor key={which} slug={which} />}
    </AdminLayout>
  );
}
