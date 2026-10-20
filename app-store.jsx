import React from 'react';
import { supabase, money } from './app-core.jsx';

// ---------- shared product helpers ----------
export function firstImage(p) {
  const imgs = [...(p.product_images || [])].sort((a, b) => a.sort_order - b.sort_order);
  return imgs.length ? imgs[0].url : '';
}

// Same rule the server uses: variant price, else sale price (if lower), else normal price.
export function unitPrice(variantPrice, p) {
  if (variantPrice !== null && variantPrice !== undefined) return Number(variantPrice);
  if (p.sale_price !== null && p.sale_price !== undefined && Number(p.sale_price) < Number(p.price)) return Number(p.sale_price);
  return Number(p.price);
}

export function ProductCard({ p }) {
  const img = firstImage(p);
  const onSale = p.sale_price !== null && Number(p.sale_price) < Number(p.price);
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

// ---------- cart (database when logged in, this phone when not) ----------
const LS_KEY = 'velora_cart';
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());
export function onCartChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}
function writeLocal(items) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch (e) { /* storage can be blocked; cart then lasts only for this visit */ }
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session ? data.session.user.id : null;
}

async function ensureCart(uid) {
  const { data } = await supabase.from('carts').select('id').eq('user_id', uid).maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await supabase.from('carts').insert({ user_id: uid }).select('id').single();
  if (error) throw error;
  return created.id;
}

async function upsertDb(cartId, variantId, qty, add) {
  const { data: ex } = await supabase.from('cart_items').select('id,qty').eq('cart_id', cartId).eq('variant_id', variantId).maybeSingle();
  if (ex) {
    const { error } = await supabase.from('cart_items').update({ qty: add ? ex.qty + qty : qty }).eq('id', ex.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('cart_items').insert({ cart_id: cartId, variant_id: variantId, qty });
    if (error) throw error;
  }
}

// Returns [{ variant_id, qty }]. After login, items saved on this phone are moved into the account cart.
export async function loadCartItems() {
  const uid = await currentUserId();
  if (!uid) return readLocal();
  const cartId = await ensureCart(uid);
  const local = readLocal();
  if (local.length) {
    for (const it of local) {
      try {
        await upsertDb(cartId, it.variant_id, it.qty, true);
      } catch (e) { /* skip items that no longer exist */ }
    }
    writeLocal([]);
  }
  const { data, error } = await supabase.from('cart_items').select('variant_id,qty').eq('cart_id', cartId);
  if (error) throw error;
  return data || [];
}

export async function addToCart(variantId, qty) {
  const q = Math.max(1, Math.min(20, Number(qty) || 1));
  const uid = await currentUserId();
  if (uid) {
    await upsertDb(await ensureCart(uid), variantId, q, true);
  } else {
    const items = readLocal();
    const ex = items.find((i) => i.variant_id === variantId);
    if (ex) ex.qty = Math.min(50, ex.qty + q);
    else items.push({ variant_id: variantId, qty: q });
    writeLocal(items);
  }
  emit();
}

export async function setCartQty(variantId, qty) {
  const q = Number(qty) || 0;
  if (q < 1) return removeFromCart(variantId);
  const uid = await currentUserId();
  if (uid) {
    await upsertDb(await ensureCart(uid), variantId, Math.min(50, q), false);
  } else {
    writeLocal(readLocal().map((i) => (i.variant_id === variantId ? { ...i, qty: Math.min(50, q) } : i)));
  }
  emit();
  return undefined;
}

export async function removeFromCart(variantId) {
  const uid = await currentUserId();
  if (uid) {
    const cartId = await ensureCart(uid);
    const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId).eq('variant_id', variantId);
    if (error) throw error;
  } else {
    writeLocal(readLocal().filter((i) => i.variant_id !== variantId));
  }
  emit();
}

// ---------- wishlist (needs an account) ----------
export async function getWishlistIds() {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data } = await supabase.from('wishlists').select('product_id').eq('user_id', uid);
  return (data || []).map((r) => r.product_id);
}

// returns 'login' (not logged in), 'added' or 'removed'
export async function toggleWishlist(productId) {
  const uid = await currentUserId();
  if (!uid) return 'login';
  const { data: ex } = await supabase.from('wishlists').select('product_id').eq('user_id', uid).eq('product_id', productId).maybeSingle();
  if (ex) {
    const { error } = await supabase.from('wishlists').delete().eq('user_id', uid).eq('product_id', productId);
    if (error) throw error;
    return 'removed';
  }
  const { error } = await supabase.from('wishlists').insert({ user_id: uid, product_id: productId });
  if (error) throw error;
  return 'added';
  }
