import React, { useEffect, useRef, useState } from 'react';
import { supabase, money, useSettings } from './app-core.jsx';

export const route = '/checkout';

const DIVISIONS = ['Dhaka', 'Chittagong', 'Rajshahi', 'Khulna', 'Barisal', 'Sylhet', 'Rangpur', 'Mymensingh'];
const DISTRICTS = {
  Dhaka: ['Dhaka', 'Gazipur', 'Narayanganj', 'Manikganj', 'Munshiganj', 'Narsingdi', 'Tangail', 'Kishoreganj', 'Faridpur', 'Gopalganj', 'Madaripur', 'Rajbari', 'Shariatpur'],
  Chittagong: ['Chittagong', "Cox's Bazar", 'Comilla', 'Brahmanbaria', 'Noakhali', 'Feni', 'Lakshmipur', 'Chandpur', 'Khagrachari', 'Rangamati', 'Bandarban'],
  Rajshahi: ['Rajshahi', 'Bogra', 'Pabna', 'Sirajganj', 'Natore', 'Naogaon', 'Chapai Nawabganj', 'Joypurhat'],
  Khulna: ['Khulna', 'Jessore', 'Satkhira', 'Bagerhat', 'Narail', 'Magura', 'Jhenaidah', 'Kushtia', 'Chuadanga', 'Meherpur'],
  Barisal: ['Barisal', 'Bhola', 'Patuakhali', 'Pirojpur', 'Jhalokati', 'Barguna'],
  Sylhet: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
  Rangpur: ['Rangpur', 'Dinajpur', 'Kurigram', 'Gaibandha', 'Nilphamari', 'Lalmonirhat', 'Thakurgaon', 'Panchagarh'],
  Mymensingh: ['Mymensingh', 'Netrokona', 'Jamalpur', 'Sherpur'],
};
const UPAZILAS = {
  Dhaka: ['Dhanmondi', 'Gulshan', 'Mirpur', 'Mohammadpur', 'Uttara', 'Motijheel', 'Tejgaon', 'Demra', 'Keraniganj', 'Savar', 'Dohar', 'Nawabganj'],
  Gazipur: ['Gazipur Sadar', 'Kaliakair', 'Kapasia', 'Sreepur', 'Kaliganj'],
  Narayanganj: ['Narayanganj Sadar', 'Araihazar', 'Bandar', 'Rupganj', 'Sonargaon'],
  Chittagong: ['Kotwali', 'Pahartali', 'Panchlaish', 'Bayazid', 'Chandgaon', 'Double Mooring', 'Halishahar', 'Khulshi', 'Karnaphuli', 'Anwara', 'Boalkhali', 'Chandanaish', 'Fatikchhari', 'Hathazari', 'Lohagara', 'Mirsharai', 'Patiya', 'Rangunia', 'Raozan', 'Sandwip', 'Satkania', 'Sitakunda'],
  "Cox's Bazar": ["Cox's Bazar Sadar", 'Chakaria', 'Kutubdia', 'Maheshkhali', 'Ramu', 'Teknaf', 'Ukhia', 'Pekua'],
};
const getUpazilas = (district) => UPAZILAS[district] || ['Sadar', 'Other'];

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
  const userId = session ? session.user.id : null;
  const keyRef = useRef('');

  const [cart, setCart] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '',
    division: 'Dhaka', district: 'Dhaka', upazila: '', address_line: '',
    customer_note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!userId) return;
    keyRef.current = userId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    supabase.from('addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false })
      .then(({ data }) => setAddresses(data || []));
    supabase.from('profiles').select('full_name,phone').eq('id', userId).maybeSingle().then(({ data }) => {
      if (data) setForm((f) => ({ ...f, customer_name: data.full_name || '', customer_phone: data.phone || '' }));
    });
    (async () => {
      const { data: c } = await supabase.from('carts').select('id').eq('user_id', userId).maybeSingle();
      if (!c) { setCart([]); return; }
      const { data: items } = await supabase.from('cart_items').select('variant_id,qty').eq('cart_id', c.id);
      setCart(items || []);
    })();
  }, [userId]);

  // Prices and delivery charge always come from the server.
  useEffect(() => {
    if (!cart) return;
    if (cart.length === 0) { setQuote(null); setQuoteError(''); return; }
    let alive = true;
    supabase.rpc('quote_order', {
      p_items: cart.map((i) => ({ variant_id: i.variant_id, qty: i.qty })),
      p_district: form.district,
    }).then(({ data, error: err }) => {
      if (!alive) return;
      if (err) { setQuote(null); setQuoteError(err.message); } else { setQuote(data); setQuoteError(''); }
    });
    return () => { alive = false; };
  }, [cart, form.district]);

  function loadAddress(a) {
    setForm((f) => ({
      ...f, customer_name: a.recipient_name, customer_phone: a.phone,
      division: a.division, district: a.district, upazila: a.upazila, address_line: a.address_line,
    }));
  }

  async function placeOrder() {
    if (!form.customer_name.trim() || !form.customer_phone) { setError('Please fill in your name and phone.'); return; }
    if (!/^01[3-9][0-9]{8}$/.test(form.customer_phone)) { setError('Please enter a valid Bangladesh phone number.'); return; }
    if (!form.upazila) { setError('Please select your upazila/thana.'); return; }
    if (!form.address_line.trim()) { setError('Please enter your house/road address.'); return; }
    if (!quote) { setError(quoteError || 'Your cart is empty.'); return; }

    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('place_order', {
      p_items: cart.map((i) => ({ variant_id: i.variant_id, qty: i.qty })),
      p_name: form.customer_name, p_phone: form.customer_phone,
      p_division: form.division, p_district: form.district, p_upazila: form.upazila,
      p_address: form.address_line, p_payment_method: 'cod',
      p_note: form.customer_note, p_key: keyRef.current,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setPlaced({
      order_no: data.order_no, total: data.total, delivery_fee: data.delivery_fee,
      lines: quote.lines, name: form.customer_name, phone: form.customer_phone,
      address: [form.address_line, form.upazila, form.district, form.division].join(', '),
    });
  }

  if (sLoad) return <div className="page center muted">Loading...</div>;

  if (!session) {
    return (
      <div className="page center">
        <h1 className="h1">Login required</h1>
        <p className="muted">Please log in to place an order.</p>
        <a className="btn dark" href="#/account">Log in / Sign up</a>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="page">
        <div className="center" style={{ paddingTop: 24 }}>
          <h1 className="h1">Order placed</h1>
          <p>Order number: <strong>{placed.order_no}</strong></p>
          <p className="muted">We will confirm your order shortly.</p>
        </div>
        <div className="fsec">
          <h2>Items</h2>
          {placed.lines.map((l) => (
            <div key={l.variant_id} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 14 }}>
              {l.image_url && <img src={l.image_url} alt="" style={{ width: 44, height: 56, objectFit: 'cover', borderRadius: 6 }} />}
              <div style={{ flex: 1 }}>{l.name} ({l.color}, {l.size}) x {l.qty}</div>
              <div>{money(l.line_total)}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>Delivery charge</span><span>{money(placed.delivery_fee)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6 }}><span>Total (Cash on Delivery)</span><span>{money(placed.total)}</span></div>
        </div>
        <div className="fsec">
          <h2>Delivery address</h2>
          <p style={{ margin: 0 }}>{placed.name} · {placed.phone}</p>
          <p className="meta" style={{ margin: '4px 0 0' }}>{placed.address}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a className="btn dark" href="#/">Continue shopping</a>
          <a className="btn" href="#/account">My orders</a>
        </div>
      </div>
    );
  }

  const lines = quote ? quote.lines : [];

  return (
    <div className="page">
      <h1 className="h1" style={{ marginBottom: 16 }}>Checkout</h1>

      {cart !== null && cart.length === 0 && (
        <div className="fsec">
          <p style={{ margin: 0 }}>Your cart is empty.</p>
          <a className="btn small" style={{ marginTop: 8 }} href="#/">Start shopping</a>
        </div>
      )}

      {addresses.length > 0 && (
        <div className="fsec">
          <h2>Saved addresses</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {addresses.map((a) => (
              <button key={a.id} className="btn small" onClick={() => loadAddress(a)} style={{ textAlign: 'left' }}>
                {a.recipient_name} · {a.district}, {a.upazila} {a.is_default ? '(Default)' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fsec">
        <h2>Delivery info</h2>
        <div className="two">
          <div><label>Full name *</label><input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} /></div>
          <div><label>Phone *</label><input inputMode="numeric" value={form.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} placeholder="01XXXXXXXXX" /></div>
        </div>
        <div className="three">
          <div>
            <label>Division</label>
            <select value={form.division} onChange={(e) => { const d = e.target.value; setForm((f) => ({ ...f, division: d, district: DISTRICTS[d][0], upazila: '' })); }}>
              {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label>District</label>
            <select value={form.district} onChange={(e) => { const d = e.target.value; setForm((f) => ({ ...f, district: d, upazila: '' })); }}>
              {(DISTRICTS[form.division] || []).map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label>Upazila / Thana *</label>
            <select value={form.upazila} onChange={(e) => set('upazila', e.target.value)}>
              <option value="">-- Select --</option>
              {getUpazilas(form.district).map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <label>House / Road / Area *</label>
        <input value={form.address_line} onChange={(e) => set('address_line', e.target.value)} placeholder="House no, road, area" />
        <label>Order note (optional)</label>
        <textarea value={form.customer_note} onChange={(e) => set('customer_note', e.target.value)} placeholder="Any special instructions?" />
      </div>

      <div className="fsec">
        <h2>Payment method</h2>
        <label style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
          <input type="radio" checked readOnly /> Cash on Delivery
        </label>
      </div>

      <div className="fsec">
        <h2>Order summary</h2>
        {lines.map((l) => (
          <div key={l.variant_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
            <span>{l.name} ({l.color}, {l.size}) x {l.qty}</span>
            <span>{money(l.line_total)}</span>
          </div>
        ))}
        {quoteError && <p className="notice" role="alert">{quoteError}</p>}
        {quote && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>Subtotal</span><span>{money(quote.subtotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>Delivery ({form.district})</span><span>{money(quote.delivery_fee)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6 }}><span>Total</span><span>{money(quote.total)}</span></div>
          </>
        )}
      </div>

      {error && <p className="notice" role="alert">{error}</p>}

      <div className="formbar">
        <button className="btn dark" style={{ flex: 1 }} onClick={placeOrder} disabled={busy || !quote}>
          {busy ? 'Placing order...' : quote ? 'Place order · ' + money(quote.total) : 'Place order'}
        </button>
      </div>
    </div>
  );
               }
