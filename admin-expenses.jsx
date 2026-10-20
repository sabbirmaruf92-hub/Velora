import React, { useEffect, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin/expenses';
export const tab = { label: 'Expenses', order: 7 };

const CATS = [
  ['purchasing', 'Purchasing'], ['packaging', 'Packaging'], ['advertising', 'Advertising'],
  ['courier', 'Courier'], ['staff', 'Staff'], ['other', 'Other'],
];
const LABEL = Object.fromEntries(CATS);

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const blank = () => ({ expense_date: iso(new Date()), category: 'other', amount: '', reference: '', notes: '' });

export default function AdminExpenses() {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error: err } = await supabase.from('expenses').select('*')
      .gte('expense_date', from).lte('expense_date', to)
      .order('expense_date', { ascending: false }).order('created_at', { ascending: false });
    if (err) setError(err.message);
    setRows(data || []);
  }

  useEffect(() => { load(); }, [from, to]);

  async function save() {
    const amount = Number(form.amount);
    if (!form.expense_date) { setError('Please choose a date.'); return; }
    if (!(amount > 0)) { setError('Please enter an amount above zero.'); return; }
    setBusy(true);
    setError('');
    const payload = {
      expense_date: form.expense_date, category: form.category, amount,
      reference: form.reference.trim() || null, notes: form.notes.trim() || null,
    };
    let res;
    if (form.id) {
      res = await supabase.from('expenses').update(payload).eq('id', form.id);
    } else {
      const { data: u } = await supabase.auth.getUser();
      res = await supabase.from('expenses').insert({ ...payload, created_by: u.user ? u.user.id : null });
    }
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setForm(null);
    load();
  }

  async function remove(id) {
    if (!window.confirm('Delete this expense?')) return;
    const { error: err } = await supabase.from('expenses').delete().eq('id', id);
    if (err) setError(err.message);
    load();
  }

  function exportCsv() {
    const esc = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['Date', 'Category', 'Amount', 'Reference', 'Notes'].map(esc).join(',')];
    (rows || []).forEach((r) => lines.push([r.expense_date, LABEL[r.category], r.amount, r.reference, r.notes].map(esc).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'expenses-' + from + '-to-' + to + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const list = rows || [];
  const total = list.reduce((s, r) => s + Number(r.amount), 0);
  const byCat = CATS.map(([k, label]) => [label, list.filter((r) => r.category === k).reduce((s, r) => s + Number(r.amount), 0)]).filter(([, v]) => v > 0);

  return (
    <AdminLayout>
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>Expenses</h1>
        <button className="btn dark" onClick={() => { setError(''); setForm(blank()); }}>+ Add expense</button>
      </div>

      <p className="notice" style={{ fontSize: 13 }}>
        Stock you buy to sell is recorded in Inventory (Receive stock). It reaches profit through cost of goods sold, so please do not add it here as well.
      </p>

      {error && <p className="notice" role="alert">{error}</p>}

      {form && (
        <div className="fsec">
          <h2>{form.id ? 'Edit expense' : 'New expense'}</h2>
          <div className="two">
            <div><label>Date</label><input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
            <div>
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
          </div>
          <label>Amount (BDT)</label>
          <input type="number" inputMode="decimal" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <label>Reference (optional)</label>
          <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          <label>Notes (optional)</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn dark" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
            <button className="btn" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="two" style={{ marginBottom: 12 }}>
        <div><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <div className="fsec">
        <div className="row-head" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Total {money(total)}</h2>
          <button className="btn small" onClick={exportCsv} disabled={list.length === 0}>Export CSV</button>
        </div>
        {byCat.map(([label, v]) => (
          <p key={label} className="meta" style={{ margin: 0 }}>{label}: {money(v)}</p>
        ))}
      </div>

      {rows === null ? <p className="muted">Loading...</p> : (
        <div className="plist">
          {list.map((r) => (
            <div key={r.id} className="pitem">
              <div>
                <strong>{money(r.amount)}</strong> <span className="badge">{LABEL[r.category]}</span>
                <p className="meta">{new Date(r.expense_date + 'T00:00:00').toLocaleDateString('en-GB')}{r.reference ? ' · ' + r.reference : ''}</p>
                {r.notes && <p className="meta">{r.notes}</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="btn small" onClick={() => { setError(''); setForm({ ...r, amount: String(r.amount), reference: r.reference || '', notes: r.notes || '' }); }}>Edit</button>
                <button className="btn small danger" onClick={() => remove(r.id)}>Delete</button>
              </div>
            </div>
          ))}
          {list.length === 0 && <p className="muted">No expenses in this date range.</p>}
        </div>
      )}
    </AdminLayout>
  );
      }
