import React, { useEffect, useState } from 'react';
import { supabase } from './app-core.jsx';
import { ProductCard, toggleWishlist } from './app-store.jsx';

export const route = '/wishlist';

export default function WishlistPage() {
  const [state, setState] = useState({ loading: true, loggedIn: false, items: [] });

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { setState({ loading: false, loggedIn: false, items: [] }); return; }
    const { data } = await supabase.from('wishlists')
      .select('product_id, products(id,name,slug,price,sale_price,label,status,product_images(url,sort_order))')
      .order('created_at', { ascending: false });
    setState({ loading: false, loggedIn: true, items: (data || []).filter((r) => r.products) });
  }

  useEffect(() => { load(); }, []);

  async function remove(id) {
    await toggleWishlist(id);
    load();
  }

  if (state.loading) return <div className="page center muted">Loading...</div>;
  if (!state.loggedIn) {
    return (
      <div className="page center">
        <h1 className="h1">Wishlist</h1>
        <p className="muted">Please log in to see your saved products.</p>
        <a className="btn dark" href="#/account">Log in / Sign up</a>
      </div>
    );
  }
  return (
    <div className="page">
      <h1 className="h1" style={{ marginTop: 16 }}>Wishlist</h1>
      {state.items.length === 0 ? (
        <p className="muted">Nothing saved yet. <a href="#/shop" style={{ textDecoration: 'underline' }}>Browse the shop</a></p>
      ) : (
        <div className="grid">
          {state.items.map((r) => (
            <div key={r.product_id}>
              <ProductCard p={r.products} />
              <button className="btn small" style={{ marginTop: 6 }} onClick={() => remove(r.product_id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
