import React, { useEffect, useState } from 'react';
import { supabase, useSettings, Reveal } from './app-core.jsx';
import { ProductCard } from './app-store.jsx';

export const route = '/';

export default function Home() {
  const settings = useSettings();
  const [cats, setCats] = useState(null);
  const [featured, setFeatured] = useState(null);
  const [banners, setBanners] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, f, b] = await Promise.all([
        supabase.from('categories').select('id,name,slug').eq('is_active', true).order('sort_order'),
        supabase.from('products')
          .select('id,name,slug,price,sale_price,label,product_images(url,sort_order)')
          .eq('is_featured', true).order('created_at', { ascending: false }).limit(8),
        supabase.from('banners').select('id,image_url,title,link_url').eq('is_active', true).order('sort_order'),
      ]);
      if (!alive) return;
      if (c.error || f.error) setError('Could not load the store data. Please refresh the page.');
      setCats(c.data || []);
      setFeatured(f.data || []);
      setBanners(b.data || []);
    })();
    return () => { alive = false; };
  }, []);

  const hero = { kicker: 'New collection', title: 'Your style, your choice', subtitle: '', button: 'Shop now', image_url: '', ...(settings.hero || {}) };
  const sub = hero.subtitle || "Women's fashion, accessories and matching couple outfits from " + settings.brand_name + '.';

  return (
    <div className="page">
      <section className="hero">
        {hero.image_url && <img src={hero.image_url} alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 14, marginBottom: 16 }} />}
        <p className="hero-kicker">{hero.kicker}</p>
        <h1 className="hero-title">{hero.title}</h1>
        <p className="hero-sub">{sub}</p>
        <a className="btn dark" href="#/shop">{hero.button || 'Shop now'}</a>
      </section>

      {error && <p className="notice" role="alert">{error}</p>}

      {banners.length > 0 && (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', margin: '16px 0 0', paddingBottom: 6 }}>
          {banners.map((b) => {
            const img = <img src={b.image_url} alt={b.title || ''} loading="lazy" style={{ width: '100%', aspectRatio: '16 / 7', objectFit: 'cover', borderRadius: 12, display: 'block' }} />;
            return (
              <div key={b.id} style={{ flex: '0 0 88%', maxWidth: 520, scrollSnapAlign: 'start' }}>
                {b.link_url ? <a href={b.link_url}>{img}</a> : img}
              </div>
            );
          })}
        </div>
      )}

      <Reveal>
        <h2 className="h2">Shop by category</h2>
        {cats === null ? <p className="muted">Loading...</p> : (
          <div className="chips">
            {cats.map((c) => <a key={c.id} className="chip" href={'#/shop?cat=' + c.slug}>{c.name}</a>)}
          </div>
        )}
      </Reveal>

      <Reveal>
        <h2 className="h2">Featured</h2>
        {featured === null ? <p className="muted">Loading...</p> : featured.length === 0 ? (
          <p className="muted">Featured products will appear here. <a href="#/shop" style={{ textDecoration: 'underline' }}>Browse the shop</a></p>
        ) : (
          <div className="grid">{featured.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        )}
      </Reveal>
    </div>
  );
}
