import React, { useEffect, useRef, useState } from 'react';
import { supabase, money, useSettings } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin/orders';
export const tab = { label: 'Orders', order: 1 };

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned', 'refunded'];
const STATUS = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered',
  cancelled: 'Cancelled', return_requested: 'Return requested', returned: 'Returned', refunded: 'Refunded',
};
const PAYMENTS = ['unpaid', 'pending_verification', 'paid', 'failed', 'refunded'];
const PAY = { unpaid: 'Unpaid', pending_verification: 'Verifying', paid: 'Paid', failed: 'Failed', refunded: 'Refunded' };
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
  if (m.includes('does not exist') || m.includes('schema cache')) return 'Database function missing. Run the 06a, 06b and 07 SQL files first.';
  return m;
}

function OrderDetail({ id, onClose, onChanged }) {
  const settings = useSettings();
  const [o, setO] = useState(null);
  const [items, setItems] = useState([]);
  const [costs, setCosts] = useState({});
  const [fin, setFin] = useState({ delivery_cost: '', payment_fee: '', adjustment: '', note: '' });
  const [refunds, setRefunds] = useState([]);
  const [events, setEvents] = useState([]);
  const [refundAmt, setRefundAmt] = useState('');
  const [refundWhy, setRefundWhy] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function load() {
    const od = await supabase.from('orders').select('*').eq('id', id).single();
    if (od.error) { setError(od.error.message); return; }
    const it = await supabase.from('order_items').select('*').eq('order_id', id);
    const itemIds = (it.data || []).map((x) => x.id);
    const [c, f, r, e] = await Promise.all([
      itemIds.length ? supabase.from('order_item_costs').select('order_item_id,unit_cost').in('order_item_id', itemIds) : Promise.resolve({ data: [] }),
      supabase.from('order_finance').select('*').eq('order_id', id).maybeSingle(),
      supabase.from('refunds').select('*').eq('order_id', id).order('created_at'),
      supabase.from('order_events').select('*').eq('order_id', id).order('created_at'),
    ]);
    setO(od.data);
    setItems(it.data || []);
    const map = {};
    (c.data || []).forEach((x) => { map[x.order_item_id] = Number(x.unit_cost); });
    setCosts(map);
    if (f.data) setFin({ delivery_cost: String(f.data.delivery_cost), payment_fee: String(f.data.payment_fee), adjustment: String(f.data.adjustment), note: f.data.note || '' });
    setRefunds(r.data || []);
    setEvents(e.data || []);
  }
  useEffect(() => { load(); }, [id]);

  async function run(fn, success) {
    setError('');
    setOk('');
    const { error: err } = await fn();
    if (err) { setError(friendly(err)); return; }
    setOk(success);
    await load();
    onChanged();
  }

  function changeStatus(s) {
    if (s === o.status) return;
    if (['cancelled', 'returned', 'refunded'].includes(s) && !window.confirm('Change status to ' + STATUS[s] + '? ' + (s === 'refunded' ? '' : 'Items go back into stock. ') + 'This cannot be undone.')) return;
    run(() => supabase.rpc('set_order_status', { p_order_id: id, p_status: s, p_note: null }), 'Status updated');
  }
  const changePay = (s) => run(() => supabase.rpc('set_payment_status', { p_order_id: id, p_status: s, p_note: null }), 'Payment status updated');

  function saveFinance() {
    const d = Number(fin.delivery_cost || 0);
    const p = Number(fin.payment_fee || 0);
    const a = Number(fin.adjustment || 0);
    if (!(d >= 0) || !(p >= 0) || Number.isNaN(a)) { setError('Enter valid numbers.'); return; }
    run(() => supabase.from('order_finance').upsert({ order_id: id, delivery_cost: d, payment_fee: p, adjustment: a, note: fin.note.trim() || null }, { onConflict: 'order_id' }), 'Costs saved');
  }

  function addRefund() {
    const amt = Number(refundAmt);
    if (!(amt > 0)) { setError('Enter a refund amount above zero.'); return; }
    if (!window.confirm('Record a refund of ' + money(amt) + '? Only do this after you have actually sent the money.')) return;
    run(() => supabase.rpc('record_refund', { p_order_id: id, p_amount: amt, p_reason: refundWhy }), 'Refund recorded').then(() => { setRefundAmt(''); setRefundWhy(''); });
  }

  function printInvoice() {
    const w = window.open('', '_blank');
    if (!w) { setError('Please allow pop-ups to print the invoice.'); return; }
    const rows = items.map((i) => '<tr><td>' + esc(i.product_name) + ' (' + esc(i.color) + ', ' + esc(i.size) + ')</td><td>' + i.qty + '</td><td>' + money(i.unit_price) + '</td><td>' + money(i.line_total) + '</td></tr>').join('');
    w.document.write('<html><head><title>Invoice ' + esc(o.order_no) + '</title><style>body{font-family:sans-serif;padding:24px;max-width:700px;margin:auto}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style></head><body>'
      + '<h2>' + esc(settings.brand_name) + '</h2><p>Invoice <strong>' + esc(o.order_no) + '</strong><br>' + new Date(o.placed_at).toLocaleString('en-GB') + '</p>'
      + '<p><strong>' + esc(o.customer_name) + '</strong><br>' + esc(o.customer_phone) + '<br>' + esc([o.address_line, o.upazila, o.district, o.division].join(', ')) + '</p>'
      + '<table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>' + rows + '</table>'
      + '<p>Subtotal: ' + money(o.subtotal) + '<br>Discount: ' + money(o.discount_total) + '<br>Delivery: ' + money(o.delivery_fee) + '<br><strong>Total: ' + money(o.total) + '</strong><br>Payment: ' + esc(o.payment_method === 'cod' ? 'Cash on Delivery' : o.payment_method) + ' (' + esc(PAY[o.payment_status]) + ')</p>'
      + '<script>window.onload=function(){window.print()}</script></body></html>');
    w.document.close();
  }

  if (!o) return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'grid', placeItems: 'center' }}><p className="okmsg">{error || 'Loading...'}</p></div>;

  const cogs = items.reduce((s, i) => s + (costs[i.id] || 0) * i.qty, 0);
  const refunded = refunds.reduce((s, r) => s + Number(r.amount), 0);
  const profit = Number(o.subtotal) - Number(o.discount_total) - cogs + Number(o.delivery_fee)
    - Number(fin.delivery_cost || 0) - Number(fin.payment_fee || 0) + Number(fin.adjustment || 0) - refunded;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, overflowY: 'auto' }}>
      <div style={{ background: 'var(--white)', maxWidth: 560, margin: '16px auto', borderRadius: 16, padding: 18 }}>
        <div className="row-head">
          <h2 className="h1" style={{ fontSize: 18, margin: 0 }}>{o.order_no}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn small" onClick={printInvoice}>Invoice</button>
            <button className="btn small" onClick={onClose}>Close</button>
          </div>
        </div>
        {error && <p className="notice" role="alert">{error}</p>}
        {ok && <p className="okmsg" role="status">{ok}</p>}

        <div className="fsec">
          <p style={{ margin: 0 }}><strong>{o.customer_name}</strong> · {o.customer_phone}</p>
          <p className="meta" style={{ margin: '4px 0 0' }}>{o.address_line}, {o.upazila}, {o.district}, {o.division}</p>
          {o.customer_note && <p className="meta" style={{ margin: '4px 0 0' }}>Note: {o.customer_note}</p>}
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <a className="btn small" href={'tel:' + o.customer_phone}>Call</a>
            <a className="btn small" href={'https://wa.me/88' + o.customer_phone} target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
        </div>

        <div className="fsec">
          <h2>Items</h2>
          {items.map((i) => (
            <div key={i.id} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {i.image_url && <img src={i.image_url} alt="" style={{ width: 56, height: 70, objectFit: 'cover', borderRadius: 8 }} />}
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 14 }}>{i.product_name}</strong>
                <p className="meta" style={{ margin: 0 }}>{i.color} / {i.size} · {i.qty} pcs · {money(i.unit_price)} each</p>
                <p className="meta" style={{ margin: 0 }}>Cost {money((costs[i.id] || 0) * i.qty)} (private)</p>
              </div>
              <strong>{money(i.line_total)}</strong>
            </div>
          ))}
          <p style={{ margin: '6px 0 0', fontSize: 14 }}>Subtotal {money(o.subtotal)} · Discount {money(o.discount_total)} · Delivery {money(o.delivery_fee)}</p>
          <p style={{ margin: '4px 0 0' }}><strong>Total {money(o.total)}</strong> · {o.payment_method === 'cod' ? 'Cash on Delivery' : o.payment_method}</p>
        </div>

        <div className="fsec">
          <h2>Status</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STATUSES.map((s) => (
              <button key={s} className={'btn small' + (o.status === s ? ' dark' : '')} onClick={() => changeStatus(s)}>{STATUS[s]}</button>
            ))}
          </div>
          <p className="meta" style={{ margin: '8px 0 0' }}>Cancelled and Returned put the items back in stock. Delivered on a Cash on Delivery order marks the cash as collected.</p>
          <h2 style={{ marginTop: 12 }}>Payment</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PAYMENTS.map((s) => (
              <button key={s} className={'btn small' + (o.payment_status === s ? ' dark' : '')} onClick={() => o.payment_status !== s && changePay(s)}>{PAY[s]}</button>
            ))}
          </div>
        </div>

        <div className="fsec">
          <h2>Business costs for this order (private)</h2>
          <div className="three">
            <div><label>Courier cost paid</label><input type="number" inputMode="decimal" min="0" value={fin.delivery_cost} onChange={(e) => setFin({ ...fin, delivery_cost: e.target.value })} /></div>
            <div><label>Payment fee</label><input type="number" inputMode="decimal" min="0" value={fin.payment_fee} onChange={(e) => setFin({ ...fin, payment_fee: e.target.value })} /></div>
            <div><label>Adjustment (+/-)</label><input type="number" inputMode="decimal" value={fin.adjustment} onChange={(e) => setFin({ ...fin, adjustment: e.target.value })} /></div>
          </div>
          <button className="btn small" style={{ marginTop: 8 }} onClick={saveFinance}>Save costs</button>
          <p style={{ margin: '10px 0 0' }}>Estimated profit on this order: <strong>{money(profit)}</strong></p>
          <p className="meta" style={{ margin: 0 }}>Reports count an order only after it is Delivered.</p>
        </div>

        <div className="fsec">
          <h2>Refunds</h2>
          {refunds.map((r) => <p key={r.id} className="meta" style={{ margin: '0 0 4px' }}>{new Date(r.created_at).toLocaleDateString('en-GB')} · {money(r.amount)}{r.reason ? ' · ' + r.reason : ''}</p>)}
          {refunds.length === 0 && <p className="muted">No refunds.</p>}
          <div className="two">
            <div><label>Amount</label><input type="number" inputMode="decimal" min="0" value={refundAmt} onChange={(e) => setRefundAmt(e.target.value)} /></div>
            <div><label>Reason</label><input value={refundWhy} onChange={(e) => setRefundWhy(e.target.value)} /></div>
          </div>
          <button className="btn small" style={{ marginTop: 8 }} onClick={addRefund}>Record refund</button>
        </div>

        <div className="fsec">
          <h2>History</h2>
          {events.map((e) => <p key={e.id} className="meta" style={{ margin: '0 0 4px' }}>{new Date(e.created_at).toLocaleString('en-GB')} · {STATUS[e.status] || e.status}{e.note ? ' · ' + e.note : ''}</p>)}
        </div>
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const now = new Date();
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pay, setPay] = useState('');
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())));
  const [to, setTo] = useState(iso(now));
  const [open, setOpen] = useState(null);
  const [newCount, setNewCount] = useState(0);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const known = useRef(new Set());

  async function load() {
    let q = supabase.from('orders')
      .select('id,order_no,customer_name,customer_phone,status,payment_status,payment_method,subtotal,delivery_fee,total,placed_at,district')
      .gte('placed_at', from + 'T00:00:00+06:00').lte('placed_at', to + 'T23:59:59+06:00')
      .order('placed_at', { ascending: false }).limit(500);
    if (status) q = q.eq('status', status);
    if (pay) q = q.eq('payment_status', pay);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    setRows(data || []);
    (data || []).forEach((r) => known.current.add(r.id));
  }
  useEffect(() => { load(); }, [status, pay, from, to]);

  useEffect(() => {
    const ch = supabase.channel('admin-orders-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        if (known.current.has(payload.new.id)) return;
        known.current.add(payload.new.id);
        setNewCount((c) => c + 1);
        setToast('New order ' + payload.new.order_no);
        beep();
        load();
        setTimeout(() => setToast(''), 6000);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  function exportCsv() {
    const e = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['Order', 'Date', 'Customer', 'Phone', 'District', 'Status', 'Payment', 'Subtotal', 'Delivery', 'Total'].map(e).join(',')];
    shown.forEach((r) => lines.push([r.order_no, new Date(r.placed_at).toLocaleDateString('en-GB'), r.customer_name, r.customer_phone, r.district, STATUS[r.status], PAY[r.payment_status], r.subtotal, r.delivery_fee, r.total].map(e).join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'orders-' + from + '-to-' + to + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const s = search.trim().toLowerCase();
  const shown = (rows || []).filter((r) => !s || r.order_no.toLowerCase().includes(s) || r.customer_name.toLowerCase().includes(s) || r.customer_phone.includes(s));

  return (
    <AdminLayout>
      {toast && <p className="okmsg" role="status" style={{ position: 'sticky', top: 8, zIndex: 30 }}>{toast}</p>}
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>Orders {newCount > 0 && <span className="badge" style={{ background: '#b3261e', color: '#fff' }}>{newCount} new</span>}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {newCount > 0 && <button className="btn small" onClick={() => setNewCount(0)}>Clear</button>}
          <button className="btn small" onClick={exportCsv} disabled={shown.length === 0}>Export CSV</button>
        </div>
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      <input placeholder="Search order number, name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="two" style={{ margin: '8px 0' }}>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((x) => <option key={x} value={x}>{STATUS[x]}</option>)}
        </select>
        <select aria-label="Payment" value={pay} onChange={(e) => setPay(e.target.value)}>
          <option value="">All payments</option>
          {PAYMENTS.map((x) => <option key={x} value={x}>{PAY[x]}</option>)}
        </select>
      </div>
      <div className="two" style={{ marginBottom: 12 }}>
        <div><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      {rows === null ? <p className="muted">Loading...</p> : (
        <div className="plist">
          {shown.map((r) => (
            <div key={r.id} className="pitem" style={{ cursor: 'pointer' }} onClick={() => setOpen(r.id)}>
              <div>
                <strong>{r.order_no}</strong>
                <p style={{ margin: '2px 0 0', fontSize: 14 }}>{r.customer_name} · {r.customer_phone}</p>
                <p className="meta">{new Date(r.placed_at).toLocaleString('en-GB')}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>{money(r.total)}</div>
                <span className="badge">{STATUS[r.status]}</span>
                <span className="badge" style={{ background: r.payment_status === 'paid' ? '#e7f4ea' : '#fde' }}>{PAY[r.payment_status]}</span>
              </div>
            </div>
          ))}
          {shown.length === 0 && <p className="muted">No orders found for these filters.</p>}
        </div>
      )}
      {open && <OrderDetail id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </AdminLayout>
  );
                    }
