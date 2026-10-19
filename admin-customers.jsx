import React, { useEffect, useState } from 'react';
import { supabase } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin/customers';
export const tab = { label: 'Customers', order: 3 };

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState([]);
  const [loyaltySettings, setLoyaltySettings] = useState(null);

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,phone,email,created_at').order('created_at', { ascending: false }).then(({ data }) => {
      setCustomers(data || []);
      setLoading(false);
    });
    supabase.from('store_settings').select('value').eq('key', 'loyalty').single().then(({ data }) => {
      if (data) setLoyaltySettings(data.value);
    });
  }, []);

  async function openCustomer(c) {
    const [{ data: ords }, { data: loy }, { data: ns }] = await Promise.all([
      supabase.from('orders').select('id,order_no,status,total,placed_at').eq('user_id', c.id).order('placed_at', { ascending: false }),
      supabase.from('customer_loyalty').select('*').eq('user_id', c.id).single(),
      supabase.from('customer_notes').select('*').eq('user_id', c.id).order('created_at', { ascending: false }),
    ]);
    setSelected(c);
    setOrders(ords || []);
    setLoyalty(loy);
    setNotes(ns || []);
  }

  async function addNote() {
    if (!note.trim()) return;
    await supabase.from('customer_notes').insert({ user_id: selected.id, note: note.trim() });
    setNote('');
    const { data } = await supabase.from('customer_notes').select('*').eq('user_id', selected.id).order('created_at', { ascending: false });
    setNotes(data || []);
  }

  const STATUS_BN = { pending:'Pending',confirmed:'Confirmed',processing:'Processing',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled',return_requested:'Return Req.',returned:'Returned',refunded:'Refunded' };

  const filtered = customers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.full_name?.toLowerCase().includes(s) || c.phone?.includes(s) || c.email?.toLowerCase().includes(s);
  });

  const spend = loyalty?.eligible_spend || 0;
  const threshold = loyaltySettings?.threshold || 50000;
  const progress = Math.min(100, (spend / threshold) * 100);

  if (selected) return (
    <AdminLayout>
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>{selected.full_name || 'Customer'}</h1>
        <button className="btn small" onClick={() => setSelected(null)}>Back</button>
      </div>

      <div className="fsec">
        <p><strong>{selected.full_name}</strong></p>
        <p className="meta">{selected.phone} · {selected.email}</p>
        <p className="meta">Joined: {new Date(selected.created_at).toLocaleDateString('bn-BD')}</p>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          {selected.phone && <a className="btn small" href={`tel:${selected.phone}`}>📞 Call</a>}
          {selected.phone && <a className="btn small" href={`https://wa.me/88${selected.phone}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>}
        </div>
      </div>

      <div className="fsec">
        <h2>Loyalty Progress</h2>
        <div style={{ background: 'var(--soft-pink)', borderRadius: 99, height: 10, overflow: 'hidden', margin: '8px 0' }}>
          <div style={{ width: progress + '%', height: '100%', background: 'var(--black)', borderRadius: 99 }} />
        </div>
        <p className="meta">৳{spend.toLocaleString()} / ৳{threshold.toLocaleString()}</p>
      </div>

      <div className="fsec">
        <h2>Orders ({orders.length})</h2>
        {orders.map(o => (
          <div key={o.id} className="pitem" style={{ marginBottom: 6 }}>
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
        {orders.length === 0 && <p className="muted">No orders.</p>}
      </div>

      <div className="fsec">
        <h2>Internal Notes</h2>
        {notes.map(n => (
          <div key={n.id} style={{ background: 'var(--soft-pink)', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 14 }}>
            <p style={{ margin: 0 }}>{n.note}</p>
            <p className="meta">{new Date(n.created_at).toLocaleString('bn-BD')}</p>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note…" style={{ flex: 1 }} />
          <button className="btn small dark" onClick={addNote}>Add</button>
        </div>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>Customers</h1>
      </div>
      <input placeholder="Search by name, phone, email…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
      {loading ? <p className="muted">Loading…</p> : (
        <div className="plist">
          {filtered.map(c => (
            <div key={c.id} className="pitem" style={{ cursor: 'pointer' }} onClick={() => openCustomer(c)}>
              <div>
                <strong>{c.full_name || '(no name)'}</strong>
                <p className="meta">{c.phone} · {c.email}</p>
              </div>
              <span style={{ color: 'var(--muted)', fontSize: 20 }}>›</span>
            </div>
          ))}
          {filtered.length === 0 && <p className="muted">No customers found.</p>}
        </div>
      )}
    </AdminLayout>
  );
        }
