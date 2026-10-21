import React, { useEffect, useState } from 'react';
import { supabase, money, useSettings } from './app-core.jsx';
import { DIVISIONS, DISTRICTS, getUpazilas } from './data-areas.js';

export const route = '/account';

// Customers log in with their phone number and a password (no SMS needed).
// Behind the scenes the phone number becomes a private login name.
const PHONE = /^01[3-9][0-9]{8}$/;
const aliasEmail = (phone) => phone + '@phone.velora.app';

const STATUS = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered',
  cancelled: 'Cancelled', return_requested: 'Return requested', returned: 'Returned', refunded: 'Refunded',
};
const PAY = { unpaid: 'Unpaid', pending_verification: 'Verifying', paid: 'Paid', failed: 'Failed', refunded: 'Refunded' };
const STEPS = [['pending', 'Order placed'], ['confirmed', 'Confirmed'], ['processing', 'Processing'], ['shipped', 'Shipped'], ['delivered', 'Delivered']];
const EXTRA = ['cancelled', 'return_requested', 'returned', 'refunded'];
const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function useSession() {
  const [state, setState] = useState({ loading: true, session: null });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ loading: false, session: data.session }));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setState({ loading: false, session: s }));
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

function AuthForm() {
  const [mode, setMode] = useState('login');
  const [ident, setIdent] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function login(e) {
    e.preventDefault();
    setError('');
    const id = ident.trim().replace(/\s+/g, '');
    const loginEmail = id.includes('@') ? id : (PHONE.test(id) ? aliasEmail(id) : '');
    if (!loginEmail) { setError('Please enter your phone number like 01XXXXXXXXX.'); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setBusy(false);
    if (err) {
      setError(/confirm/i.test(err.message) ? 'This account is not ready yet. Please contact support.' : 'Login failed. Please check your phone number and password.');
    }
  }

  async function signup(e) {
    e.preventDefault();
    setError('');
    const ph = phone.trim().replace(/\s+/g, '');
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!PHONE.test(ph)) { setError('Please enter a valid Bangladesh phone number like 01XXXXXXXXX.'); return; }
    if (password.length < 6) { setError('Your password needs at least 6 characters.'); return; }
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: aliasEmail(ph), password,
      options: { data: { full_name: name.trim(), phone: ph, contact_email: email.trim() } },
    });
    setBusy(false);
    if (err) {
      setError(/registered|already|database error/i.test(err.message) ? 'This phone number already has an account. Please log in.' : err.message);
      return;
    }
    if (!data.session) setNote('Account created. Please log in with your phone number and password.');
    if (!data.session) setMode('login');
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', margin: '16px 0' }}>
        {[['login', 'Log in'], ['signup', 'Sign up']].map(([k, label]) => (
          <button key={k} onClick={() => { setMode(k); setError(''); }} style={{
            flex: 1, padding: '10px 0', background: 'none', border: 0, color: 'var(--black)', cursor: 'pointer', fontSize: 15,
            borderBottom: mode === k ? '2px solid var(--black)' : '2px solid transparent', fontWeight: mode === k ? 700 : 400,
          }}>{label}</button>
        ))}
      </div>
      {note && <p className="okmsg" role="status">{note}</p>}

      {mode === 'login' ? (
        <form className="login" onSubmit={login}>
          <h1 className="h1">Welcome back</h1>
          <label htmlFor="l-id">Phone number</label>
          <input id="l-id" inputMode="tel" autoComplete="username" value={ident} onChange={(e) => setIdent(e.target.value)} placeholder="01XXXXXXXXX" required />
          <label htmlFor="l-pw">Password</label>
          <input id="l-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="notice" role="alert">{error}</p>}
          <button className="btn dark" type="submit" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
          <p className="meta">Forgot your password? Contact us on the <a href="#/contact" style={{ textDecoration: 'underline' }}>Contact page</a> and we will reset it for you.</p>
        </form>
      ) : (
        <form className="login" onSubmit={signup}>
          <h1 className="h1">Create your account</h1>
          <label htmlFor="s-name">Full name</label>
          <input id="s-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          <label htmlFor="s-ph">Phone number</label>
          <input id="s-ph" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" autoComplete="tel" required />
          <label htmlFor="s-em">Email (optional)</label>
          <input id="s-em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <label htmlFor="s-pw">Password</label>
          <input id="s-pw" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          {error && <p className="notice" role="alert">{error}</p>}
          <button className="btn dark" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
        </form>
      )}
    </div>
  );
}

