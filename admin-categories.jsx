import React, { useEffect, useState } from 'react';
import { supabase } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin/categories';
export const tab = { label: 'Categories', order: 4 };

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    setCategories(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => {
    const updated = { ...f, [k]: v };
    if (k === 'name' && !f.id) updated.slug = slugify(v);
    return updated;
  });

  async function save() {
    if (!form.name) { setMsg('Name is required.'); return; }
    const payload = { name: form.name, slug: form.slug || slugify(form.name), sort_order: Number(form.sort_order) || 0, is_active: form.is_active !== false };
    if (form.id) {
      await supabase.from('categories').update(payload).eq('id', form.id);
    } else {
      await supabase.from('categories').insert(payload);
    }
    setMsg('Saved!');
    load();
    setTimeout(() => { setForm(null); setMsg(''); }, 1000);
  }

  async function deleteCategory(id) {
    if (!window.confirm('Delete this category? Products in it will be uncategorized.')) return;
    await supabase.from('categories').delete().eq('id', id);
    load();
  }

  if (form) return (
    <AdminLayout>
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>{form.id ? 'Edit Category' : 'New Category'}</h1>
        <button className="btn small" onClick={() => setForm(null)}>Back</button>
      </div>
      <div className="fsec">
        <label>Name *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} />
        <label>Slug (URL)</label>
        <input value={form.slug} onChange={e => set('slug', e.target.value)} />
        <label>Sort Order</label>
        <input type="number" value={form.sort_order || 0} onChange={e => set('sort_order', e.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={form.is_active !== false} onChange={e => set('is_active', e.target.checked)} /> Active
        </label>
      </div>
      {msg && <p className="okmsg">{msg}</p>}
      <div className="formbar">
        <button className="btn dark" onClick={save}>Save</button>
        <button className="btn" onClick={() => setForm(null)}>Cancel</button>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>Categories</h1>
        <button className="btn dark" onClick={() => setForm({ name: '', slug: '', sort_order: 0, is_active: true })}>+ New</button>
      </div>
      {loading ? <p className="muted">Loading…</p> : (
        <div className="plist">
          {categories.map(c => (
            <div key={c.id} className="pitem">
              <div>
                <strong>{c.name}</strong>
                <p className="meta">/{c.slug} · Order: {c.sort_order}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn small" onClick={() => setForm(c)}>Edit</button>
                <button className="btn small danger" onClick={() => deleteCategory(c.id)}>Delete</button>
              </div>
            </div>
          ))}
          {categories.length === 0 && <p className="muted">No categories.</p>}
        </div>
      )}
    </AdminLayout>
  );
      }
