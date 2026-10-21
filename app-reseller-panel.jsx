import React, { useEffect, useRef, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { DIVISIONS, DISTRICTS, getUpazilas } from './data-areas.js';

const LEDGER = {
  commission: 'Commission', commission_reversal: 'Commission reversed', withdrawal_reserve: 'Withdrawal requested',
  withdrawal_release: 'Withdrawal returned', adjustment: 'Adjustment',
};
const STATUS = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered',
  cancelled: 'Cancelled', return_requested: 'Return requested', returned: 'Returned', refunded: 'Refunded',
};
const effPrice = (p) => (p.sale_price !== null && Number(p.sale_price) < Number(p.price) ? Number(p.sale_price) : Number(p.price));

function NewOrder({ onPlaced }) {
  const keyRef = useRef('rs-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  const [items, setItems] = useState(null);
  const [zones, setZones] = useState([]);
  const [search, setSearch] = useState('');
  const [pick, setPick] = useState(null);
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [sell, setSell] = useState('');
  const [basket, setBasket] = useState([]);
  const [cust, setCust] = useState({ name: '', phone: '', division: 'Dhaka', district: 'Dhaka', upazila: '', address: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      const [r, z] = await Promise.all([
        supabase.from('product_reseller_prices')
          .select('price, products(id,name,price,sale_price,status,product_images(url,sort_order),product_variants(id,color,size,size_order,stock_qty,is_active))'),
        supabase.from('delivery_zones').select('name,fee,districts').eq('is_active', true).order('sort_order'),
      ]);
      if (r.error) setError(r.error.message);
      setItems((r.data || []).filter((x) => x.products && x.products.status === 'active'));
      setZones(z.data || []);
    })();
  }, []);

  function choose(x) {
    const p = x.products;
    const vs = p.product_variants.filter((v) => v.is_active && v.stock_qty > 0);
    setPick(x);
    setColor(vs.length ? vs[0].color : '');
    setSize('');
    setQty(1);
    setSell(String(effPrice(p)));
    setError('');
  }

  function addLine() {
    const p = pick.products;
    const v = p.product_variants.find((x) => x.color === color && x.size === size);
    const price = Number(sell);
    if (!v) { setError('Please choose a size.'); return; }
    if (!(price >= Number(pick.price))) { setError('Your selling price cannot be below the reseller price (' + money(pick.price) + ').'); return; }
    if (qty < 1 || qty > v.stock_qty) { setError('Only ' + v.stock_qty + ' in stock.'); return; }
    setError('');
    setBasket((b) => {
      const same = b.find((l) => l.variant_id === v.id && l.sell === price);
      if (same) return b.map((l) => (l === same ? { ...l, qty: l.qty + qty } : l));
      return [...b, { variant_id: v.id, name: p.name, color: v.color, size: v.size, qty, sell: price, rp: Number(pick.price) }];
    });
    setPick(null);
  }

  const sub = basket.reduce((s, l) => s + l.sell * l.qty, 0);
  const commission = basket.reduce((s, l) => s + (l.sell - l.rp) * l.qty, 0);
  const zone = zones.find((z) => (z.districts || []).includes(cust.district))
    || zones.find((z) => z.name.toLowerCase().includes(cust.district === 'Dhaka' ? 'inside' : 'outside'));
  const fee = zone ? Number(zone.fee) : null;

  async function place() {
    setError('');
    if (basket.length === 0) { setError('Add at least one item.'); return; }
    if (!cust.name.trim()) { setError("Please enter your customer's name."); return; }
    if (!/^01[3-9][0-9]{8}$/.test(cust.phone)) { setError("Please enter a valid phone number for your customer."); return; }
    if (!cust.upazila || !cust.address.trim()) { setError('Please fill in the full delivery address.'); return; }
    setBusy(true);
    const { data, error: err } = await supabase.rpc('place_reseller_order', {
      p_items: basket.map((l) => ({ variant_id: l.variant_id, qty: l.qty, sell_price: l.sell })),
      p_name: cust.name, p_phone: cust.phone, p_division: cust.division, p_district: cust.district,
      p_upazila: cust.upazila, p_address: cust.address, p_note: cust.note, p_key: keyRef.current,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setDone(data);
    setBasket([]);
    onPlaced();
  }

  if (done) {
    return (
      <div className="center" style={{ paddingTop: 24 }}>
        <h2 className="h1">Order placed</h2>
        <p>Order number: <strong>{done.order_no}</strong></p>
        <p>Your customer pays <strong>{money(done.total)}</strong> on delivery.</p>
        <p className="muted">Your commission of {money(done.expected_commission)} is added to your wallet when the order is delivered.</p>
        <button className="btn dark" onClick={() => { setDone(null); keyRef.current = 'rs-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8); }}>New order</button>
      </div>
    );
  }

  const shown = (items || []).filter((x) => !search.trim() || x.products.name.toLowerCase().includes(search.trim().toLowerCase()));
  const pp = pick ? pick.products : null;
  const vs = pp ? pp.product_variants.filter((v) => v.is_active && v.stock_qty > 0).sort((a, b) => a.size_order - b.size_order) : [];
  const colors = [...new Set(vs.map((v) => v.color))];

  return (
    <div>
      {error && <p className="notice" role="alert">{error}</p>}

      <h2 className="h2" style={{ marginTop: 8 }}>1. Choose products</h2>
      <input placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
      {items === null ? <p className="muted">Loading...</p> : (
        <div className="plist" style={{ marginTop: 8 }}>
          {shown.map((x) => {
            const im = [...x.products.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
            return (
              <div key={x.products.id} className="pitem" style={{ cursor: 'pointer' }} onClick={() => choose(x)}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {im ? <img src={im.url} alt="" style={{ width: 44, height: 56, objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: 44, height: 56, borderRadius: 6, background: 'var(--dusty-pink)' }} />}
                  <div>
                    <strong>{x.products.name}</strong>
                    <p className="meta">Market price {money(effPrice(x.products))}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="meta" style={{ margin: 0 }}>Your price</p>
                  <strong>{money(x.price)}</strong>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && <p className="muted">{items.length === 0 ? 'No products have a reseller price yet.' : 'No products found.'}</p>}
        </div>
      )}

      {pick && (
        <div className="fsec" style={{ border: '1px solid var(--black)', borderRadius: 12, padding: 14, margin: '12px 0' }}>
          <div className="row-head" style={{ marginBottom: 6 }}>
            <strong>{pp.name}</strong>
            <button className="btn small" onClick={() => setPick(null)}>Close</button>
          </div>
          {vs.length === 0 ? <p className="muted">Out of stock.</p> : (
            <>
              <label>Colour / design</label>
              <select value={color} onChange={(e) => { setColor(e.target.value); setSize(''); }}>
                {colors.map((c) => <option key={c}>{c}</option>)}
              </select>
              <label>Size</label>
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="">-- Select --</option>
                {vs.filter((v) => v.color === color).map((v) => <option key={v.id} value={v.size}>{v.size} ({v.stock_qty} left)</option>)}
              </select>
              <div className="two">
                <div><label>Quantity</label><input type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} /></div>
                <div><label>Your selling price (each)</label><input type="number" inputMode="decimal" min="0" value={sell} onChange={(e) => setSell(e.target.value)} /></div>
              </div>
              <p className="meta" style={{ margin: '6px 0' }}>
                Reseller price {money(pick.price)} · Commission {money(Math.max(0, (Number(sell) - Number(pick.price)) * qty))}
              </p>
              <button className="btn dark" onClick={addLine}>Add to order</button>
            </>
          )}
        </div>
      )}

      <h2 className="h2">2. Your order</h2>
      {basket.length === 0 ? <p className="muted">Nothing added yet.</p> : (
        <div className="plist">
          {basket.map((l, i) => (
            <div key={l.variant_id + '-' + l.sell} className="pitem">
              <div>
                <strong>{l.name}</strong>
                <p className="meta">{l.color} / {l.size} · {l.qty} x {money(l.sell)}</p>
                <p className="meta">Commission {money((l.sell - l.rp) * l.qty)}</p>
              </div>
              <button className="btn small danger" onClick={() => setBasket((b) => b.filter((_, n) => n !== i))}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <h2 className="h2">3. Your customer</h2>
      <div className="fsec" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
        <div className="two">
          <div><label>Name</label><input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></div>
          <div><label>Phone</label><input inputMode="numeric" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} placeholder="01XXXXXXXXX" /></div>
        </div>
        <div className="three">
          <div>
            <label>Division</label>
            <select value={cust.division} onChange={(e) => { const d = e.target.value; setCust({ ...cust, division: d, district: DISTRICTS[d][0], upazila: '' }); }}>
              {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label>District</label>
            <select value={cust.district} onChange={(e) => setCust({ ...cust, district: e.target.value, upazila: '' })}>
              {(DISTRICTS[cust.division] || []).map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label>Upazila / Thana</label>
            <select value={cust.upazila} onChange={(e) => setCust({ ...cust, upazila: e.target.value })}>
              <option value="">-- Select --</option>
              {getUpazilas(cust.district).map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <label>House / Road / Area</label>
        <input value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} />
        <label>Note (optional)</label>
        <textarea value={cust.note} onChange={(e) => setCust({ ...cust, note: e.target.value })} />
      </div>

      <div className="fsec" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Items</span><span>{money(sub)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Delivery ({cust.district})</span><span>{fee === null ? 'Set at order' : money(fee)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Your customer pays</span><span>{money(sub + (fee || 0))}</span></div>
        <p style={{ margin: '8px 0 0' }}>Your commission: <strong>{money(commission)}</strong></p>
        <p className="meta" style={{ margin: '2px 0 0' }}>Paid to your wallet only after the order is delivered. Cancelled or returned orders earn nothing.</p>
      </div>

      <div className="formbar">
        <button className="btn dark" style={{ flex: 1 }} onClick={place} disabled={busy || basket.length === 0}>{busy ? 'Placing order...' : 'Place order'}</button>
      </div>
    </div>
  );
}

function MyOrders({ userId, refreshKey }) {
  const [rows, setRows] = useState(null);
  const [credited, setCredited] = useState({});

  useEffect(() => {
    (async () => {
      const [o, l] = await Promise.all([
        supabase.from('orders').select('id,order_no,status,total,placed_at,customer_name,order_items(unit_price,reseller_unit_price,qty)')
          .eq('user_id', userId).eq('is_reseller_order', true).order('placed_at', { ascending: false }).limit(100),
        supabase.from('wallet_ledger').select('order_id,entry_type,amount').eq('user_id', userId).in('entry_type', ['commission', 'commission_reversal']),
      ]);
      setRows(o.data || []);
      const map = {};
      (l.data || []).forEach((x) => { map[x.order_id] = (map[x.order_id] || 0) + Number(x.amount); });
      setCredited(map);
    })();
  }, [userId, refreshKey]);

  if (rows === null) return <p className="muted">Loading...</p>;
  return (
    <div className="plist">
      {rows.map((o) => {
        const expected = o.order_items.reduce((s, i) => s + (Number(i.unit_price) - Number(i.reseller_unit_price || i.unit_price)) * i.qty, 0);
        const got = credited[o.id] || 0;
        return (
          <div key={o.id} className="pitem">
            <div>
              <strong>{o.order_no}</strong>
              <p className="meta">{o.customer_name} · {new Date(o.placed_at).toLocaleDateString('en-GB')}</p>
              <p className="meta">Commission {money(expected)}{got ? ' (in wallet: ' + money(got) + ')' : ''}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>{money(o.total)}</div>
              <span className="badge">{STATUS[o.status]}</span>
            </div>
          </div>
        );
      })}
      {rows.length === 0 && <p className="muted">No reseller orders yet.</p>}
    </div>
  );
}

function Wallet({ userId, refreshKey }) {
  const [balance, setBalance] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [wds, setWds] = useState([]);
  const [minW, setMinW] = useState(0);
  const [amount, setAmount] = useState('');
  const [bkash, setBkash] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function load() {
    const [b, l, w, s, p] = await Promise.all([
      supabase.from('wallet_balances').select('balance').eq('user_id', userId).maybeSingle(),
      supabase.from('wallet_ledger').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      supabase.from('withdrawal_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('store_settings').select('value').eq('key', 'reseller').maybeSingle(),
      supabase.from('profiles').select('phone').eq('id', userId).maybeSingle(),
    ]);
    setBalance(b.data ? Number(b.data.balance) : 0);
    setLedger(l.data || []);
    setWds(w.data || []);
    setMinW(s.data && s.data.value ? Number(s.data.value.min_withdrawal) || 0 : 0);
    setBkash((cur) => cur || (p.data && p.data.phone) || '');
  }
  useEffect(() => { load(); }, [userId, refreshKey]);

  async function request(e) {
    e.preventDefault();
    setError('');
    setOk('');
    const amt = Number(amount);
    if (!(amt > 0)) { setError('Enter an amount above zero.'); return; }
    setBusy(true);
    const { error: err } = await supabase.rpc('request_withdrawal', { p_amount: amt, p_bkash: bkash.trim() });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setOk('Withdrawal requested. We will send the money to your bKash and mark it paid.');
    setAmount('');
    load();
  }

  return (
    <div>
      <div className="fsec" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
        <p className="meta" style={{ margin: 0 }}>Wallet balance</p>
        <strong style={{ fontSize: 24 }}>{balance === null ? '...' : money(balance)}</strong>
        {balance !== null && balance < 0 && <p className="notice" style={{ marginTop: 8 }}>Your balance is below zero because a delivered order was returned after its commission was paid out. It will be cleared from your next commissions.</p>}
      </div>

      <form className="fsec" onSubmit={request} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginTop: 12 }}>
        <h2>Withdraw to bKash</h2>
        <div className="two">
          <div><label>Amount{minW > 0 ? ' (minimum ' + money(minW) + ')' : ''}</label><input type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><label>bKash number</label><input inputMode="numeric" value={bkash} onChange={(e) => setBkash(e.target.value)} placeholder="01XXXXXXXXX" /></div>
        </div>
        {error && <p className="notice" role="alert" style={{ marginTop: 8 }}>{error}</p>}
        {ok && <p className="okmsg" role="status" style={{ marginTop: 8 }}>{ok}</p>}
        <button className="btn dark" type="submit" disabled={busy} style={{ marginTop: 10 }}>{busy ? 'Sending...' : 'Request withdrawal'}</button>
        <p className="meta" style={{ margin: '8px 0 0' }}>The amount leaves your wallet right away. If we reject the request, it returns to your wallet.</p>
      </form>

      {wds.length > 0 && (
        <>
          <h2 className="h2">Withdrawals</h2>
          <div className="plist">
            {wds.map((w) => (
              <div key={w.id} className="pitem">
                <div><strong>{money(w.amount)}</strong><p className="meta">{w.bkash_number} · {new Date(w.created_at).toLocaleDateString('en-GB')}</p></div>
                <span className="badge">{w.status === 'pending' ? 'Waiting' : w.status === 'paid' ? 'Paid' : 'Rejected'}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="h2">History</h2>
      <div className="plist">
        {ledger.map((x) => (
          <div key={x.id} className="pitem">
            <div><strong>{LEDGER[x.entry_type] || x.entry_type}</strong><p className="meta">{new Date(x.created_at).toLocaleDateString('en-GB')}{x.note ? ' · ' + x.note : ''}</p></div>
            <strong>{Number(x.amount) < 0 ? '- ' : '+ '}{money(Math.abs(Number(x.amount)))}</strong>
          </div>
        ))}
        {ledger.length === 0 && <p className="muted">Nothing yet.</p>}
      </div>
    </div>
  );
}

export function ResellerPanel({ userId }) {
  const [view, setView] = useState('order');
  const [refresh, setRefresh] = useState(0);
  const tabs = [['order', 'New order'], ['orders', 'My orders'], ['wallet', 'Wallet']];
  return (
    <div className="page">
      <h1 className="h1" style={{ marginTop: 16 }}>Reseller account</h1>
      <div className="chips" style={{ marginBottom: 12 }}>
        {tabs.map(([k, l]) => (
          <button key={k} className="chip" style={view === k ? { background: 'var(--black)', color: 'var(--white)' } : undefined} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>
      {view === 'order' && <NewOrder onPlaced={() => setRefresh((n) => n + 1)} />}
      {view === 'orders' && <MyOrders userId={userId} refreshKey={refresh} />}
      {view === 'wallet' && <Wallet userId={userId} refreshKey={refresh} />}
    </div>
  );
                  }
