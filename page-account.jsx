import React, { useEffect, useState } from 'react';
import { supabase } from './app-core.jsx';

export const route = '/account';

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

function getUpazilas(district) {
  return UPAZILAS[district] || ['Sadar','Other'];
}

function useSession() {
  const [state, setState] = useState({ loading: true, session: null });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ loading: false, session: data.session }));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setState({ loading: false, session }));
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

// ── Login / Signup ──────────────────────────────────────────────
function AuthForm() {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  async function login(e) {
    e.preventDefault(); setError(''); setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError('Login failed. Please check your email and password.');
  }

  async function signup(e) {
    e.preventDefault(); setError(''); setBusy(true);
    if (!/^01[3-9][0-9]{8}$/.test(phone)) { setError('Please enter a valid Bangladesh phone number.'); setBusy(false); return; }
    const { error: err } = await supabase.auth.signUp({
  email: email.trim(),
  password,
  options: { data: { full_name: name, phone, contact_email: email.trim() } },
});
if (err) { setError(err.message); setBusy(false); return; }
    setBusy(false);
    setDone('Account created! Please check your email to confirm, then log in.');
  }

  if (done) return <div className="page center"><p className="okmsg">{done}</p><button className="btn" onClick={() => setDone('')}>Back to Login</button></div>;

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--line)' }}>
        {['login','signup'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 0', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--black)' : '2px solid transparent',
            fontWeight: tab === t ? 700 : 400, fontSize: 15, cursor: 'pointer',
          }}>{t === 'login' ? 'Login' : 'Sign Up'}</button>
        ))}
      </div>

      {tab === 'login' ? (
        <form className="login" onSubmit={login}>
          <h1 className="h1">Welcome back</h1>
          <label>Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
          <label>Password</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <p className="notice" role="alert">{error}</p>}
          <button className="btn dark" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      ) : (
        <form className="login" onSubmit={signup}>
          <h1 className="h1">Create account</h1>
          <label>Full Name</label>
          <input required value={name} onChange={e => setName(e.target.value)} />
          <label>Phone (01XXXXXXXXX)</label>
          <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
          <label>Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
          <label>Password</label>
          <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
          {error && <p className="notice" role="alert">{error}</p>}
          <button className="btn dark" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create Account'}</button>
        </form>
      )}
    </div>
  );
}

