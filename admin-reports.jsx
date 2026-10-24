import React, { useEffect, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin/reports';
export const tab = { label: 'Reports', order: 0.5 };

const REPORTS = [
  ['sales', 'Sales and profit'], ['products', 'Product-wise'], ['best', 'Best sellers'], ['variants', 'Size and colour'],
  ['customers', 'Customers'], ['stock', 'Stock value'], ['discounts', 'Discounts'], ['refunds', 'Refunds'], ['cancellations', 'Cancelled and returned'],
];
const MONEY = ['gross_sales', 'discounts', 'refunds', 'net_sales', 'cogs', 'gross_profit', 'sales', 'profit', 'spent', 'value', 'unit_cost', 'discount', 'amount', 'total'];
const SUM = [...MONEY.filter((k) => k !== 'unit_cost'), 'orders', 'qty'];
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const pretty = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const fmt = (k, v) => (MONEY.includes(k) ? money(v) : v === null || v === undefined ? '' : String(v));

export default function AdminReports() {
  const now = new Date();
  const [kind, setKind] = useState('sales');
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [period, setPeriod] = useState('day');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!from || !to || from > to) return undefined;
    let alive = true;
    setRows(null);
    supabase.rpc('admin_report', { p_kind: kind, p_from: from, p_to: to, p_period: period }).then(({ data, error: err }) => {
      if (!alive) return;
      if (err) {
        setError(err.message.includes('does not exist') || err.message.includes('schema cache') ? 'Database function missing. Run the 11b SQL file first.' : err.message);
        setRows([]);
        return;
      }
      setError('');
      setRows(data || []);
    });
    return () => { alive = false; };
  }, [kind, from, to, period]);

  const cols = rows && rows.length ? Object.keys(rows[0]) : [];
  const totals = {};
  cols.forEach((k) => { if (SUM.includes(k)) totals[k] = rows.reduce((s, r) => s + Number(r[k] || 0), 0); });

  function exportCsv() {
    const e = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const lines = [cols.map((k) => e(pretty(k))).join(',')];
    rows.forEach((r) => lines.push(cols.map((k) => e(r[k])).join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'report-' + kind + '-' + from + '-to-' + to + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <AdminLayout>
      <div className="row-head"><h1 className="h1" style={{ fontSize: 20 }}>Reports</h1></div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {REPORTS.map(([k, l]) => (
          <button key={k} className="chip" style={kind === k ? { background: 'var(--black)', color: 'var(--white)' } : undefined} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>

      {kind !== 'stock' && (
        <div className="two" style={{ marginBottom: 10 }}>
          <div><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      )}
      {kind === 'sales' && (
        <div style={{ marginBottom: 10 }}>
          <label>Group by</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </div>
      )}
      <p className="meta">
        {['sales', 'products', 'best', 'variants', 'customers'].includes(kind) ? 'Counts delivered orders, on the day they were delivered.' : kind === 'stock' ? 'Stock on hand today, at your average cost.' : 'Counts orders by the day they were placed (refunds by the day recorded).'}
      </p>
      {error && <p className="notice" role="alert">{error}</p>}
      {rows === null && !error && <p className="muted">Loading...</p>}

      {rows && rows.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
            <span className="meta">{rows.length} rows</span>
            <button className="btn small" onClick={exportCsv}>Export CSV</button>
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>{cols.map((k) => <th key={k} style={{ textAlign: SUM.includes(k) ? 'right' : 'left', padding: '8px 10px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', color: 'var(--muted)', fontWeight: 600 }}>{pretty(k)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>{cols.map((k) => <td key={k} style={{ textAlign: SUM.includes(k) ? 'right' : 'left', padding: '8px 10px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{fmt(k, r[k])}</td>)}</tr>
                ))}
                {Object.keys(totals).length > 0 && (
                  <tr>{cols.map((k, i) => <td key={k} style={{ textAlign: SUM.includes(k) ? 'right' : 'left', padding: '8px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{i === 0 ? 'Total' : (k in totals ? fmt(k, totals[k]) : '')}</td>)}</tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {rows && rows.length === 0 && !error && <p className="muted">Nothing to show for this report and date range.</p>}
    </AdminLayout>
  );
          }
