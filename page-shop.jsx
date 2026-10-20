import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './app-core.jsx';
import { ProductCard } from './app-store.jsx';

export const route = '/shop';

function readQuery() {
  const h = window.location.hash;
  const i = h.indexOf('?');
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : '');
}

export default function Shop() {
  const initial = readQuery();
  const [products, setProducts] = useState(null);
  const [cats, setCats] = useState([]);
  const [error, setError] = useState('');
  const [cat, setCat] = useState(initial.get('cat') || '');
  const [q, setQ] = useState(initial.get('q') || '');
  const [sort, setSort] = useState('new');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, c] = await Promise.all([
        supabase.from('products')
          .select('id,name,slug,price,sale_price,label,status,category_id,created_at,product_images(url,sort_order),product_variants(color,size,size_order,stock_qty)')
          .order('created_at', { ascending: false }).limit(500),
        supabase.from('categories').select('id,name,slug').eq('is_active', true).order('sort_order'),
      ]);
      if (!alive) return;
      if (p.error || c.error) setError('Could not load products. Please refresh the page.');
      setProducts(p.data || []);
      setCats(c.data || []);
    })();
    return () => { alive = false; };
  }, []);

  // keep the address bar in sync so a filtered shop page can be shared
  useEffect(() => {
    const sp = new URLSearchParams();
    if (cat) sp.set('cat', cat);
    if (q.trim()) sp.set('q', q.trim());
    const qs = sp.toString();
    try {
      window.history.replaceState(null, '', '#/shop' + (qs ? '?' + qs : ''));
    } catch (e) { /* ignore */ }
  }, [cat, q]);

  const options = useMemo(() => {
    const sizes = new Map();
    const colors = new Set();
    (products || []).forEach((p) => (p.product_variants || []).forEach((v) => {
      sizes.set(v.size, v.size_order);
      colors.add(v.color);
    }));
    return {
      sizes: [...sizes.entries()].sort((a, b) => a[1] - b[1]).map((x) => x[0]),
      colors: [...colors].sort(),
    };
  }, [products]);

  const catId = (cats.find((c) => c.slug === cat) || {}).id;
  const text = q.trim().toLowerCase();

  let shown = (products || []).filter((p) => {
    if (cat && p.category_id !== catId) return false;
    if (text && !p.name.toLowerCase().includes(text)) return false;
    if (size || color) {
      const ok = (p.product_variants || []).some((v) => (!size || v.size === size) && (!color || v.color === color) && v.stock_qty > 0);
      if (!ok) return false;
    }
    return true;
  });
  const eff = (p) => (p.sale_price !== null && Number(p.sale_price) < Number(p.price) ? Number(p.sale_price) : Number(p.price));
  if (sort === 'low') shown = [...shown].sort((a, b) => eff(a) - eff(b));
  if (sort === 'high') shown = [...shown].sort((a, b) => eff(b) - eff(a));

  const activeFilters = (size ? 1 : 0) + (color ? 1 : 0);

  return (
    <div className="page">
      <h1 className="h1" style={{ marginTop: 16 }}>Shop</h1>

      <input
        type="search" placeholder="Search products" aria-label="Search products" value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', fontSize: 16, border: '1px solid var(--dusty-pink)', borderRadius: 8 }}
      />

      <div className="chips" style={{ marginTop: 12 }}>
        <button className="chip" style={cat === '' ? { background: 'var(--black)', color: 'var(--white)' } : undefined} onClick={() => setCat('')}>All</button>
        {cats.map((c) => (
          <button key={c.id} className="chip" style={cat === c.slug ? { background: 'var(--black)', color: 'var(--white)' } : undefined} onClick={() => setCat(c.slug)}>{c.name}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0', alignItems: 'center' }}>
        <button className="btn small" onClick={() => setShowFilters(!showFilters)}>Filters{activeFilters ? ' (' + activeFilters + ')' : ''}</button>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: '8px', fontSize: 14, borderRadius: 8, border: '1px solid var(--dusty-pink)', background: 'var(--white)' }}>
          <option value="new">Newest</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
        </select>
        <span className="muted" style={{ marginLeft: 'auto' }}>{products ? shown.length + ' items' : ''}</span>
      </div>

      {showFilters && (
        <div className="fsec" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <p className="muted" style={{ margin: '0 0 6px' }}>Size</p>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {options.sizes.map((s) => (
              <button key={s} className="chip" style={size === s ? { background: 'var(--black)', color: 'var(--white)' } : undefined} onClick={() => setSize(size === s ? '' : s)}>{s}</button>
            ))}
            {options.sizes.length === 0 && <span className="muted">No sizes yet</span>}
          </div>
          <p className="muted" style={{ margin: '12px 0 6px' }}>Colour</p>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {options.colors.map((c) => (
              <button key={c} className="chip" style={color === c ? { background: 'var(--black)', color: 'var(--white)' } : undefined} onClick={() => setColor(color === c ? '' : c)}>{c}</button>
            ))}
          </div>
          {activeFilters > 0 && <button className="btn small" style={{ marginTop: 12 }} onClick={() => { setSize(''); setColor(''); }}>Clear filters</button>}
        </div>
      )}

      {error && <p className="notice" role="alert">{error}</p>}
      {products === null ? <p className="muted">Loading...</p> : shown.length === 0 ? (
        <p className="muted">No products found{products.length === 0 ? '. Products will appear here once they are added in the admin panel.' : '. Try a different search or filter.'}</p>
      ) : (
        <div className="grid">{shown.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}
    </div>
  );
                          }
