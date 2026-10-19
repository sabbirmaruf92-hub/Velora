import React, { useEffect, useState } from 'react';
import { supabase, useSettings } from './app-core.jsx';

export const route = '/checkout';

const DIVISIONS = ['Dhaka','Chittagong','Rajshahi','Khulna','Barisal','Sylhet','Rangpur','Mymensingh'];
const DISTRICTS = {
  Dhaka: ['Dhaka','Gazipur','Narayanganj','Manikganj','Munshiganj','Narsingdi','Tangail','Kishoreganj','Faridpur','Gopalganj','Madaripur','Rajbari','Shariatpur'],
  Chittagong: ['Chittagong','Cox\'s Bazar','Comilla','Brahmanbaria','Noakhali','Feni','Lakshmipur','Chandpur','Khagrachari','Rangamati','Bandarban'],
  Rajshahi: ['Rajshahi','Bogra','Pabna','Sirajganj','Natore','Naogaon','Chapai Nawabganj','Joypurhat'],
  Khulna: ['Khulna','Jessore','Satkhira','Bagerhat','Narail','Magura','Jhenaidah','Kushtia','Chuadanga','Meherpur'],
  Barisal: ['Barisal','Bhola','Patuakhali','Pirojpur','Jhalokati','Barguna'],
  Sylhet: ['Sylhet','Moulvibazar','Habiganj','Sunamganj'],
  Rangpur: ['Rangpur','Dinajpur','Kurigram','Gaibandha','Nilphamari','Lalmonirhat','Thakurgaon','Panchagarh'],
  Mymensingh: ['Mymensingh','Netrokona','Jamalpur','Sherpur'],
};
const UPAZILAS = {
  Dhaka: ['Dhanmondi','Gulshan','Mirpur','Mohammadpur','Uttara','Motijheel','Tejgaon','Demra','Keraniganj','Savar','Dohar','Nawabganj'],
  Gazipur: ['Gazipur Sadar','Kaliakair','Kapasia','Sreepur','Kaliganj'],
  Narayanganj: ['Narayanganj Sadar','Araihazar','Bandar','Rupganj','Sonargaon'],
  Chittagong: ['Kotwali','Pahartali','Panchlaish','Bayazid','Chandgaon','Double Mooring','Halishahar','Khulshi','Karnaphuli','Anwara','Boalkhali','Chandanaish','Fatikchhari','Hathazari','Lohagara','Mirsharai','Patiya','Rangunia','Raozan','Sandwip','Satkania','Sitakunda'],
  'Cox\'s Bazar': ['Cox\'s Bazar Sadar','Chakaria','Kutubdia','Maheshkhali','Ramu','Teknaf','Ukhia','Pekua'],
};
function getUpazilas(district) { return UPAZILAS[district] || ['Sadar','Other']; }

function useSession() {
  const [state, setState] = useState({ loading: true, session: null });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ loading: false, session: data.session }));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setState({ loading: false, session: s }));
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

