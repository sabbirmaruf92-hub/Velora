import React, { useEffect, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin/resellers';
export const tab = { label: 'Resellers', order: 6 };

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.3;
    o.start();
    o.stop(ctx.currentTime + 0.3);
  } catch (e) { /* sound is optional */ }
}

function friendly(err) {
  const m = err.message || '';
  if (m.includes('does not exist') || m.includes('schema cache')) return 'Database function missing. Run the 04a and 04b SQL files first.';
  return m;
}

async function fetchProfiles(ids) {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return {};
  const { data } = await supabase.from('profiles').select('id,full_name,phone').in('id', uniq);
  const map = {};
  (data || []).forEach((p) => { map[p.id] = p; });
  return map;
}

const who = (profiles, id) => {
  const p = profiles[id];
  return p ? (p.full_name || 'No name') + (p.phone ? ' · ' + p.phone : '') : 'Unknown user';
};

function Requests({ reqs, profiles, onChange, setError }) {
  async function review(r, approve) {
    const msg = approve
      ? 'Approve? Check that ' + money(r.reseller_packages ? r.reseller_packages.price : 0) + ' arrived in bKash from ' + r.sender_number + ' with Transaction ID ' + r.trx_id + '.'
      : 'Reject this request?';
    if (!window.confirm(msg)) return;
    const { error } = await supabase.rpc('review_reseller_request', { p_request_id: r.id, p_approve: approve, p_note: null });
    if (error) setError(friendly(error));
    onChange();
  }
  return (
    <div className="plist">
      {reqs.map((r) => (
        <div key={r.id} className="pitem" style={{ alignItems: 'flex-start' }}>
          <div>
            <strong>{who(profiles, r.user_id)}</strong>
            <p className="meta">Package: {r.reseller_packages ? r.reseller_packages.name + ' (' + money(r.reseller_packages.price) + ')' : 'Deleted package'}</p>
            <p className="meta">bKash from {r.sender_number} · Transaction ID {r.trx_id}</p>
            <p className="meta">{new Date(r.created_at).toLocaleString('en-GB')}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            {r.status === 'pending' ? (
              <>
                <button className="btn small dark" onClick={() => review(r, true)}>Approve</button>
                <button className="btn small danger" onClick={() => review(r, false)}>Reject</button>
              </>
            ) : <span className="badge">{r.status}</span>}
          </div>
        </div>
      ))}
      {reqs.length === 0 && <p className="muted">No requests yet.</p>}
    </div>
  );
}

function Withdrawals({ wds, profiles, onChange, setError }) {
  async function review(w, pay) {
    const msg = pay
      ? 'Mark as paid? Only do this after you sent ' + money(w.amount) + ' to bKash ' + w.bkash_number + '.'
      : 'Reject and return ' + money(w.amount) + ' to the wallet?';
    if (!window.confirm(msg)) return;
    const { error } = await supabase.rpc('review_withdrawal', { p_id: w.id, p_pay: pay, p_note: null });
    if (error) setError(friendly(error));
    onChange();
  }
  return (
    <div className="plist">
      {wds.map((w) => (
        <div key={w.id} className="pitem" style={{ alignItems: 'flex-start' }}>
          <div>
            <strong>{money(w.amount)}</strong> <span className="badge">{w.status}</span>
            <p className="meta">{who(profiles, w.user_id)}</p>
            <p className="meta">Send to bKash {w.bkash_number}</p>
            <p className="meta">{new Date(w.created_at).toLocaleString('en-GB')}</p>
          </div>
          {w.status === 'pending' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn small dark" onClick={() => review(w, true)}>Mark paid</button>
              <button className="btn small danger" onClick={() => review(w, false)}>Reject</button>
            </div>
          )}
        </div>
      ))}
      {wds.length === 0 && <p className="muted">No withdrawal requests yet.</p>}
    </div>
  );
}

