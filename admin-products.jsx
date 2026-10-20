import React, { useEffect, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { AdminLayout, sizeOrder, compressImage } from './app-admin.jsx';

export const route = '/admin/products';
export const tab = { label: 'Products', order: 2 };

const STATUSES = [['active', 'Active'], ['draft', 'Draft'], ['archived', 'Archived'], ['out_of_stock', 'Out of stock']];
const SIZE_HINTS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', '40', '42', 'Free Size'];

const must = (res) => { if (res.error) throw new Error(res.error.message); return res.data; };
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const slugify = (s) => (s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'product');
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

const blankForm = () => ({
  name: '', category_id: '', price: '', sale_price: '', status: 'draft', sku: '', label: '',
  description: '', material: '', care_instructions: '', size_chart: '', return_policy: '',
  is_featured: false, is_couple_set: false, cost_price: '', packaging_cost: '', other_cost: '',
});

function ProductList({ onEdit, onNew }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const { data, error: err } = await supabase.from('products')
      .select('id,name,price,status,is_featured,product_variants(stock_qty)')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function remove(p) {
    if (!window.confirm('Delete "' + p.name + '"? This cannot be undone. To hide it instead, set its status to Archived.')) return;
    const { error: err } = await supabase.from('products').delete().eq('id', p.id);
    if (err) setError('Could not delete (it may have purchase records). Archive it instead. ' + err.message);
    load();
  }

  return (
    <>
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>Products</h1>
        <button className="btn dark" onClick={onNew}>+ New product</button>
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      {rows === null ? <p className="muted">Loading...</p> : (
        <div className="plist">
          {rows.map((p) => {
            const stock = (p.product_variants || []).reduce((s, v) => s + v.stock_qty, 0);
            return (
              <div key={p.id} className="pitem">
                <div>
                  <strong>{p.name}</strong> {p.is_featured && <span className="badge">Featured</span>}
                  <p className="meta">{money(p.price)} · <span className="badge">{p.status}</span> · {stock} in stock</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn small" onClick={() => onEdit(p.id)}>Edit</button>
                  <button className="btn small danger" onClick={() => remove(p)}>Delete</button>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <p className="muted">No products yet. Tap "New product" to add your first one.</p>}
        </div>
      )}
    </>
  );
}

function ProductForm({ id, onDone }) {
  const [f, setF] = useState(blankForm());
  const [cats, setCats] = useState([]);
  const [variants, setVariants] = useState([]);
  const [removedVariants, setRemovedVariants] = useState([]);
  const [images, setImages] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [genColors, setGenColors] = useState('');
  const [genSizes, setGenSizes] = useState('');
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const field = (k) => (e) => {
    const el = e.target;
    const val = el.type === 'checkbox' ? el.checked : el.value;
    setF((prev) => ({ ...prev, [k]: val }));
  };

  useEffect(() => {
    supabase.from('categories').select('id,name').order('sort_order').then(({ data }) => setCats(data || []));
    if (!id) {
      setVariants([{ key: 'v0', color: 'Default', size: 'Free Size', stock_qty: '0', price: '', fresh: true }]);
      return;
    }
    (async () => {
      try {
        const p = must(await supabase.from('products').select('*').eq('id', id).single());
        const c = (await supabase.from('product_costs').select('*').eq('product_id', id).maybeSingle()).data;
        const v = must(await supabase.from('product_variants').select('*').eq('product_id', id).order('color').order('size_order'));
        const im = must(await supabase.from('product_images').select('*').eq('product_id', id).order('sort_order'));
        setF({
          name: p.name, category_id: p.category_id || '', price: String(p.price), sale_price: p.sale_price === null ? '' : String(p.sale_price),
          status: p.status, sku: p.sku || '', label: p.label || '', description: p.description || '', material: p.material || '',
          care_instructions: p.care_instructions || '', size_chart: p.size_chart || '', return_policy: p.return_policy || '',
          is_featured: p.is_featured, is_couple_set: p.is_couple_set,
          cost_price: c ? String(c.cost_price) : '', packaging_cost: c ? String(c.packaging_cost) : '', other_cost: c ? String(c.other_cost) : '',
        });
        setVariants(v.map((x) => ({ key: x.id, id: x.id, color: x.color, size: x.size, stock_qty: String(x.stock_qty), price: x.price === null ? '' : String(x.price) })));
        setImages(im);
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, [id]);

  function updateVariant(i, k, val) {
    setVariants((vs) => vs.map((v, n) => (n === i ? { ...v, [k]: val } : v)));
  }
  function removeVariant(i) {
    setVariants((vs) => {
      const v = vs[i];
      if (v.id) setRemovedVariants((r) => [...r, v.id]);
      return vs.filter((_, n) => n !== i);
    });
  }
  function addVariantRow() {
    setVariants((vs) => [...vs, { key: 'n' + Date.now(), color: '', size: '', stock_qty: '0', price: '' }]);
  }
  function generate() {
    const colors = genColors.split(',').map((s) => s.trim()).filter(Boolean);
    const sizes = genSizes.split(',').map((s) => s.trim()).filter(Boolean);
    if (colors.length === 0) colors.push('Default');
    if (sizes.length === 0) sizes.push('Free Size');
    setVariants((prev) => {
      const have = new Set(prev.map((v) => (v.color + '|' + v.size).toLowerCase()));
      const add = [];
      colors.forEach((c) => sizes.forEach((s) => {
        if (!have.has((c + '|' + s).toLowerCase())) add.push({ key: 'g' + c + s + Date.now(), color: c, size: s, stock_qty: '0', price: '' });
      }));
      const onlyBlank = prev.length === 1 && prev[0].fresh && add.length > 0;
      return [...(onlyBlank ? [] : prev), ...add];
    });
  }

  function pickFiles(e) {
    const files = [...e.target.files];
    e.target.value = '';
    setNewImages((prev) => [...prev, ...files.map((file, i) => ({ key: Date.now() + '-' + i, file, preview: URL.createObjectURL(file), color: '' }))]);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!f.name.trim()) return setError('Please enter a product name.');
    const price = num(f.price);
    if (price === null || !(price >= 0)) return setError('Please enter a valid selling price.');
    const sale = num(f.sale_price);
    if (sale !== null && !(sale >= 0 && sale < price)) return setError('Sale price must be lower than the selling price.');
    const vs = variants.map((v) => ({ ...v, color: v.color.trim(), size: v.size.trim() }));
    if (vs.length === 0) return setError('Add at least one colour and size.');
    if (vs.some((v) => !v.color || !v.size)) return setError('Every variant needs a colour and a size.');
    if (vs.some((v) => !(Number(v.stock_qty) >= 0) || !Number.isInteger(Number(v.stock_qty)))) return setError('Stock must be a whole number, zero or more.');
    if (vs.some((v) => v.price !== '' && !(Number(v.price) >= 0))) return setError('A variant price is not valid.');
    const keys = vs.map((v) => (v.color + '|' + v.size).toLowerCase());
    if (new Set(keys).size !== keys.length) return setError('Two variants have the same colour and size.');

    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user ? u.user.id : null;
      const payload = {
        name: f.name.trim(), category_id: f.category_id || null, price, sale_price: sale,
        status: f.status, sku: f.sku.trim() || null, label: f.label.trim() || null,
        description: f.description.trim() || null, material: f.material.trim() || null,
        care_instructions: f.care_instructions.trim() || null, size_chart: f.size_chart.trim() || null,
        return_policy: f.return_policy.trim() || null, is_featured: f.is_featured, is_couple_set: f.is_couple_set,
      };
      let pid = id;
      if (id) {
        must(await supabase.from('products').update(payload).eq('id', id));
      } else {
        const row = must(await supabase.from('products')
          .insert({ ...payload, slug: slugify(f.name) + '-' + Math.random().toString(36).slice(2, 6) })
          .select('id').single());
        pid = row.id;
      }

      must(await supabase.from('product_costs').upsert({
        product_id: pid, cost_price: num(f.cost_price) || 0, packaging_cost: num(f.packaging_cost) || 0, other_cost: num(f.other_cost) || 0,
      }, { onConflict: 'product_id' }));

      // images removed by the admin
      for (const im of removedImages) {
        const marker = '/product-images/';
        const at = im.url.indexOf(marker);
        if (at >= 0) await supabase.storage.from('product-images').remove([decodeURIComponent(im.url.slice(at + marker.length))]);
        must(await supabase.from('product_images').delete().eq('id', im.id));
      }
      // colour labels changed on kept images
      for (const im of images) {
        must(await supabase.from('product_images').update({ color: (im.color || '').trim() || null }).eq('id', im.id));
      }
      // new photos
      let order = images.length;
      for (const n of newImages) {
        const blob = await compressImage(n.file);
        const path = pid + '/' + Date.now() + '-' + order + '.jpg';
        must(await supabase.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg' }));
        const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
        must(await supabase.from('product_images').insert({
          product_id: pid, color: n.color.trim() || null, url: pub.publicUrl, alt: payload.name, sort_order: order,
        }));
        order += 1;
      }

      // variants
      if (removedVariants.length) must(await supabase.from('product_variants').delete().in('id', removedVariants));
      const imgs = must(await supabase.from('product_images').select('id,color,sort_order').eq('product_id', pid).order('sort_order'));
      const imageFor = (c) => { const m = imgs.find((x) => sameText(x.color, c)); return m ? m.id : null; };
      for (const v of vs) {
        const row = {
          product_id: pid, color: v.color, size: v.size, size_order: sizeOrder(v.size),
          price: num(v.price), image_id: imageFor(v.color),
        };
        if (v.id) {
          must(await supabase.from('product_variants').update(row).eq('id', v.id));
        } else {
          const qty = Number(v.stock_qty);
          const created = must(await supabase.from('product_variants').insert({ ...row, stock_qty: qty }).select('id').single());
          if (qty > 0) {
            must(await supabase.from('inventory_movements').insert({ variant_id: created.id, change_qty: qty, reason: 'Initial stock', created_by: uid }));
          }
        }
      }
      onDone();
    } catch (err) {
      const m = String(err.message || err);
      setError(m.includes('duplicate') ? 'Two variants have the same colour and size, or the SKU is already used.' : m);
    }
    setSaving(false);
  }

  if (loading) return <p className="muted">Loading...</p>;

  const colorHints = [...new Set(variants.map((v) => v.color.trim()).filter(Boolean))];

  return (
    <form onSubmit={save}>
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>{id ? 'Edit product' : 'New product'}</h1>
        <button type="button" className="btn small" onClick={onDone}>Back</button>
      </div>

      <div className="fsec">
        <h2>Basic info</h2>
        <label>Product name *</label>
        <input value={f.name} onChange={field('name')} />
        <div className="two">
          <div><label>Selling price (BDT) *</label><input type="number" inputMode="decimal" min="0" value={f.price} onChange={field('price')} /></div>
          <div><label>Sale price (optional)</label><input type="number" inputMode="decimal" min="0" value={f.sale_price} onChange={field('sale_price')} /></div>
        </div>
        <div className="two">
          <div>
            <label>Category</label>
            <select value={f.category_id} onChange={field('category_id')}>
              <option value="">-- None --</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Status</label>
            <select value={f.status} onChange={field('status')}>
              {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        </div>
        <p className="meta" style={{ margin: '6px 0 0' }}>Only products with status Active can be bought. Draft products stay hidden.</p>
        <div className="two">
          <div><label>SKU (optional)</label><input value={f.sku} onChange={field('sku')} /></div>
          <div><label>Label (e.g. New, 20% off)</label><input value={f.label} onChange={field('label')} /></div>
        </div>
        <label>Description</label>
        <textarea value={f.description} onChange={field('description')} />
        <label>Material</label>
        <input value={f.material} onChange={field('material')} />
        <label>Care instructions</label>
        <textarea value={f.care_instructions} onChange={field('care_instructions')} />
        <label>Size chart</label>
        <textarea value={f.size_chart} onChange={field('size_chart')} />
        <label>Return policy</label>
        <textarea value={f.return_policy} onChange={field('return_policy')} />
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={f.is_featured} onChange={field('is_featured')} /> Featured on the home page</label>
          <label style={{ display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={f.is_couple_set} onChange={field('is_couple_set')} /> Couple set</label>
        </div>
      </div>

      <div className="fsec">
        <h2>Cost (private, customers never see this)</h2>
        <div className="three">
          <div><label>Purchase cost</label><input type="number" inputMode="decimal" min="0" value={f.cost_price} onChange={field('cost_price')} /></div>
          <div><label>Packaging per item</label><input type="number" inputMode="decimal" min="0" value={f.packaging_cost} onChange={field('packaging_cost')} /></div>
          <div><label>Other cost per item</label><input type="number" inputMode="decimal" min="0" value={f.other_cost} onChange={field('other_cost')} /></div>
        </div>
        <p className="meta" style={{ margin: '6px 0 0' }}>This is the starting cost. When you receive new stock in Inventory, the average cost is updated automatically.</p>
      </div>

      <div className="fsec">
        <h2>Photos</h2>
        <p className="meta" style={{ margin: 0 }}>Type the colour name under a photo so customers see that photo when they pick that colour. Photos are made smaller automatically.</p>
        <div className="imgs">
          {images.map((im, i) => (
            <div key={im.id} className="imgcard">
              <img src={im.url} alt="" />
              <input placeholder="Colour" list="colour-hints" value={im.color || ''} onChange={(e) => setImages((arr) => arr.map((x, n) => (n === i ? { ...x, color: e.target.value } : x)))} />
              <button type="button" onClick={() => { setRemovedImages((r) => [...r, im]); setImages((arr) => arr.filter((_, n) => n !== i)); }}>Remove</button>
            </div>
          ))}
          {newImages.map((n, i) => (
            <div key={n.key} className="imgcard">
              <img src={n.preview} alt="" />
              <input placeholder="Colour" list="colour-hints" value={n.color} onChange={(e) => setNewImages((arr) => arr.map((x, k) => (k === i ? { ...x, color: e.target.value } : x)))} />
              <button type="button" onClick={() => setNewImages((arr) => arr.filter((_, k) => k !== i))}>Remove</button>
            </div>
          ))}
        </div>
        <datalist id="colour-hints">{colorHints.map((c) => <option key={c} value={c} />)}</datalist>
        <input type="file" accept="image/*" multiple onChange={pickFiles} />
        <p className="meta" style={{ margin: '6px 0 0' }}>New photos upload when you tap Save product.</p>
      </div>

      <div className="fsec">
        <h2>Colours and sizes</h2>
        <p className="meta" style={{ margin: 0 }}>Quick add: type colours and sizes separated by commas, then tap Generate.</p>
        <div className="two">
          <div><label>Colours</label><input value={genColors} onChange={(e) => setGenColors(e.target.value)} placeholder="Pink, Black, Blue" /></div>
          <div><label>Sizes</label><input value={genSizes} onChange={(e) => setGenSizes(e.target.value)} placeholder="S, M, L, XL" list="size-hints" /></div>
        </div>
        <button type="button" className="btn small" style={{ margin: '8px 0 12px' }} onClick={generate}>Generate</button>
        <datalist id="size-hints">{SIZE_HINTS.map((s) => <option key={s} value={s} />)}</datalist>

        <div className="vhead"><div className="vrow"><span>Colour</span><span>Size</span><span>Stock</span><span>Own price</span><span /></div></div>
        {variants.map((v, i) => (
          <div key={v.key} className="vrow">
            <input value={v.color} onChange={(e) => updateVariant(i, 'color', e.target.value)} aria-label="Colour" />
            <input value={v.size} onChange={(e) => updateVariant(i, 'size', e.target.value)} list="size-hints" aria-label="Size" />
            {v.id
              ? <input value={v.stock_qty} readOnly aria-label="Stock (change it in Inventory)" title="Change stock in Inventory" style={{ background: 'var(--soft-pink)' }} />
              : <input type="number" min="0" value={v.stock_qty} onChange={(e) => updateVariant(i, 'stock_qty', e.target.value)} aria-label="Stock" />}
            <input type="number" inputMode="decimal" min="0" value={v.price} onChange={(e) => updateVariant(i, 'price', e.target.value)} placeholder="same" aria-label="Own price" />
            <button type="button" className="xbtn" aria-label="Remove variant" onClick={() => removeVariant(i)}>x</button>
          </div>
        ))}
        <button type="button" className="btn small" onClick={addVariantRow}>+ Add one row</button>
        <p className="meta" style={{ margin: '8px 0 0' }}>Stock of saved variants is changed in the Inventory tab, so every change has a reason and a record.</p>
      </div>

      {error && <p className="notice" role="alert">{error}</p>}
      <div className="formbar">
        <button className="btn dark" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save product'}</button>
        <button className="btn" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export default function AdminProducts() {
  const [view, setView] = useState({ mode: 'list' });
  return (
    <AdminLayout>
      {view.mode === 'list'
        ? <ProductList onNew={() => setView({ mode: 'form', id: null })} onEdit={(id) => setView({ mode: 'form', id })} />
        : <ProductForm key={view.id || 'new'} id={view.id} onDone={() => setView({ mode: 'list' })} />}
    </AdminLayout>
  );
                    }
