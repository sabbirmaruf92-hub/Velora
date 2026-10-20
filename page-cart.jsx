import React, { useEffect, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { loadCartItems, setCartQty, removeFromCart, onCartChange, unitPrice } from './app-store.jsx';

export const route = '/cart';

export default function CartPage() {
  const [items, setItems] = useState(null);
  const [details, setDetails] = useState({});
  const [zones, setZones] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const list = await loadCartItems();
      setItems(list);
      if (list.length === 0) { setDetails({}); return; }
      const { data: vs, error: e } = await supabase.from('product_variants')
        .select('id,color,size,price,stock_qty,image_id,product_id,is_active,products(name,slug,price,sale_price,status)')
        .in('id', list.map((i) => i.variant_id));
      if (e) throw e;
      const prodIds = [...new Set((vs || []).map((v) => v.product_id))];
      const { data: imgs } = prodIds.length
        ? await supabase.from('product_images').select('id,url,product_id,color,sort_order').in('product_id', prodIds).order('sort_order')
        : { data: [] };
      const map = {};
      (vs || []).forEach((v) => {
        const mine = (imgs || []).filter((im) => im.product_id === v.product_id);
        const img = mine.find((im) => im.id === v.image_id)
          || mine.find((im) => String(im.color || '').toLowerCase() === v.color.toLowerCase())
          || mine[0];
        map[v.id] = { ...v, image: img ? img.url : '' };
      });
      setDetails(map);
      setError('');
    } catch (e) {
      setError('Could not load your cart: ' + e.message);
    }
  }

  useEffect(() => {
    load();
    const off = onCartChange(load);
    supabase.from('delivery_zones').select('name,fee').eq('is_active', true).order('sort_order').then(({ data }) => setZones(data || []));
    return off;
  }, []);

  const lineFor = (it) => {
    const d = details[it.variant_id];
    if (!d || !d.is_active || !d.products || d.products.status !== 'active') return null;
    return { d, unit: unitPrice(d.price, d.products) };
  };

  let subtotal = 0;
  (items || []).forEach((it) => {
    const l = lineFor(it);
    if (l) subtotal += l.unit * it.qty;
  });
  const hasProblem = (items || []).some((it) => {
    const l = lineFor(it);
    return !l || l.d.stock_qty < it.qty;
  });

  async function change(it, q) {
    try { await setCartQty(it.variant_id, q); } catch (e) { setError(e.message); }
  }
  async function remove(it) {
    try { await removeFromCart(it.variant_id); } catch (e) { setError(e.message); }
  }

  if (items === null) return <div className="page center muted">Loading...</div>;

  if (items.length === 0) {
    return (
      <div className="page center">
        <h1 className="h1">Your cart is empty</h1>
        <a className="btn dark" href="#/shop">Start shopping</a>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="h1" style={{ marginTop: 16 }}>Cart</h1>
      {error && <p className="notice" role="alert">{error}</p>}

      <div className="plist">
        {items.map((it) => {
          const l = lineFor(it);
          if (!l) {
            return (
              <div key={it.variant_id} className="pitem">
                <span className="muted">This item is no longer available.</span>
                <button className="btn small danger" onClick={() => remove(it)}>Remove</button>
              </div>
            );
          }
          const { d, unit } = l;
          const short = d.stock_qty < it.qty;
          return (
            <div key={it.variant_id} className="pitem" style={{ alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {d.image ? <img src={d.image} alt="" style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 8 }} /> : <div style={{ width: 64, height: 80, borderRadius: 8, background: 'var(--dusty-pink)' }} />}
                <div>
                  <a href={'#/product/' + d.products.slug}><strong>{d.products.name}</strong></a>
                  <p className="meta">{d.color} / {d.size}</p>
                  <p className="meta">{money(unit)} each</p>
                  {short && <p className="meta" style={{ color: '#b3261e' }}>Only {d.stock_qty} left. Please lower the quantity.</p>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>{money(unit * it.qty)}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', margin: '8px 0' }}>
                  <button className="btn small" aria-label="Decrease" onClick={() => change(it, it.qty - 1)}>-</button>
                  <span>{it.qty}</span>
                  <button className="btn small" aria-label="Increase" disabled={it.qty >= d.stock_qty} onClick={() => change(it, it.qty + 1)}>+</button>
                </div>
                <button className="btn small danger" onClick={() => remove(it)}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fsec" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
        <p className="muted" style={{ margin: '8px 0 0' }}>Delivery charge:</p>
        {zones.map((z) => <div key={z.name} className="muted" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{z.name}</span><span>{money(z.fee)}</span></div>)}
        <p className="muted" style={{ margin: '8px 0 0' }}>The exact total is confirmed at checkout.</p>
      </div>

      <div className="formbar">
        <a className="btn dark" style={{ flex: 1, textAlign: 'center', pointerEvents: hasProblem ? 'none' : 'auto', opacity: hasProblem ? 0.5 : 1 }} href="#/checkout">Checkout</a>
      </div>
    </div>
  );
        }
