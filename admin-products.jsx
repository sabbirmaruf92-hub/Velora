import React, { useEffect, useState } from 'react';
import { supabase } from './app-core.jsx';
import { AdminLayout, sizeOrder, compressImage } from './app-admin.jsx';

export const route = '/admin/products';
export const tab = { label: 'Products', order: 2 };

const STATUS_OPTS = ['active','draft','archived','out_of_stock'];
const LETTER_SIZES = ['XXS','XS','S','M','L','XL','XXL','XXXL','4XL','5XL','Free Size'];

function empty() {
  return {
    name: '', slug: '', description: '', category_id: '', sku: '',
    price: '', sale_price: '', label: '', material: '', care_instructions: '',
    size_chart: '', return_policy: '', status: 'draft', is_featured: false, is_couple_set: false,
    _images: [], _variants: [],
  };
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [imgUploading, setImgUploading] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('id,name,status,price,is_featured,category_id').order('created_at', { ascending: false }),
      supabase.from('categories').select('id,name').order('sort_order'),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openEdit(product) {
    const [{ data: imgs }, { data: variants }] = await Promise.all([
      supabase.from('product_images').select('*').eq('product_id', product.id).order('sort_order'),
      supabase.from('product_variants').select('*').eq('product_id', product.id).order('size_order'),
    ]);
    setForm({ ...product, _images: imgs || [], _variants: variants || [] });
  }

  function newProduct() { setForm(empty()); }

  function setField(k, v) {
    setForm(f => {
      const updated = { ...f, [k]: v };
      if (k === 'name' && !f.id) updated.slug = slugify(v);
      return updated;
    });
  }

  function addVariant() {
    setForm(f => ({
      ...f,
      _variants: [...f._variants, { _key: Date.now(), color: 'Default', size: 'Free Size', price: '', stock_qty: 0, is_active: true }],
    }));
  }

  function setVariant(idx, k, v) {
    setForm(f => {
      const vs = [...f._variants];
      vs[idx] = { ...vs[idx], [k]: v };
      if (k === 'size') vs[idx].size_order = sizeOrder(v);
      return { ...f, _variants: vs };
    });
  }

  function removeVariant(idx) {
    setForm(f => { const vs = [...f._variants]; vs.splice(idx, 1); return { ...f, _variants: vs }; });
  }

  async function uploadImage(file, color) {
    setImgUploading(true);
    try {
      const blob = await compressImage(file);
      const ext = 'jpg';
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
      setForm(f => ({
        ...f,
        _images: [...f._images, { _key: Date.now(), url: publicUrl, color: color || '', alt: '', sort_order: f._images.length }],
      }));
    } catch (e) {
      setMsg('Image upload failed: ' + e.message);
    }
    setImgUploading(false);
  }

  function removeImage(idx) {
    setForm(f => { const imgs = [...f._images]; imgs.splice(idx, 1); return { ...f, _images: imgs }; });
  }

  async function save() {
    if (!form.name || !form.price) { setMsg('Name and price are required.'); return; }
    setSaving(true); setMsg('');
    try {
      const payload = {
        name: form.name, slug: form.slug || slugify(form.name),
        description: form.description, category_id: form.category_id || null,
        sku: form.sku || null, price: Number(form.price),
        sale_price: form.sale_price ? Number(form.sale_price) : null,
        label: form.label || null, material: form.material || null,
        care_instructions: form.care_instructions || null,
        size_chart: form.size_chart || null, return_policy: form.return_policy || null,
        status: form.status, is_featured: form.is_featured, is_couple_set: form.is_couple_set,
      };
      let productId = form.id;
      if (productId) {
        await supabase.from('products').update(payload).eq('id', productId);
      } else {
        const { data } = await supabase.from('products').insert(payload).select('id').single();
        productId = data.id;
      }

      // Save images
      for (const img of form._images) {
        if (img.id) {
          await supabase.from('product_images').update({ color: img.color, alt: img.alt, sort_order: img.sort_order }).eq('id', img.id);
        } else {
          await supabase.from('product_images').insert({ product_id: productId, url: img.url, color: img.color, alt: img.alt || '', sort_order: img.sort_order });
        }
      }

      // Save variants
      for (const v of form._variants) {
        const vPayload = {
          product_id: productId, color: v.color, size: v.size,
          size_order: sizeOrder(v.size), price: v.price ? Number(v.price) : null,
          stock_qty: Number(v.stock_qty) || 0, is_active: v.is_active !== false,
        };
        if (v.id) {
          await supabase.from('product_variants').update(vPayload).eq('id', v.id);
        } else {
          await supabase.from('product_variants').insert(vPayload);
        }
      }

      setMsg('Saved!');
      load();
      setTimeout(() => { setForm(null); setMsg(''); }, 1200);
    } catch (e) {
      setMsg('Error: ' + e.message);
    }
    setSaving(false);
  }

  async function deleteProduct(id) {
    if (!window.confirm('Delete this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    load();
  }

  if (form) return (
    <AdminLayout>
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>{form.id ? 'Edit Product' : 'New Product'}</h1>
        <button className="btn small" onClick={() => setForm(null)}>Back</button>
      </div>

      <div className="fsec">
        <h2>Basic Info</h2>
        <label>Product Name *</label>
        <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Product name" />
        <label>Slug (URL)</label>
        <input value={form.slug} onChange={e => setField('slug', e.target.value)} />
        <div className="two">
          <div>
            <label>Selling Price (৳) *</label>
            <input type="number" value={form.price} onChange={e => setField('price', e.target.value)} />
          </div>
          <div>
            <label>Sale Price (৳)</label>
            <input type="number" value={form.sale_price} onChange={e => setField('sale_price', e.target.value)} />
          </div>
        </div>
        <div className="two">
          <div>
            <label>Category</label>
            <select value={form.category_id} onChange={e => setField('category_id', e.target.value)}>
              <option value="">-- Select --</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Status</label>
            <select value={form.status} onChange={e => setField('status', e.target.value)}>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <label>SKU</label>
        <input value={form.sku} onChange={e => setField('sku', e.target.value)} />
        <label>Sale Label (e.g. "20% off")</label>
        <input value={form.label} onChange={e => setField('label', e.target.value)} />
        <label>Description</label>
        <textarea value={form.description} onChange={e => setField('description', e.target.value)} />
        <label>Material</label>
        <input value={form.material} onChange={e => setField('material', e.target.value)} />
        <label>Care Instructions</label>
        <textarea value={form.care_instructions} onChange={e => setField('care_instructions', e.target.value)} />
        <label>Size Chart</label>
        <textarea value={form.size_chart} onChange={e => setField('size_chart', e.target.value)} />
        <label>Return Policy</label>
        <textarea value={form.return_policy} onChange={e => setField('return_policy', e.target.value)} />
        <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
          <label><input type="checkbox" checked={form.is_featured} onChange={e => setField('is_featured', e.target.checked)} /> Featured</label>
          <label><input type="checkbox" checked={form.is_couple_set} onChange={e => setField('is_couple_set', e.target.checked)} /> Couple Set</label>
        </div>
      </div>

      <div className="fsec">
        <h2>Images</h2>
        <div className="imgs">
          {form._images.map((img, i) => (
            <div key={img.id || img._key} className="imgcard">
              <img src={img.url} alt={img.alt} />
              <input placeholder="Color/Design" value={img.color} onChange={e => {
                const imgs = [...form._images]; imgs[i] = { ...imgs[i], color: e.target.value }; setForm(f => ({ ...f, _images: imgs }));
              }} />
              <button onClick={() => removeImage(i)}>🗑 Remove</button>
            </div>
          ))}
        </div>
        <label style={{ display: 'block', marginTop: 8 }}>
          Add Image
          <input type="file" accept="image/*" style={{ marginTop: 6 }} onChange={e => {
            if (e.target.files[0]) uploadImage(e.target.files[0], '');
          }} />
        </label>
        {imgUploading && <p className="muted">Uploading…</p>}
      </div>

      <div className="fsec">
        <div className="row-head">
          <h2>Variants (Color + Size)</h2>
          <button className="btn small" onClick={addVariant}>+ Add</button>
        </div>
        <div className="vhead">
          <div className="vrow">
            <span>Color / Design</span><span>Size</span><span>Price (৳)</span><span>Stock</span><span></span>
          </div>
        </div>
        {form._variants.map((v, i) => (
          <div key={v.id || v._key} className="vrow">
            <input value={v.color} onChange={e => setVariant(i, 'color', e.target.value)} placeholder="Default" />
            <input value={v.size} onChange={e => setVariant(i, 'size', e.target.value)} placeholder="Free Size" list="size-list" />
            <input type="number" value={v.price} onChange={e => setVariant(i, 'price', e.target.value)} placeholder="—" />
            <input type="number" value={v.stock_qty} onChange={e => setVariant(i, 'stock_qty', e.target.value)} min="0" />
            <button className="xbtn" onClick={() => removeVariant(i)}>×</button>
          </div>
        ))}
        <datalist id="size-list">
          {LETTER_SIZES.map(s => <option key={s} value={s} />)}
          {[28,30,32,34,36,38,40,42].map(n => <option key={n} value={String(n)} />)}
        </datalist>
        {form._variants.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No variants yet. Add at least one.</p>}
      </div>

      {msg && <p className={msg.startsWith('Error') ? 'notice' : 'okmsg'}>{msg}</p>}

      <div className="formbar">
        <button className="btn dark" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Product'}</button>
        <button className="btn" onClick={() => setForm(null)}>Cancel</button>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>Products</h1>
        <button className="btn dark" onClick={newProduct}>+ New Product</button>
      </div>
      {loading ? <p className="muted">Loading…</p> : (
        <div className="plist">
          {products.map(p => (
            <div key={p.id} className="pitem">
              <div>
                <strong>{p.name}</strong>
                <p className="meta">৳{Number(p.price).toLocaleString()} · <span className="badge">{p.status}</span></p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn small" onClick={() => openEdit(p)}>Edit</button>
                <button className="btn small danger" onClick={() => deleteProduct(p.id)}>Delete</button>
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="muted">No products yet.</p>}
        </div>
      )}
    </AdminLayout>
  );
    }
