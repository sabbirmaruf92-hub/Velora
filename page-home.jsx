import React, { useEffect, useState } from 'react';
import { supabase, money, useSettings, Reveal } from './app-core.jsx';

export const route = '/';

function firstImage(p) {
  const imgs = [...(p.product_images || [])].sort((a, b) => a.sort_order - b.sort_order);
  return imgs.length ? imgs[0].url : '';
}

function ProductCard({ p }) {
  const img = firstImage(p);
  const onSale = p.sale_price !== null && p.sale_price < p.price;
  return (
    <a className="card" href={'#/product/' + p.slug}>
      <div className="card-img">
        {img ? <img src={img} alt={p.name} loading="lazy" /> : <div className="card-noimg" />}
        {p.label && <span className="tag">{p.label}</span>}
      </div>
      <p className="card-name">{p.name}</p>
      <p className="card-price">
        {onSale ? (
          <>
            <strong>{money(p.sale_price)}</strong> <s>{money(p.price)}</s>
          </>
        ) : (
          <strong>{money(p.price)}</strong>
        )}
      </p>
    </a>
  );
}

export default function Home() {
  const settings = useSettings();
  const [cats, setCats] = useState(null);
  const [featured, setFeatured] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await supabase
        .from('categories')
        .select('id,name,slug')
        .eq('is_active', true)
        .order('sort_order');
      const f = await supabase
        .from('products')
        .select('id,name,slug,price,sale_price,label,product_images(url,sort_order)')
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(8);
      if (!alive) return;
      if (c.error || f.error) setError('Could not load the store data. Please refresh the page.');
      setCats(c.data || []);
      setFeatured(f.data || []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page">
      <section className="hero">
        <p className="hero-kicker">New collection</p>
        <h1 className="hero-title">Your style, your choice</h1>
        <p className="hero-sub">Women's fashion, accessories and matching couple outfits from {settings.brand_name}.</p>
        <a className="btn dark" href="#/shop">Shop now</a>
      </section>

      {error && <p className="notice" role="alert">{error}</p>}

      <Reveal>
        <h2 className="h2">Shop by category</h2>
        {cats === null ? (
          <p className="muted">Loading...</p>
        ) : (
          <div className="chips">
            {cats.map((c) => (
              <a key={c.id} className="chip" href={'#/shop?cat=' + c.slug}>{c.name}</a>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal>
        <h2 className="h2">Featured</h2>
        {featured === null ? (
          <p className="muted">Loading...</p>
        ) : featured.length === 0 ? (
          <p className="muted">Products will appear here once they are added in the admin panel.</p>
        ) : (
          <div className="grid">
            {featured.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </Reveal>
    </div>
  );
}
