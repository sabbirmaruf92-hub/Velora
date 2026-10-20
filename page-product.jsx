import React, { useEffect, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { ProductCard, unitPrice, addToCart, toggleWishlist, getWishlistIds } from './app-store.jsx';

export const route = '/product/:slug';

const sameColor = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

export default function ProductPage({ params }) {
  const slug = params.slug;
  const [p, setP] = useState(undefined); // undefined = loading, null = not found
  const [related, setRelated] = useState([]);
  const [zones, setZones] = useState([]);
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [wished, setWished] = useState(false);

  useEffect(() => {
    let alive = true;
    setP(undefined);
    setSize('');
    setQty(1);
    setMsg(null);
    (async () => {
      const { data, error } = await supabase.from('products')
        .select('*, product_images(id,url,color,alt,sort_order), product_variants(id,color,size,size_order,price,stock_qty,image_id,is_active)')
        .eq('slug', slug).maybeSingle();
      if (!alive) return;
      if (error || !data) { setP(null); return; }
      data.product_images = [...data.product_images].sort((a, b) => a.sort_order - b.sort_order);
      data.product_variants = data.product_variants.filter((v) => v.is_active).sort((a, b) => a.size_order - b.size_order);
      setP(data);
      document.title = data.name;
      const withStock = data.product_variants.find((v) => v.stock_qty > 0) || data.product_variants[0];
      const firstColor = withStock ? withStock.color : '';
      setColor(firstColor);
      const i = data.product_images.findIndex((im) => sameColor(im.color, firstColor));
      setImgIdx(i >= 0 ? i : 0);

      const [z, w, r] = await Promise.all([
        supabase.from('delivery_zones').select('name,fee').eq('is_active', true).order('sort_order'),
        getWishlistIds(),
        data.category_id
          ? supabase.from('products').select('id,name,slug,price,sale_price,label,product_images(url,sort_order)')
            .eq('category_id', data.category_id).neq('id', data.id).limit(4)
          : Promise.resolve({ data: [] }),
      ]);
      if (!alive) return;
      setZones(z.data || []);
      setWished(w.includes(data.id));
      setRelated(r.data || []);
    })();
    return () => { alive = false; };
  }, [slug]);

  if (p === undefined) return <div className="page center muted">Loading...</div>;
  if (p === null) {
    return (
      <div className="page center">
        <h1 className="h1">Product not found</h1>
        <a className="btn" href="#/shop">Back to shop</a>
      </div>
    );
  }

  const variants = p.product_variants;
  const colors = [...new Set(variants.map((v) => v.color))];
  const sizesForColor = variants.filter((v) => v.color === color);
  const selected = variants.find((v) => v.color === color && v.size === size);
  const price = unitPrice(selected ? selected.price : null, p);
  const regular = Number(p.price);
  const onSale = price < regular;
  const stock = selected ? selected.stock_qty : 0;
  const soldOut = p.status === 'out_of_stock' || variants.every((v) => v.stock_qty === 0);
  const main = p.product_images[imgIdx] || p.product_images[0];

  function pickColor(c) {
    setColor(c);
    setSize('');
    setQty(1);
    setMsg(null);
    const i = p.product_images.findIndex((im) => sameColor(im.color, c));
    if (i >= 0) setImgIdx(i);
  }

  async function add(goCheckout) {
    setMsg(null);
    if (!selected) { setMsg({ bad: true, text: 'Please choose a size.' }); return; }
    if (selected.stock_qty < qty) { setMsg({ bad: true, text: 'Only ' + selected.stock_qty + ' left in this size.' }); return; }
    setBusy(true);
    try {
      await addToCart(selected.id, qty);
      if (goCheckout) { window.location.hash = '#/checkout'; return; }
      setMsg({ bad: false, text: 'Added to your cart.', link: true });
    } catch (e) {
      setMsg({ bad: true, text: 'Could not add to cart: ' + e.message });
    }
    setBusy(false);
  }

  async function wish() {
    try {
      const r = await toggleWishlist(p.id);
      if (r === 'login') { window.location.hash = '#/account'; return; }
      setWished(r === 'added');
    } catch (e) {
      setMsg({ bad: true, text: 'Could not update wishlist: ' + e.message });
    }
  }

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginTop: 16 }}>
        <div>
          <div className="card-img" style={{ aspectRatio: '3 / 4' }}>
            {main ? <img src={main.url} alt={main.alt || p.name} /> : <div className="card-noimg" />}
            {p.label && <span className="tag">{p.label}</span>}
          </div>
          {p.product_images.length > 1 && (
            <div className="chips" style={{ marginTop: 8 }}>
              {p.product_images.map((im, i) => (
                <button key={im.id} aria-label={'Photo ' + (i + 1)} onClick={() => { setImgIdx(i); if (im.color) { setColor(im.color); setSize(''); } }}
                  style={{ flex: '0 0 auto', width: 56, height: 72, padding: 0, borderRadius: 8, overflow: 'hidden', background: 'none', border: i === imgIdx ? '2px solid var(--black)' : '1px solid var(--line)' }}>
                  <img src={im.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="h1" style={{ marginBottom: 4 }}>{p.name}</h1>
          <p style={{ fontSize: 20, margin: '0 0 12px' }}>
            <strong>{money(price)}</strong> {onSale && <s className="muted" style={{ marginLeft: 6 }}>{money(regular)}</s>}
          </p>

          {colors.length > 0 && (
            <>
              <p className="muted" style={{ margin: '0 0 6px' }}>Colour / design: <strong style={{ color: 'var(--black)' }}>{color}</strong></p>
              <div className="chips" style={{ marginBottom: 12 }}>
                {colors.map((c) => {
                  const im = p.product_images.find((x) => sameColor(x.color, c));
                  return im ? (
                    <button key={c} aria-label={c} aria-pressed={c === color} onClick={() => pickColor(c)}
                      style={{ flex: '0 0 auto', width: 48, height: 60, padding: 0, borderRadius: 8, overflow: 'hidden', background: 'none', border: c === color ? '2px solid var(--black)' : '1px solid var(--line)' }}>
                      <img src={im.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ) : (
                    <button key={c} className="chip" aria-pressed={c === color} style={c === color ? { background: 'var(--black)', color: 'var(--white)' } : undefined} onClick={() => pickColor(c)}>{c}</button>
                  );
                })}
              </div>
            </>
          )}

          <p className="muted" style={{ margin: '0 0 6px' }}>Size</p>
          <div className="chips" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
            {sizesForColor.map((v) => {
              const out = v.stock_qty === 0;
              const on = v.size === size;
              return (
                <button key={v.id} className="chip" disabled={out} aria-pressed={on}
                  onClick={() => { setSize(v.size); setQty(1); setMsg(null); }}
                  style={{ ...(on ? { background: 'var(--black)', color: 'var(--white)' } : {}), ...(out ? { opacity: 0.4, textDecoration: 'line-through' } : {}) }}>
                  {v.size}
                </button>
              );
            })}
          </div>
          {selected && stock <= 5 && stock > 0 && <p className="muted" style={{ margin: '0 0 8px' }}>Only {stock} left</p>}

          {!soldOut && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className="muted">Quantity</span>
              <button className="btn small" aria-label="Decrease" onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
              <strong>{qty}</strong>
              <button className="btn small" aria-label="Increase" onClick={() => setQty(Math.min(selected ? Math.min(stock, 20) : 20, qty + 1))}>+</button>
            </div>
          )}

          {soldOut ? (
            <p className="notice">This product is out of stock.</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn dark" onClick={() => add(false)} disabled={busy}>Add to cart</button>
              <button className="btn" onClick={() => add(true)} disabled={busy}>Buy now</button>
              <button className="btn" aria-pressed={wished} onClick={wish}>{wished ? 'Saved' : 'Save for later'}</button>
            </div>
          )}
          {msg && (
            <p className={msg.bad ? 'notice' : 'okmsg'} role={msg.bad ? 'alert' : 'status'} style={{ marginTop: 10 }}>
              {msg.text} {msg.link && <a href="#/cart" style={{ textDecoration: 'underline' }}>View cart</a>}
            </p>
          )}

          <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, margin: '16px 0', fontSize: 14 }}>
            <strong>Delivery charge</strong> (Cash on Delivery)
            {zones.map((z) => <div key={z.name} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>{z.name}</span><span>{money(z.fee)}</span></div>)}
            {zones.length === 0 && <div className="muted">Shown at checkout.</div>}
          </div>

          {(p.description || p.material) && (
            <details open style={{ marginBottom: 8 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Details</summary>
              {p.description && <p style={{ whiteSpace: 'pre-wrap' }}>{p.description}</p>}
              {p.material && <p className="muted">Material: {p.material}</p>}
            </details>
          )}
          {p.care_instructions && <details style={{ marginBottom: 8 }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Care</summary><p style={{ whiteSpace: 'pre-wrap' }}>{p.care_instructions}</p></details>}
          {p.size_chart && <details style={{ marginBottom: 8 }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Size chart</summary><p style={{ whiteSpace: 'pre-wrap' }}>{p.size_chart}</p></details>}
          {p.return_policy && <details style={{ marginBottom: 8 }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Return policy</summary><p style={{ whiteSpace: 'pre-wrap' }}>{p.return_policy}</p></details>}
        </div>
      </div>

      {related.length > 0 && (
        <>
          <h2 className="h2">You may also like</h2>
          <div className="grid">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </>
      )}
    </div>
  );
              }
