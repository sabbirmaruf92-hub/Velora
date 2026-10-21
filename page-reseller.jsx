import React, { useEffect, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { ResellerPanel } from './app-reseller-panel.jsx';

export const route = '/reseller';

function useSession() {
  const [state, setState] = useState({ loading: true, session: null });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ loading: false, session: data.session }));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setState({ loading: false, session: s }));
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

function Apply({ userId, onSent }) {
  const [packages, setPackages] = useState(null);
  const [requests, setRequests] = useState([]);
  const [bkash, setBkash] = useState('');
  const [pkg, setPkg] = useState('');
  const [sender, setSender] = useState('');
  const [trx, setTrx] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function load() {
    const [p, r, s] = await Promise.all([
      supabase.from('reseller_packages').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('reseller_requests').select('id,status,note,created_at,trx_id,reseller_packages(name,price)').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('store_settings').select('value').eq('key', 'bkash_number').maybeSingle(),
    ]);
    setPackages(p.data || []);
    setRequests(r.data || []);
    setBkash(s.data && typeof s.data.value === 'string' ? s.data.value : '');
  }
  useEffect(() => { load(); }, [userId]);

  const waiting = requests.some((r) => r.status === 'pending');
  const chosen = (packages || []).find((p) => p.id === pkg);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setOk('');
    if (!pkg) { setError('Please choose a package.'); return; }
    setBusy(true);
    const { error: err } = await supabase.rpc('request_reseller', { p_package_id: pkg, p_sender: sender.trim(), p_trx: trx.trim() });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setOk('Request sent. We will check the payment in bKash and approve you soon.');
    setSender('');
    setTrx('');
    load();
    onSent();
  }

  return (
    <div className="page">
      <h1 className="h1" style={{ marginTop: 16 }}>Become a reseller</h1>
      <p className="muted">Buy a reseller package, get special reseller prices, and earn commission on every order you bring.</p>

      {packages === null ? <p className="muted">Loading...</p> : packages.length === 0 ? (
        <p className="notice">No reseller packages are available right now. Please check back soon.</p>
      ) : (
        <div className="plist" style={{ marginBottom: 16 }}>
          {packages.map((p) => (
            <label key={p.id} className="pitem" style={{ cursor: 'pointer', border: p.id === pkg ? '2px solid var(--black)' : undefined }}>
              <div>
                <strong>{p.name}</strong>
                {p.description && <p className="meta" style={{ whiteSpace: 'pre-wrap' }}>{p.description}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>{money(p.price)}</strong><br />
                <input type="radio" name="pkg" checked={p.id === pkg} onChange={() => setPkg(p.id)} aria-label={'Choose ' + p.name} />
              </div>
            </label>
          ))}
        </div>
      )}

      {packages && packages.length > 0 && (
        <form className="fsec" onSubmit={submit} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
          <h2>Pay with bKash</h2>
          {bkash ? (
            <ol style={{ paddingLeft: 18, margin: '0 0 8px', fontSize: 14 }}>
              <li>Open bKash and choose <strong>Send Money</strong> (not Payment or Cash Out).</li>
              <li>Send {chosen ? <strong>{money(chosen.price)}</strong> : 'the package price'} to <strong>{bkash}</strong>.</li>
              <li>Type the number you sent from, and the Transaction ID from bKash, below.</li>
            </ol>
          ) : (
            <p className="notice">The payment number is not set up yet. Please contact support before paying.</p>
          )}
          <label>bKash number you sent from</label>
          <input inputMode="numeric" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="01XXXXXXXXX" />
          <label>Transaction ID</label>
          <input value={trx} onChange={(e) => setTrx(e.target.value)} placeholder="e.g. 9A1B2C3D4E" autoCapitalize="characters" />
          {error && <p className="notice" role="alert" style={{ marginTop: 8 }}>{error}</p>}
          {ok && <p className="okmsg" role="status" style={{ marginTop: 8 }}>{ok}</p>}
          <button className="btn dark" type="submit" disabled={busy || waiting || !bkash} style={{ marginTop: 10 }}>
            {waiting ? 'Request waiting for approval' : busy ? 'Sending...' : 'Send request'}
          </button>
          <p className="meta" style={{ margin: '8px 0 0' }}>You become a reseller only after we check the money in bKash and approve your request.</p>
        </form>
      )}

      {requests.length > 0 && (
        <>
          <h2 className="h2">Your requests</h2>
          <div className="plist">
            {requests.map((r) => (
              <div key={r.id} className="pitem">
                <div>
                  <strong>{r.reseller_packages ? r.reseller_packages.name : 'Package'}</strong>
                  <p className="meta">Transaction ID {r.trx_id} · {new Date(r.created_at).toLocaleDateString('en-GB')}</p>
                  {r.note && <p className="meta">{r.note}</p>}
                </div>
                <span className="badge">{r.status === 'pending' ? 'Waiting' : r.status === 'approved' ? 'Approved' : 'Rejected'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ResellerPage() {
  const { loading, session } = useSession();
  const [state, setState] = useState({ loading: true, reseller: false });
  const userId = session ? session.user.id : null;

  async function check() {
    if (!userId) { setState({ loading: false, reseller: false }); return; }
    const { data } = await supabase.from('resellers').select('user_id,is_active').eq('user_id', userId).maybeSingle();
    setState({ loading: false, reseller: Boolean(data && data.is_active) });
  }
  useEffect(() => { check(); }, [userId]);

  if (loading || state.loading) return <div className="page center muted">Loading...</div>;

  if (!session) {
    return (
      <div className="page center">
        <h1 className="h1">Reseller program</h1>
        <p className="muted">Please log in to join or to open your reseller account.</p>
        <a className="btn dark" href="#/account">Log in / Sign up</a>
      </div>
    );
  }
  return state.reseller ? <ResellerPanel userId={userId} /> : <Apply userId={userId} onSent={check} />;
}