function ResellerList({ setError }) {
  const [rows, setRows] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [balances, setBalances] = useState({});

  async function load() {
    const [r, b] = await Promise.all([
      supabase.from('resellers').select('*, reseller_packages(name)').order('approved_at', { ascending: false }),
      supabase.from('wallet_balances').select('user_id,balance'),
    ]);
    if (r.error) setError(r.error.message);
    setRows(r.data || []);
    const map = {};
    (b.data || []).forEach((x) => { map[x.user_id] = Number(x.balance); });
    setBalances(map);
    setProfiles(await fetchProfiles((r.data || []).map((x) => x.user_id)));
  }
  useEffect(() => { load(); }, []);

  async function toggle(r) {
    const { error } = await supabase.from('resellers').update({ is_active: !r.is_active }).eq('user_id', r.user_id);
    if (error) setError(error.message);
    load();
  }

  if (rows === null) return <p className="muted">Loading...</p>;
  return (
    <div className="plist">
      {rows.map((r) => (
        <div key={r.user_id} className="pitem">
          <div>
            <strong>{who(profiles, r.user_id)}</strong>
            <p className="meta">{r.reseller_packages ? r.reseller_packages.name : 'No package'} · Wallet {money(balances[r.user_id] || 0)}</p>
          </div>
          <button className={'btn small' + (r.is_active ? '' : ' dark')} onClick={() => toggle(r)}>{r.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>
      ))}
      {rows.length === 0 && <p className="muted">No approved resellers yet.</p>}
    </div>
  );
}

function Packages({ setError }) {
  const [rows, setRows] = useState(null);

  async function load() {
    const { data, error } = await supabase.from('reseller_packages').select('*').order('sort_order');
    if (error) setError(error.message);
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  const edit = (i, k, v) => setRows((rs) => rs.map((r, n) => (n === i ? { ...r, [k]: v } : r)));

  async function save(r) {
    const price = Number(r.price);
    if (!r.name || !r.name.trim()) { setError('Package name is required.'); return; }
    if (!(price >= 0) || r.price === '') { setError('Enter a valid package price.'); return; }
    const payload = { name: r.name.trim(), price, description: r.description || null, is_active: r.is_active !== false, sort_order: Number(r.sort_order) || 0 };
    const res = r.id ? await supabase.from('reseller_packages').update(payload).eq('id', r.id) : await supabase.from('reseller_packages').insert(payload);
    if (res.error) setError(res.error.message); else setError('');
    load();
  }

  async function remove(r) {
    if (!r.id) { setRows((rs) => rs.filter((x) => x !== r)); return; }
    if (!window.confirm('Delete this package?')) return;
    const { error } = await supabase.from('reseller_packages').delete().eq('id', r.id);
    if (error) setError('Could not delete (it may have requests). Deactivate it instead.');
    load();
  }

  if (rows === null) return <p className="muted">Loading...</p>;
  return (
    <div>
      <button className="btn small" style={{ marginBottom: 10 }} onClick={() => setRows((rs) => [...rs, { name: '', price: '', description: '', is_active: true, sort_order: rs.length + 1 }])}>+ Add package</button>
      {rows.map((r, i) => (
        <div key={r.id || 'new' + i} className="fsec">
          <div className="two">
            <div><label>Name</label><input value={r.name} onChange={(e) => edit(i, 'name', e.target.value)} /></div>
            <div><label>Price (BDT)</label><input type="number" min="0" value={r.price} onChange={(e) => edit(i, 'price', e.target.value)} /></div>
          </div>
          <label>Description</label>
          <textarea value={r.description || ''} onChange={(e) => edit(i, 'description', e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" checked={r.is_active !== false} onChange={(e) => edit(i, 'is_active', e.target.checked)} /> Active
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn small dark" onClick={() => save(r)}>Save</button>
            <button className="btn small danger" onClick={() => remove(r)}>Delete</button>
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="muted">No packages yet.</p>}
    </div>
  );
}

function Prices({ setError }) {
  const [products, setProducts] = useState(null);
  const [vals, setVals] = useState({});
  const [saved, setSaved] = useState({});
  const [search, setSearch] = useState('');

  async function load() {
    const [p, r] = await Promise.all([
      supabase.from('products').select('id,name,price,status').order('name').limit(1000),
      supabase.from('product_reseller_prices').select('product_id,price'),
    ]);
    if (p.error) setError(p.error.message);
    setProducts(p.data || []);
    const map = {};
    (r.data || []).forEach((x) => { map[x.product_id] = String(x.price); });
    setVals(map);
    setSaved(map);
  }
  useEffect(() => { load(); }, []);

  async function save(p) {
    const raw = vals[p.id];
    if (raw === undefined || raw === '') {
      if (saved[p.id] === undefined) return;
      const { error } = await supabase.from('product_reseller_prices').delete().eq('product_id', p.id);
      if (error) setError(error.message);
      load();
      return;
    }
    const price = Number(raw);
    if (!(price >= 0)) { setError('Enter a valid price.'); return; }
    if (price > Number(p.price) && !window.confirm('This reseller price is higher than the public price. Save anyway?')) return;
    const { error } = await supabase.from('product_reseller_prices').upsert({ product_id: p.id, price }, { onConflict: 'product_id' });
    if (error) setError(error.message); else setError('');
    load();
  }

  if (products === null) return <p className="muted">Loading...</p>;
  const s = search.trim().toLowerCase();
  const shown = products.filter((p) => !s || p.name.toLowerCase().includes(s));
  return (
    <div>
      <p className="meta">Only approved resellers can see these prices. Leave empty and save to remove a price.</p>
      <input placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} style={{ margin: '8px 0 12px' }} />
      <div className="plist">
        {shown.map((p) => (
          <div key={p.id} className="pitem">
            <div>
              <strong>{p.name}</strong>
              <p className="meta">Public price {money(p.price)}</p>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" min="0" style={{ width: 100 }} placeholder="Reseller" value={vals[p.id] === undefined ? '' : vals[p.id]} onChange={(e) => setVals({ ...vals, [p.id]: e.target.value })} />
              <button className="btn small" onClick={() => save(p)}>Save</button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="muted">No products found.</p>}
      </div>
    </div>
  );
}

export default function AdminResellers() {
  const [view, setView] = useState('requests');
  const [reqs, setReqs] = useState([]);
  const [wds, setWds] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  async function loadQueues() {
    const [r, w] = await Promise.all([
      supabase.from('reseller_requests').select('*, reseller_packages(name,price)').order('created_at', { ascending: false }).limit(200),
      supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (r.error || w.error) setError((r.error || w.error).message);
    setReqs(r.data || []);
    setWds(w.data || []);
    setProfiles(await fetchProfiles([...(r.data || []).map((x) => x.user_id), ...(w.data || []).map((x) => x.user_id)]));
  }

  useEffect(() => { loadQueues(); }, []);

  useEffect(() => {
    const announce = (text) => {
      setToast(text);
      beep();
      loadQueues();
      setTimeout(() => setToast(''), 6000);
    };
    const ch = supabase
      .channel('admin-reseller-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reseller_requests' }, () => announce('New reseller request'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'withdrawal_requests' }, () => announce('New withdrawal request'))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const pendingReq = reqs.filter((r) => r.status === 'pending').length;
  const pendingWd = wds.filter((w) => w.status === 'pending').length;
  const views = [
    ['requests', 'Requests', pendingReq], ['withdrawals', 'Withdrawals', pendingWd],
    ['resellers', 'Resellers', 0], ['packages', 'Packages', 0], ['prices', 'Prices', 0],
  ];

  return (
    <AdminLayout>
      {toast && <p className="okmsg" role="status" style={{ position: 'sticky', top: 8, zIndex: 30 }}>{toast}</p>}
      <div className="row-head"><h1 className="h1" style={{ fontSize: 20 }}>Resellers</h1></div>
      <div className="admin-tabs" style={{ marginBottom: 14 }}>
        {views.map(([k, label, n]) => (
          <a key={k} href="#/admin/resellers" className={view === k ? 'on' : ''} onClick={(e) => { e.preventDefault(); setView(k); setError(''); }}>
            {label}{n > 0 ? ' (' + n + ')' : ''}
          </a>
        ))}
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      {view === 'requests' && <Requests reqs={reqs} profiles={profiles} onChange={loadQueues} setError={setError} />}
      {view === 'withdrawals' && <Withdrawals wds={wds} profiles={profiles} onChange={loadQueues} setError={setError} />}
      {view === 'resellers' && <ResellerList setError={setError} />}
      {view === 'packages' && <Packages setError={setError} />}
      {view === 'prices' && <Prices setError={setError} />}
    </AdminLayout>
  );
                                                  }
