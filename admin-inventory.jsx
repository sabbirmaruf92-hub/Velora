import React, { useEffect, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin/inventory';
export const tab = { label: 'Inventory', order: 5 };

function friendly(err) {
  const m = err.message || '';
  if (err.code === '23514' || m.includes('stock_qty_check')) return 'Stock cannot go below zero.';
  if (m.includes('does not exist') || m.includes('schema cache')) return 'Database function missing. Run the 04a and 04b SQL files first.';
  return m;
}

function Panel({ variant, cost, onClose, onDone }) {
  const [mode, setMode] = useState('adjust');
  const [change, setChange] = useState('');
  const [reason, setReason] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadHistory() {
    const { data } = await supabase.from('inventory_movements').select('*').eq('variant_id', variant.id).order('created_at', { ascending: false }).limit(15);
    setHistory(data || []);
  }
  useEffect(() => { loadHistory(); }, [variant.id]);

  async function submit() {
    setError('');
    setBusy(true);
    let res;
    if (mode === 'adjust') {
      const c = Number(change);
      if (!Number.isInteger(c) || c === 0) { setError('Enter a whole number, like 5 or -2.'); setBusy(false); return; }
      if (!reason.trim()) { setError('Please give a reason.'); setBusy(false); return; }
      res = await supabase.rpc('adjust_stock', { p_variant_id: variant.id, p_change: c, p_reason: reason.trim() });
    } else {
      const q = Number(qty);
      const u = Number(unit);
      if (!Number.isInteger(q) || q <= 0) { setError('Quantity must be a whole number above zero.'); setBusy(false); return; }
      if (!(u >= 0) || unit === '') { setError('Enter the cost of one item.'); setBusy(false); return; }
      res = await supabase.rpc('record_purchase', { p_variant_id: variant.id, p_qty: q, p_unit_cost: u, p_note: note.trim() || null });
    }
    setBusy(false);
    if (res.error) { setError(friendly(res.error)); return; }
    setChange(''); setReason(''); setQty(''); setUnit(''); setNote('');
    loadHistory();
    onDone();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, overflowY: 'auto' }}>
      <div style={{ background: 'var(--white)', maxWidth: 480, margin: '24px auto', borderRadius: 16, padding: 20 }}>
        <div className="row-head">
          <h2 className="h1" style={{ fontSize: 18, margin: 0 }}>{variant.products.name}</h2>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>
        <p className="meta" style={{ margin: '0 0 10px' }}>
          {variant.color} / {variant.size} · In stock: <strong>{variant.stock_qty}</strong> · Avg cost: {cost ? money(cost) : 'not set'}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button className={'btn small' + (mode === 'adjust' ? ' dark' : '')} onClick={() => setMode('adjust')}>Adjust stock</button>
          <button className={'btn small' + (mode === 'receive' ? ' dark' : '')} onClick={() => setMode('receive')}>Receive stock</button>
        </div>

        {mode === 'adjust' ? (
          <>
            <label>Change (+ adds, - removes)</label>
            <input type="number" value={change} onChange={(e) => setChange(e.target.value)} placeholder="e.g. -2" />
            <label>Reason</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged, counted again" />
          </>
        ) : (
          <>
            <label>Quantity received</label>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            <label>Cost of one item (BDT)</label>
            <input type="number" inputMode="decimal" min="0" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <label>Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier or invoice" />
          </>
        )}
        {error && <p className="notice" role="alert" style={{ marginTop: 8 }}>{error}</p>}
        <button className="btn dark" style={{ marginTop: 10 }} onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>

        <h2 className="h2" style={{ fontSize: 16 }}>Recent changes</h2>
        {history.map((h) => (
          <p key={h.id} className="meta" style={{ margin: '0 0 4px' }}>
            {new Date(h.created_at).toLocaleDateString('en-GB')} · {h.change_qty > 0 ? '+' : ''}{h.change_qty} · {h.reason}{h.reference ? ' (' + h.reference + ')' : ''}
          </p>
        ))}
        {history.length === 0 && <p className="muted">No changes recorded yet.</p>}
      </div>
    </div>
  );
}