export default function CheckoutPage() {
  const { loading: sLoad, session } = useSession();
  const settings = useSettings();
  const requireLogin = settings.require_login_for_checkout !== false;

  const [cartItems, setCartItems] = useState([]);
  const [zones, setZones] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '',
    division: 'Dhaka', district: 'Dhaka', upazila: '', address_line: '',
    payment_method: 'cod', customer_note: '',
  });
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    supabase.from('delivery_zones').select('*').eq('is_active', true).order('sort_order').then(({ data }) => setZones(data || []));
    if (session) {
      supabase.from('addresses').select('*').eq('user_id', session.user.id).order('is_default', { ascending: false }).then(({ data }) => setAddresses(data || []));
      supabase.from('profiles').select('full_name,phone').eq('id', session.user.id).single().then(({ data }) => {
        if (data) setForm(f => ({ ...f, customer_name: data.full_name || '', customer_phone: data.phone || '' }));
      });
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    supabase.from('carts').select('id').eq('user_id', session.user.id).single().then(async ({ data: cart }) => {
      if (!cart) return;
      const { data: items } = await supabase
        .from('cart_items')
        .select('qty,couple_details,product_variants(id,color,size,price,product_id,product_images(url),products(name,price,sale_price))')
        .eq('cart_id', cart.id);
      setCartItems(items || []);
    });
  }, [session]);

  useEffect(() => {
    const isDhaka = form.district === 'Dhaka';
    const zone = zones.find(z => (z.districts || []).includes(form.district)) || zones.find(z => isDhaka ? z.name.toLowerCase().includes('inside') : z.name.toLowerCase().includes('outside'));
    setDeliveryFee(zone ? Number(zone.fee) : (isDhaka ? 60 : 120));
  }, [form.district, zones]);

  function loadAddress(addr) {
    setForm(f => ({
      ...f,
      customer_name: addr.recipient_name,
      customer_phone: addr.phone,
      division: addr.division,
      district: addr.district,
      upazila: addr.upazila,
      address_line: addr.address_line,
    }));
  }

  function itemPrice(item) {
    const v = item.product_variants;
    const p = v.products;
    return Number(v.price || p?.sale_price || p?.price || 0);
  }

  const subtotal = cartItems.reduce((s, i) => s + itemPrice(i) * i.qty, 0);
  const total = subtotal + deliveryFee;

  async function placeOrder() {
    if (!form.customer_name || !form.customer_phone) { setError('Please fill in your name and phone.'); return; }
    if (!/^01[3-9][0-9]{8}$/.test(form.customer_phone)) { setError('Please enter a valid Bangladesh phone number.'); return; }
    if (!form.upazila) { setError('Please select your upazila/thana.'); return; }
    if (!form.address_line) { setError('Please enter your house/road address.'); return; }
    if (cartItems.length === 0) { setError('Your cart is empty.'); return; }

    setBusy(true); setError('');
    try {
      const idKey = `order-${session.user.id}-${Date.now()}`;
      const orderPayload = {
        user_id: session.user.id,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        division: form.division,
        district: form.district,
        upazila: form.upazila,
        address_line: form.address_line,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        payment_method: form.payment_method,
        customer_note: form.customer_note || null,
        idempotency_key: idKey,
      };

      const { data: order, error: oErr } = await supabase.from('orders').insert(orderPayload).select('id,order_no').single();
      if (oErr) throw oErr;

      const itemRows = cartItems.map(item => {
        const v = item.product_variants;
        const p = v.products;
        return {
          order_id: order.id,
          product_id: v.product_id,
          variant_id: v.id,
          product_name: p?.name || 'Product',
          color: v.color,
          size: v.size,
          image_url: v.product_images?.[0]?.url || null,
          qty: item.qty,
          unit_price: itemPrice(item),
          line_total: itemPrice(item) * item.qty,
          couple_details: item.couple_details || null,
        };
      });
      await supabase.from('order_items').insert(itemRows);

      // Reduce stock
      for (const item of cartItems) {
        const v = item.product_variants;
        await supabase.rpc('reduce_stock', { p_variant_id: v.id, p_qty: item.qty }).catch(() => {});
      }

      // Clear cart
      const { data: cart } = await supabase.from('carts').select('id').eq('user_id', session.user.id).single();
      if (cart) await supabase.from('cart_items').delete().eq('cart_id', cart.id);

      setPlaced(order);
    } catch (e) {
      setError('Order failed: ' + e.message);
    }
    setBusy(false);
  }

  if (sLoad) return <div className="page center muted">Loading…</div>;

  if (requireLogin && !session) return (
    <div className="page center">
      <h1 className="h1">Login Required</h1>
      <p className="muted">Please login to place an order.</p>
      <a className="btn dark" href="#/account">Login / Sign Up</a>
    </div>
  );

  if (placed) return (
    <div className="page center">
      <h1 className="h1" style={{ color: 'green' }}>✅ Order Placed!</h1>
      <p>Order number: <strong>{placed.order_no}</strong></p>
      <p className="muted">We will confirm your order shortly.</p>
      <p style={{ marginTop: 8 }}>Total: <strong>৳{total.toLocaleString()}</strong> (Cash on Delivery)</p>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a className="btn dark" href="#/">Continue Shopping</a>
        <a className="btn" href="#/account">My Orders</a>
      </div>
    </div>
  );

  return (
    <div className="page">
      <h1 className="h1" style={{ marginBottom: 16 }}>Checkout</h1>

      {addresses.length > 0 && (
        <div className="fsec">
          <h2>Saved Addresses</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {addresses.map(a => (
              <button key={a.id} className="btn small" onClick={() => loadAddress(a)} style={{ textAlign: 'left' }}>
                {a.recipient_name} · {a.district}, {a.upazila} {a.is_default ? '(Default)' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fsec">
        <h2>Delivery Info</h2>
        <div className="two">
          <div><label>Full Name *</label><input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} /></div>
          <div><label>Phone *</label><input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} placeholder="01XXXXXXXXX" /></div>
        </div>
        <div className="three">
          <div>
            <label>Division</label>
            <select value={form.division} onChange={e => { set('division', e.target.value); set('district', DISTRICTS[e.target.value]?.[0] || ''); set('upazila', ''); }}>
              {DIVISIONS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label>District</label>
            <select value={form.district} onChange={e => { set('district', e.target.value); set('upazila', ''); }}>
              {(DISTRICTS[form.division] || []).map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label>Upazila / Thana *</label>
            <select value={form.upazila} onChange={e => set('upazila', e.target.value)}>
              <option value="">-- Select --</option>
              {getUpazilas(form.district).map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <label>House / Road / Area *</label>
        <input value={form.address_line} onChange={e => set('address_line', e.target.value)} placeholder="House no, road, area" />
        <label>Order Note (optional)</label>
        <textarea value={form.customer_note} onChange={e => set('customer_note', e.target.value)} placeholder="Any special instructions?" />
      </div>

      <div className="fsec">
        <h2>Payment Method</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="radio" value="cod" checked={form.payment_method === 'cod'} onChange={() => set('payment_method', 'cod')} />
          Cash on Delivery (COD)
        </label>
      </div>

      <div className="fsec">
        <h2>Order Summary</h2>
        {cartItems.map((item, i) => {
          const v = item.product_variants;
          const p = v?.products;
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
              <span>{p?.name} ({v?.color}, {v?.size}) × {item.qty}</span>
              <span>৳{(itemPrice(item) * item.qty).toLocaleString()}</span>
            </div>
          );
        })}
        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>Subtotal</span><span>৳{subtotal.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>Delivery ({form.district})</span><span>৳{deliveryFee.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6 }}>
          <span>Total</span><span>৳{total.toLocaleString()}</span>
        </div>
      </div>

      {error && <p className="notice" role="alert">{error}</p>}

      <div className="formbar">
        <button className="btn dark" style={{ flex: 1 }} onClick={placeOrder} disabled={busy}>
          {busy ? 'Placing Order…' : `Place Order · ৳${total.toLocaleString()}`}
        </button>
      </div>
    </div>
  );
         }