// ── Address Form ─────────────────────────────────────────────────
function AddressForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { label: '', recipient_name: '', phone: '', division: 'Dhaka', district: 'Dhaka', upazila: '', address_line: '', is_default: false });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fsec">
      <div className="two">
        <div><label>Recipient Name</label><input value={form.recipient_name} onChange={e => set('recipient_name', e.target.value)} /></div>
        <div><label>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="01XXXXXXXXX" /></div>
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
          <label>Upazila / Thana</label>
          <select value={form.upazila} onChange={e => set('upazila', e.target.value)}>
            <option value="">-- Select --</option>
            {getUpazilas(form.district).map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <label>House / Road / Area</label>
      <input value={form.address_line} onChange={e => set('address_line', e.target.value)} />
      <label>Label (e.g. Home, Office)</label>
      <input value={form.label} onChange={e => set('label', e.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)} /> Set as default
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn dark" onClick={() => onSave(form)}>Save Address</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Profile Page ─────────────────────────────────────────────────
function ProfilePage({ session }) {
  const userId = session.user.id;
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [tab, setTab] = useState('orders');
  const [editAddr, setEditAddr] = useState(null);
  const [addingAddr, setAddingAddr] = useState(false);
  const [loyalty, setLoyalty] = useState(null);
  const [loyaltySettings, setLoyaltySettings] = useState(null);

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => setProfile(data));
    supabase.from('orders').select('id,order_no,status,total,placed_at').eq('user_id', userId).order('placed_at', { ascending: false }).then(({ data }) => setOrders(data || []));
    supabase.from('addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false }).then(({ data }) => setAddresses(data || []));
    supabase.from('customer_loyalty').select('*').eq('user_id', userId).single().then(({ data }) => setLoyalty(data));
    supabase.from('store_settings').select('value').eq('key', 'loyalty').single().then(({ data }) => { if (data) setLoyaltySettings(data.value); });
  }, [userId]);

  async function saveAddress(form) {
    if (editAddr?.id) {
      await supabase.from('addresses').update(form).eq('id', editAddr.id);
    } else {
      await supabase.from('addresses').insert({ ...form, user_id: userId });
    }
    const { data } = await supabase.from('addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false });
    setAddresses(data || []); setEditAddr(null); setAddingAddr(false);
  }

  async function deleteAddress(id) {
    await supabase.from('addresses').delete().eq('id', id);
    setAddresses(a => a.filter(x => x.id !== id));
  }

  const STATUS_BN = { pending:'Pending',confirmed:'Confirmed',processing:'Processing',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled',return_requested:'Return Req.',returned:'Returned',refunded:'Refunded' };

  const spend = loyalty?.eligible_spend || 0;
  const threshold = loyaltySettings?.threshold || 50000;
  const discountPct = loyaltySettings?.discount_percent || 0;
  const progress = Math.min(100, (spend / threshold) * 100);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="h1">My Account</h1>
        <button className="btn small" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>

      {profile && (
        <div className="fsec">
          <p><strong>{profile.full_name}</strong></p>
          <p className="meta">{profile.phone} · {profile.email}</p>
        </div>
      )}

      {loyaltySettings && threshold > 0 && (
        <div className="fsec">
          <p style={{ fontSize: 14, marginBottom: 6 }}><strong>Loyalty Progress</strong></p>
          <div style={{ background: 'var(--soft-pink)', borderRadius: 99, height: 10, overflow: 'hidden' }}>
            <div style={{ width: progress + '%', height: '100%', background: 'var(--black)', borderRadius: 99, transition: 'width .4s' }} />
          </div>
          <p className="meta" style={{ marginTop: 6 }}>৳{spend.toLocaleString()} / ৳{threshold.toLocaleString()}
            {spend >= threshold && discountPct > 0 && <span className="badge" style={{ background: '#e7f4ea' }}>🎉 {discountPct}% discount unlocked!</span>}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--line)', marginBottom: 16 }}>
        {['orders','addresses'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 0', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--black)' : '2px solid transparent',
            fontWeight: tab === t ? 700 : 400, fontSize: 14, cursor: 'pointer',
          }}>{t === 'orders' ? 'My Orders' : 'Addresses'}</button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="plist">
          {orders.map(o => (
            <div key={o.id} className="pitem">
              <div>
                <strong>{o.order_no}</strong>
                <p className="meta">{new Date(o.placed_at).toLocaleDateString('bn-BD')}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>৳{Number(o.total).toLocaleString()}</div>
                <span className="badge">{STATUS_BN[o.status]}</span>
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="muted">No orders yet.</p>}
        </div>
      )}

      {tab === 'addresses' && (
        <div>
          {!addingAddr && !editAddr && (
            <button className="btn dark" style={{ marginBottom: 12 }} onClick={() => setAddingAddr(true)}>+ Add Address</button>
          )}
          {(addingAddr || editAddr) && (
            <AddressForm initial={editAddr} onSave={saveAddress} onCancel={() => { setAddingAddr(false); setEditAddr(null); }} />
          )}
          <div className="plist">
            {addresses.map(a => (
              <div key={a.id} className="pitem">
                <div>
                  <strong>{a.recipient_name}</strong> {a.label && <span className="badge">{a.label}</span>} {a.is_default && <span className="badge">Default</span>}
                  <p className="meta">{a.phone}</p>
                  <p className="meta">{a.division}, {a.district}, {a.upazila}</p>
                  <p className="meta">{a.address_line}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn small" onClick={() => setEditAddr(a)}>Edit</button>
                  <button className="btn small danger" onClick={() => deleteAddress(a.id)}>Delete</button>
                </div>
              </div>
            ))}
            {addresses.length === 0 && !addingAddr && <p className="muted">No saved addresses.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────
export default function AccountPage() {
  const { loading, session } = useSession();
  if (loading) return <div className="page center muted">Loading…</div>;
  if (!session) return <AuthForm />;
  return <ProfilePage session={session} />;
    }