export default function AdminInventory() {
  const [rows, setRows] = useState(null);
  const [costs, setCosts] = useState({});
  const [threshold, setThreshold] = useState(5);
  const [thresholdMsg, setThresholdMsg] = useState('');
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const [v, c, s] = await Promise.all([
      supabase.from('product_variants').select('id,color,size,size_order,stock_qty,products(name,status)').limit(2000),
      supabase.from('variant_costs').select('variant_id,avg_unit_cost'),
      supabase.from('store_settings').select('value').eq('key', 'low_stock_threshold').maybeSingle(),
    ]);
    if (v.error) setError(v.error.message);
    const list = (v.data || []).filter((x) => x.products);
    list.sort((a, b) => a.products.name.localeCompare(b.products.name) || a.color.localeCompare(b.color) || a.size_order - b.size_order);
    setRows(list);
    const map = {};
    (c.data || []).forEach((x) => { map[x.variant_id] = Number(x.avg_unit_cost); });
    setCosts(map);
    if (s.data && typeof s.data.value === 'number') setThreshold(s.data.value);
  }

  useEffect(() => { load(); }, []);

  async function saveThreshold() {
    const n = Number(threshold);
    if (!Number.isInteger(n) || n < 0) { setThresholdMsg('Enter a whole number.'); return; }
    const { error: err } = await supabase.from('store_settings').upsert({ key: 'low_stock_threshold', value: n, is_public: false }, { onConflict: 'key' });
    setThresholdMsg(err ? err.message : 'Saved');
    setTimeout(() => setThresholdMsg(''), 2000);
  }

  const list = rows || [];
  const t = Number(threshold) || 0;
  const low = list.filter((r) => r.stock_qty > 0 && r.stock_qty <= t);
  const out = list.filter((r) => r.stock_qty === 0);
  const units = list.reduce((s, r) => s + r.stock_qty, 0);
  const value = list.reduce((s, r) => s + r.stock_qty * (costs[r.id] || 0), 0);
  const s = search.trim().toLowerCase();
  const shown = list.filter((r) => (!s || (r.products.name + ' ' + r.color + ' ' + r.size).toLowerCase().includes(s)) && (!onlyLow || r.stock_qty <= t));
  const openRow = open ? list.find((r) => r.id === open) : null;

  return (
    <AdminLayout>
      <div className="row-head"><h1 className="h1" style={{ fontSize: 20 }}>Inventory</h1></div>
      {error && <p className="notice" role="alert">{error}</p>}

      <div className="two" style={{ marginBottom: 12 }}>
        <div className="fsec" style={{ margin: 0 }}><p className="meta" style={{ margin: 0 }}>Units in stock</p><strong>{units}</strong></div>
        <div className="fsec" style={{ margin: 0 }}><p className="meta" style={{ margin: 0 }}>Stock value at cost</p><strong>{money(value)}</strong></div>
        <div className="fsec" style={{ margin: 0 }}><p className="meta" style={{ margin: 0 }}>Low stock</p><strong>{low.length}</strong></div>
        <div className="fsec" style={{ margin: 0 }}><p className="meta" style={{ margin: 0 }}>Out of stock</p><strong>{out.length}</strong></div>
      </div>
      <p className="meta">Stock value counts only items that have a cost. Record the cost with Receive stock.</p>

      <div className="two" style={{ margin: '12px 0' }}>
        <div>
          <label>Low stock alert at or below</label>
          <input type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
        <div style={{ alignSelf: 'end' }}>
          <button className="btn small" onClick={saveThreshold}>Save</button> <span className="meta">{thresholdMsg}</span>
        </div>
      </div>

      <input placeholder="Search product, colour or size" value={search} onChange={(e) => setSearch(e.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', margin: '8px 0 12px' }}>
        <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Show only low or out of stock
      </label>

      {rows === null ? <p className="muted">Loading...</p> : (
        <div className="plist">
          {shown.map((r) => (
            <div key={r.id} className="pitem" style={{ cursor: 'pointer' }} onClick={() => setOpen(r.id)}>
              <div>
                <strong>{r.products.name}</strong>
                <p className="meta">{r.color} / {r.size}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>{r.stock_qty}</strong>
                {r.stock_qty === 0 ? <span className="badge" style={{ background: '#fde' }}>Out</span> : r.stock_qty <= t ? <span className="badge" style={{ background: '#fff3cd' }}>Low</span> : null}
              </div>
            </div>
          ))}
          {shown.length === 0 && <p className="muted">Nothing to show. Add products with variants first.</p>}
        </div>
      )}

      {openRow && <Panel variant={openRow} cost={costs[openRow.id]} onClose={() => setOpen(null)} onDone={load} />}
    </AdminLayout>
  );
            }