function AddressForm({ initial, userId, onDone }) {
  const [f, setF] = useState(initial || { label: '', recipient_name: '', phone: '', division: 'Dhaka', district: 'Dhaka', upazila: '', address_line: '', is_default: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setError('');
    if (!f.recipient_name.trim()) return setError('Please enter the recipient name.');
    if (!PHONE.test(f.phone)) return setError('Please enter a valid phone number.');
    if (!f.upazila) return setError('Please choose the upazila / thana.');
    if (!f.address_line.trim()) return setError('Please enter the house / road / area.');
    setBusy(true);
    const row = {
      label: f.label.trim() || null, recipient_name: f.recipient_name.trim(), phone: f.phone, division: f.division,
      district: f.district, upazila: f.upazila, address_line: f.address_line.trim(), is_default: f.is_default,
    };
    if (f.is_default) await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
    const res = f.id ? await supabase.from('addresses').update(row).eq('id', f.id) : await supabase.from('addresses').insert({ ...row, user_id: userId });
    setBusy(false);
    if (res.error) return setError(res.error.message);
    onDone();
    return undefined;
  }

  return (
    <div className="fsec" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div className="two">
        <div><label>Recipient name</label><input value={f.recipient_name} onChange={(e) => set('recipient_name', e.target.value)} /></div>
        <div><label>Phone</label><input inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="01XXXXXXXXX" /></div>
      </div>
      <div className="three">
        <div>
          <label>Division</label>
          <select value={f.division} onChange={(e) => { const d = e.target.value; setF((p) => ({ ...p, division: d, district: DISTRICTS[d][0], upazila: '' })); }}>
            {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label>District</label>
          <select value={f.district} onChange={(e) => setF((p) => ({ ...p, district: e.target.value, upazila: '' }))}>
            {(DISTRICTS[f.division] || []).map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label>Upazila / Thana</label>
          <select value={f.upazila} onChange={(e) => set('upazila', e.target.value)}>
            <option value="">-- Select --</option>
            {getUpazilas(f.district).map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <label>House / Road / Area</label>
      <input value={f.address_line} onChange={(e) => set('address_line', e.target.value)} />
      <label>Label (Home, Office)</label>
      <input value={f.label || ''} onChange={(e) => set('label', e.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={f.is_default} onChange={(e) => set('is_default', e.target.checked)} /> Use as my default address</label>
      {error && <p className="notice" role="alert" style={{ marginTop: 8 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn dark" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save address'}</button>
        <button className="btn" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function OrderModal({ order, userId, onClose }) {
  const settings = useSettings();
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [i, e, m] = await Promise.all([
      supabase.from('order_items').select('*').eq('order_id', order.id),
      supabase.from('order_events').select('status,created_at').eq('order_id', order.id).order('created_at'),
      supabase.from('support_messages').select('*').eq('user_id', userId).eq('order_id', order.id).order('created_at'),
    ]);
    setItems(i.data || []);
    setEvents(e.data || []);
    setMsgs(m.data || []);
  }
  useEffect(() => { load(); }, [order.id]);

  async function send() {
    if (!text.trim()) return;
    setError('');
    const { error: err } = await supabase.from('support_messages').insert({
      user_id: userId, order_id: order.id, message: '[Order ' + order.order_no + '] ' + text.trim(), from_admin: false,
    });
    if (err) { setError(err.message); return; }
    setText('');
    load();
  }

  function invoice() {
    const w = window.open('', '_blank');
    if (!w) { setError('Please allow pop-ups to open the invoice.'); return; }
    const rows = items.map((i) => '<tr><td>' + esc(i.product_name) + ' (' + esc(i.color) + ', ' + esc(i.size) + ')</td><td>' + i.qty + '</td><td>' + money(i.unit_price) + '</td><td>' + money(i.line_total) + '</td></tr>').join('');
    w.document.write('<html><head><title>Invoice ' + esc(order.order_no) + '</title><style>body{font-family:sans-serif;padding:24px;max-width:700px;margin:auto}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style></head><body>'
      + '<h2>' + esc(settings.brand_name) + '</h2><p>Invoice <strong>' + esc(order.order_no) + '</strong><br>' + new Date(order.placed_at).toLocaleString('en-GB') + '</p>'
      + '<p><strong>' + esc(order.customer_name) + '</strong><br>' + esc(order.customer_phone) + '<br>' + esc([order.address_line, order.upazila, order.district, order.division].join(', ')) + '</p>'
      + '<table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>' + rows + '</table>'
      + '<p>Subtotal: ' + money(order.subtotal) + '<br>Discount: ' + money(order.discount_total) + '<br>Delivery: ' + money(order.delivery_fee) + '<br><strong>Total: ' + money(order.total) + '</strong><br>Payment: ' + esc(order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method) + ' (' + esc(PAY[order.payment_status]) + ')</p>'
      + '<p style="color:#666;font-size:12px">Use Print, then Save as PDF to download.</p><script>window.onload=function(){window.print()}</script></body></html>');
    w.document.close();
  }

  const when = {};
  events.forEach((e) => { if (!when[e.status]) when[e.status] = e.created_at; });
  const extras = EXTRA.filter((s) => when[s]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, overflowY: 'auto' }}>
      <div style={{ background: 'var(--white)', maxWidth: 520, margin: '16px auto', borderRadius: 16, padding: 18 }}>
        <div className="row-head">
          <h2 className="h1" style={{ fontSize: 18, margin: 0 }}>{order.order_no}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn small" onClick={invoice}>Invoice</button>
            <button className="btn small" onClick={onClose}>Close</button>
          </div>
        </div>
        <p className="meta" style={{ margin: '0 0 10px' }}>Placed {new Date(order.placed_at).toLocaleString('en-GB')} · {order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method} · {PAY[order.payment_status]}</p>

        <div className="fsec">
          <h2>Progress</h2>
          {STEPS.map(([k, label]) => (
            <p key={k} style={{ margin: '0 0 6px', opacity: when[k] ? 1 : 0.4 }}>
              {when[k] ? '\u2713' : '\u25CB'} {label} {when[k] && <span className="meta">{new Date(when[k]).toLocaleDateString('en-GB')}</span>}
            </p>
          ))}
          {extras.map((k) => <p key={k} style={{ margin: '0 0 6px' }}><strong>{STATUS[k]}</strong> <span className="meta">{new Date(when[k]).toLocaleDateString('en-GB')}</span></p>)}
        </div>

        <div className="fsec">
          <h2>Items</h2>
          {items.map((i) => (
            <div key={i.id} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              {i.image_url && <img src={i.image_url} alt="" style={{ width: 50, height: 62, objectFit: 'cover', borderRadius: 6 }} />}
              <div style={{ flex: 1, fontSize: 14 }}>{i.product_name}<br /><span className="meta">{i.color} / {i.size} · {i.qty} x {money(i.unit_price)}</span></div>
              <strong>{money(i.line_total)}</strong>
            </div>
          ))}
          <p className="meta" style={{ margin: '6px 0 0' }}>Subtotal {money(order.subtotal)}{Number(order.discount_total) > 0 ? ' · Discount - ' + money(order.discount_total) : ''} · Delivery {money(order.delivery_fee)}</p>
          <p style={{ margin: '4px 0 0' }}><strong>Total {money(order.total)}</strong></p>
        </div>

        <div className="fsec">
          <h2>Delivery address</h2>
          <p style={{ margin: 0 }}>{order.customer_name} · {order.customer_phone}</p>
          <p className="meta" style={{ margin: '4px 0 0' }}>{order.address_line}, {order.upazila}, {order.district}, {order.division}</p>
        </div>

        <div className="fsec">
          <h2>Ask us about this order</h2>
          {msgs.map((m) => (
            <p key={m.id} style={{ margin: '0 0 6px', fontSize: 14, textAlign: m.from_admin ? 'left' : 'right' }}>
              <span className="badge">{m.from_admin ? 'Shop' : 'You'}</span> {m.message}
            </p>
          ))}
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your question" />
          {error && <p className="notice" role="alert" style={{ marginTop: 6 }}>{error}</p>}
          <button className="btn small" style={{ marginTop: 6 }} onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ profile, userId, onSaved }) {
  const [name, setName] = useState(profile.full_name || '');
  const [email, setEmail] = useState(profile.email || '');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null);

  async function saveProfile() {
    if (!name.trim()) { setMsg({ bad: true, text: 'Please enter your name.' }); return; }
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), email: email.trim() || null }).eq('id', userId);
    setMsg(error ? { bad: true, text: error.message } : { bad: false, text: 'Saved.' });
    if (!error) onSaved();
  }
  async function changePw() {
    if (pw.length < 6) { setMsg({ bad: true, text: 'Your password needs at least 6 characters.' }); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setMsg(error ? { bad: true, text: error.message } : { bad: false, text: 'Password changed.' });
    if (!error) setPw('');
  }

  return (
    <div>
      <div className="fsec">
        <label>Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label>Phone (this is your login, ask us to change it)</label>
        <input value={profile.phone || ''} readOnly style={{ background: 'var(--soft-pink)' }} />
        <label>Email (optional)</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn dark" style={{ marginTop: 10 }} onClick={saveProfile}>Save</button>
      </div>
      <div className="fsec">
        <h2>Change password</h2>
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
        <button className="btn" style={{ marginTop: 10 }} onClick={changePw}>Change password</button>
      </div>
      {msg && <p className={msg.bad ? 'notice' : 'okmsg'} role={msg.bad ? 'alert' : 'status'}>{msg.text}</p>}
    </div>
  );
}

function Account({ session }) {
  const userId = session.user.id;
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loy, setLoy] = useState(null);
  const [tab, setTab] = useState('orders');
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(null);

  async function loadAll() {
    const [p, o, a, l] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('orders').select('*').eq('user_id', userId).order('placed_at', { ascending: false }),
      supabase.from('addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false }),
      supabase.rpc('my_loyalty'),
    ]);
    setProfile(p.data || {});
    setOrders(o.data || []);
    setAddresses(a.data || []);
    setLoy(l.error ? null : l.data);
  }
  useEffect(() => { loadAll(); }, [userId]);

  async function removeAddress(id) {
    if (!window.confirm('Delete this address?')) return;
    await supabase.from('addresses').delete().eq('id', id);
    loadAll();
  }

  if (!profile || orders === null) return <div className="page center muted">Loading...</div>;

  const thr = loy ? Number(loy.threshold) : 0;
  const progress = loy ? Number(loy.progress_spend) : 0;
  const pct = thr > 0 ? Math.min(100, (progress / thr) * 100) : 0;

  return (
    <div className="page">
      <div className="row-head" style={{ marginTop: 16 }}>
        <h1 className="h1" style={{ margin: 0 }}>My account</h1>
        <button className="btn small" onClick={() => supabase.auth.signOut()}>Log out</button>
      </div>

      <div className="fsec">
        <strong>{profile.full_name || 'Customer'}</strong>
        <p className="meta" style={{ margin: '2px 0 0' }}>{profile.phone}{profile.email ? ' · ' + profile.email : ''}</p>
      </div>

      {loy && Number(loy.percent) > 0 && thr > 0 && (
        <div className="fsec">
          <h2>Loyalty reward</h2>
          <div style={{ background: 'var(--soft-pink)', borderRadius: 99, height: 10, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: 'var(--black)' }} />
          </div>
          <p style={{ margin: '6px 0 0' }}>{money(progress)} / {money(thr)} spent</p>
          {loy.available && <p className="okmsg" style={{ marginTop: 8 }}>You have a {loy.percent}% discount. It is applied automatically on your next order.</p>}
          {loy.expired && <p className="notice" style={{ marginTop: 8 }}>Your discount has expired.</p>}
          {!loy.available && !loy.expired && <p className="meta" style={{ margin: '4px 0 0' }}>Reach the goal on delivered orders to unlock {loy.percent}% off your next order.</p>}
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', margin: '12px 0' }}>
        {[['orders', 'Orders'], ['addresses', 'Addresses'], ['profile', 'Profile']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: '10px 0', background: 'none', border: 0, color: 'var(--black)', cursor: 'pointer', fontSize: 14,
            borderBottom: tab === k ? '2px solid var(--black)' : '2px solid transparent', fontWeight: tab === k ? 700 : 400,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="plist">
          {orders.map((o) => (
            <div key={o.id} className="pitem" style={{ cursor: 'pointer' }} onClick={() => setOpen(o)}>
              <div><strong>{o.order_no}</strong><p className="meta">{new Date(o.placed_at).toLocaleDateString('en-GB')}</p></div>
              <div style={{ textAlign: 'right' }}><div>{money(o.total)}</div><span className="badge">{STATUS[o.status]}</span></div>
            </div>
          ))}
          {orders.length === 0 && <p className="muted">No orders yet. <a href="#/shop" style={{ textDecoration: 'underline' }}>Start shopping</a></p>}
        </div>
      )}

      {tab === 'addresses' && (
        <div>
          {!edit && <button className="btn dark" style={{ marginBottom: 12 }} onClick={() => setEdit('new')}>+ Add address</button>}
          {edit && <AddressForm initial={edit === 'new' ? null : edit} userId={userId} onDone={() => { setEdit(null); loadAll(); }} />}
          <div className="plist">
            {addresses.map((a) => (
              <div key={a.id} className="pitem">
                <div>
                  <strong>{a.recipient_name}</strong> {a.label && <span className="badge">{a.label}</span>} {a.is_default && <span className="badge">Default</span>}
                  <p className="meta">{a.phone}</p>
                  <p className="meta">{a.address_line}, {a.upazila}, {a.district}, {a.division}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn small" onClick={() => setEdit(a)}>Edit</button>
                  <button className="btn small danger" onClick={() => removeAddress(a.id)}>Delete</button>
                </div>
              </div>
            ))}
            {addresses.length === 0 && !edit && <p className="muted">No saved addresses.</p>}
          </div>
        </div>
      )}

      {tab === 'profile' && <ProfileTab profile={profile} userId={userId} onSaved={loadAll} />}
      {open && <OrderModal order={open} userId={userId} onClose={() => setOpen(null)} />}
    </div>
  );
}

export default function AccountPage() {
  const { loading, session } = useSession();
  if (loading) return <div className="page center muted">Loading...</div>;
  if (!session) return <AuthForm />;
  return <Account session={session} />;
  }
