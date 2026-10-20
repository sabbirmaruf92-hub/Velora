import React, { useEffect, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin';
export const tab = { label: 'Dashboard', order: 0 };

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function Row({ label, value, minus, strong, hint }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: strong ? '1px solid var(--line)' : undefined, fontWeight: strong ? 700 : 400, fontSize: 14 }}>
      <span title={hint}>{label}</span>
      <span>{minus ? '- ' : ''}{money(Math.abs(value))}</span>
    </div>
  );
}

function Card({ label, value, hint }) {
  return (
    <div className="fsec" style={{ margin: 0 }}>
      <p className="meta" style={{ margin: 0 }}>{label}</p>
      <strong style={{ fontSize: 18 }}>{value}</strong>
      {hint && <p className="meta" style={{ margin: '2px 0 0' }}>{hint}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const now = new Date();
  const [preset, setPreset] = useState('month');
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [r, setR] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');

  function choose(p) {
    const t = new Date();
    setPreset(p);
    if (p === 'today') { setFrom(iso(t)); setTo(iso(t)); }
    if (p === 'week') { const s = new Date(t); s.setDate(t.getDate() - 6); setFrom(iso(s)); setTo(iso(t)); }
    if (p === 'month') { setFrom(iso(new Date(t.getFullYear(), t.getMonth(), 1))); setTo(iso(t)); }
    if (p === 'year') { setFrom(iso(new Date(t.getFullYear(), 0, 1))); setTo(iso(t)); }
  }

  useEffect(() => {
    let alive = true;
    if (!from || !to || from > to) return undefined;
    setR(null);
    (async () => {
      const [a, b] = await Promise.all([
        supabase.rpc('profit_report', { p_from: from, p_to: to }),
        supabase.rpc('profit_by_product', { p_from: from, p_to: to }),
      ]);
      if (!alive) return;
      const err = a.error || b.error;
      if (err) {
        setError(err.message.includes('does not exist') || err.message.includes('schema cache') ? 'Database function missing. Run the 06a, 06b and 07 SQL files first.' : err.message);
        return;
      }
      setError('');
      setR(a.data);
      setProducts(b.data || []);
    })();
    return () => { alive = false; };
  }, [from, to]);

  function exportCsv() {
    const e = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['Product', 'Qty', 'Sales before order discounts', 'Cost of goods', 'Profit'].map(e).join(',')];
    products.forEach((p) => lines.push([p.name, p.qty, p.sales, p.cogs, p.profit].map(e).join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'product-profit-' + from + '-to-' + to + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const presets = [['today', 'Today'], ['week', '7 days'], ['month', 'This month'], ['year', 'This year'], ['custom', 'Custom']];

  return (
    <AdminLayout>
      <div className="row-head"><h1 className="h1" style={{ fontSize: 20 }}>Dashboard</h1></div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {presets.map(([k, l]) => (
          <button key={k} className="chip" style={preset === k ? { background: 'var(--black)', color: 'var(--white)' } : undefined} onClick={() => (k === 'custom' ? setPreset('custom') : choose(k))}>{l}</button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="two" style={{ marginBottom: 10 }}>
          <div><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      )}
      <p className="meta">Showing {from} to {to}. Sales and profit count only delivered orders, on the day they were delivered.</p>
      {error && <p className="notice" role="alert">{error}</p>}
      {!r && !error && <p className="muted">Loading...</p>}

      {r && (
        <>
          <div className="two" style={{ margin: '12px 0' }}>
            <Card label="Net sales" value={money(r.net_sales)} hint={r.delivered_orders + ' delivered orders'} />
            <Card label="Net operating profit" value={money(r.net_operating_profit)} />
            <Card label="Gross profit" value={money(r.gross_profit)} />
            <Card label="Cost of goods sold" value={money(r.cogs)} />
            <Card label="Delivery collected" value={money(r.delivery_income)} />
            <Card label="Discounts and refunds" value={money(Number(r.discounts) + Number(r.refunds))} />
          </div>

          <div className="fsec">
            <h2>How profit is worked out</h2>
            <Row label="Gross sales (before discounts)" value={r.gross_sales} />
            <Row label="Discounts" value={r.discounts} minus />
            <Row label="Refunds" value={r.refunds} minus />
            <Row label="Net sales" value={r.net_sales} strong />
            <Row label="Cost of goods sold" value={r.cogs} minus />
            <Row label="Gross profit" value={r.gross_profit} strong />
            <Row label="Delivery income" value={r.delivery_income} />
            <Row label="Delivery expense (per order)" value={r.delivery_expense_orders} minus />
            <Row label="Delivery expense (courier in expense ledger)" value={r.delivery_expense_ledger} minus hint="Record each courier cost in only one place" />
            <Row label="Packaging expenses" value={r.packaging_expenses} minus />
            <Row label="Other operating expenses" value={r.other_expenses} minus />
            <Row label="Payment fees" value={r.payment_fees} minus />
            <Row label="Adjustments" value={r.adjustments} />
            <Row label="Reseller commissions" value={r.reseller_commissions} minus />
            <Row label="Net operating profit" value={r.net_operating_profit} strong />
            <p className="meta" style={{ margin: '8px 0 0' }}>Stock purchase costs are not deducted here. Unsold stock stays as inventory value.</p>
          </div>

          <div className="fsec">
            <h2>Not counted in profit yet</h2>
            <Row label={r.pending_orders + ' orders in progress (all dates)'} value={r.pending_value} />
            <Row label="Unpaid order amounts" value={r.unpaid_amount} />
          </div>

          <div className="fsec">
            <h2>Money received (delivered orders)</h2>
            <Row label="Cash on Delivery collected" value={r.cod_collected} />
            <Row label="Online payments received" value={r.online_collected} />
          </div>

          <div className="fsec">
            <h2>Orders placed in this period</h2>
            <p style={{ margin: 0, fontSize: 14 }}>{r.orders_placed} placed · {r.orders_cancelled} cancelled · {r.orders_returned_or_refunded} returned or refunded</p>
            <Row label="Inventory value at cost (today)" value={r.inventory_value} strong />
          </div>

          <div className="fsec">
            <div className="row-head" style={{ marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>Profit by product</h2>
              <button className="btn small" onClick={exportCsv} disabled={products.length === 0}>Export CSV</button>
            </div>
            {products.map((p) => (
              <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: '1px solid var(--line)', fontSize: 14 }}>
                <span>{p.name} <span className="meta">x {p.qty}</span></span>
                <span>{money(p.profit)}</span>
              </div>
            ))}
            {products.length === 0 && <p className="muted">No delivered sales in this period.</p>}
            <p className="meta" style={{ margin: '8px 0 0' }}>Product profit is sales minus cost, before order-level discounts.</p>
          </div>
        </>
      )}
    </AdminLayout>
  );
    }
