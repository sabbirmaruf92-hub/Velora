import React, { useEffect, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin/customers';
export const tab = { label: 'Customers', order: 3 };

const STATUS = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped',
  delivered: 'Delivered', cancelled: 'Cancelled', return_requested: 'Return requested',
  returned: 'Returned', refunded: 'Refunded',
};

function Detail({ customer, onBack }) {
  const uid = customer.id;
  const [orders, setOrders] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [redemptions, setRedemptions] = useState([]);
  const [lsettings, setLsettings] = useState({});
  const [refundTotal, setRefundTotal] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [error, setError] = useState('');

  async function loadAll() {
    const res = await Promise.all([
      supabase.from('orders').select('id,order_no,status,payment_status,subtotal,discount_total,total,placed_at').eq('user_id', uid).order('placed_at', { ascending: false }),
      supabase.from('addresses').select('*').eq('user_id', uid),
      supabase.from('customer_notes').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('support_messages').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('customer_loyalty').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('loyalty_redemptions').select('*').eq('user_id', uid).order('redeemed_at', { ascending: false }),
      supabase.from('store_settings').select('value').eq('key', 'loyalty').maybeSingle(),
    ]);
    const bad = res.find((r) => r.error);
    if (bad) setError(bad.error.message);
    const ord = res[0].data || [];
    setOrders(ord);
    setAddresses(res[1].data || []);
    setNotes(res[2].data || []);
    setMessages(res[3].data || []);
    setLoyalty(res[4].data);
    setRedemptions(res[5].data || []);
    setLsettings((res[6].data && res[6].data.value) || {});
    const deliveredIds = ord.filter((o) => o.status === 'delivered').map((o) => o.id);
    if (deliveredIds.length) {
      const rf = await supabase.from('refunds').select('amount').in('order_id', deliveredIds);
      setRefundTotal((rf.data || []).reduce((s, x) => s + Number(x.amount), 0));
    } else {
      setRefundTotal(0);
    }
  }

  useEffect(() => { loadAll(); }, [uid]);

  async function addNote() {
    if (!noteText.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('customer_notes').insert({ user_id: uid, note: noteText.trim(), created_by: u.user ? u.user.id : null });
    if (err) { setError(err.message); return; }
    setNoteText('');
    loadAll();
  }

  async function sendReply() {
    if (!replyText.trim()) return;
    const { error: err } = await supabase.from('support_messages').insert({ user_id: uid, message: replyText.trim(), from_admin: true });
    if (err) { setError(err.message); return; }
    setReplyText('');
    loadAll();
  }

  const list = orders || [];
  const delivered = list.filter((o) => o.status === 'delivered');
  const cancelled = list.filter((o) => o.status === 'cancelled').length;
  const returned = list.filter((o) => ['return_requested', 'returned', 'refunded'].includes(o.status)).length;
  const estimate = Math.max(0, delivered.reduce((s, o) => s + Number(o.subtotal) - Number(o.discount_total), 0) - refundTotal);
  const threshold = Number(lsettings.threshold) || 50000;
  const pct = Number(lsettings.discount_percent) || 0;
  const progress = Math.min(100, (estimate / threshold) * 100);

  return (
    <>
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>{customer.full_name || 'Customer'}</h1>
        <button className="btn small" onClick={onBack}>Back</button>
      </div>
      {error && <p className="notice" role="alert">{error}</p>}

      <div className="fsec">
        <p style={{ margin: 0 }}>{customer.phone || 'No phone'} {customer.email ? '· ' + customer.email : ''}</p>
        <p className="meta" style={{ margin: '4px 0 0' }}>Joined {new Date(customer.created_at).toLocaleDateString('en-GB')}</p>
        {customer.phone && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="btn small" href={'tel:' + customer.phone}>Call</a>
            <a className="btn small" href={'https://wa.me/88' + customer.phone} target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
        )}
      </div>

      <div className="fsec">
        <h2>Loyalty progress</h2>
        <div style={{ background: 'var(--soft-pink)', borderRadius: 99, height: 10, overflow: 'hidden' }}>
          <div style={{ width: progress + '%', height: '100%', background: 'var(--black)' }} />
        </div>
        <p style={{ margin: '6px 0 0' }}>{money(estimate)} / {money(threshold)} {estimate >= threshold ? <span className="badge">Qualifies{pct > 0 ? ' for ' + pct + '%' : ''}</span> : null}</p>
        <p className="meta" style={{ margin: '4px 0 0' }}>
          Estimate from delivered orders (merchandise minus discounts and refunds). Saved total: {loyalty ? money(loyalty.eligible_spend) : 'not calculated yet'}.
        </p>
        {redemptions.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p className="meta" style={{ margin: 0 }}>Discounts used:</p>
            {redemptions.map((r) => (
              <p key={r.id} className="meta" style={{ margin: 0 }}>{new Date(r.redeemed_at).toLocaleDateString('en-GB')} · {money(r.discount_amount)}</p>
            ))}
          </div>
        )}
      </div>

      <div className="fsec">
        <h2>Orders</h2>
        <p className="meta" style={{ margin: '0 0 8px' }}>
          {list.length} total · {delivered.length} delivered · {cancelled} cancelled · {returned} returned/refunded
        </p>
        <div className="plist">
          {list.map((o) => (
            <div key={o.id} className="pitem">
              <div>
                <strong>{o.order_no}</strong>
                <p className="meta">{new Date(o.placed_at).toLocaleDateString('en-GB')}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>{money(o.total)}</div>
                <span className="badge">{STATUS[o.status]}</span>
              </div>
            </div>
          ))}
          {orders !== null && list.length === 0 && <p className="muted">No orders yet.</p>}
        </div>
      </div>

      <div className="fsec">
        <h2>Saved addresses</h2>
        {addresses.map((a) => (
          <p key={a.id} className="meta" style={{ margin: '0 0 6px' }}>
            {a.recipient_name}, {a.phone} — {a.division}, {a.district}, {a.upazila}, {a.address_line}
          </p>
        ))}
        {addresses.length === 0 && <p className="muted">None saved.</p>}
      </div>

      <div className="fsec">
        <h2>Support messages</h2>
        {messages.map((m) => (
          <p key={m.id} style={{ margin: '0 0 6px', fontSize: 14, textAlign: m.from_admin ? 'right' : 'left' }}>
            <span className="badge">{m.from_admin ? 'You' : 'Customer'}</span> {m.message}
          </p>
        ))}
        {messages.length === 0 && <p className="muted">No messages.</p>}
        <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply" />
        <button className="btn small" style={{ marginTop: 6 }} onClick={sendReply}>Send reply</button>
      </div>

      <div className="fsec">
        <h2>Internal notes (customers cannot see these)</h2>
        {notes.map((n) => (
          <p key={n.id} className="meta" style={{ margin: '0 0 6px' }}>{new Date(n.created_at).toLocaleDateString('en-GB')} · {n.note}</p>
        ))}
        <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a private note" />
        <button className="btn small" style={{ marginTop: 6 }} onClick={addNote}>Save note</button>
      </div>
    </>
  );
}

export default function AdminCustomers() {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,phone,email,created_at').order('created_at', { ascending: false }).limit(500)
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        setRows(data || []);
      });
  }, []);

  if (selected) {
    return <AdminLayout><Detail customer={selected} onBack={() => setSelected(null)} /></AdminLayout>;
  }

  const s = search.trim().toLowerCase();
  const filtered = (rows || []).filter((c) => !s ||
    (c.full_name || '').toLowerCase().includes(s) || (c.phone || '').includes(s) || (c.email || '').toLowerCase().includes(s));

  return (
    <AdminLayout>
      <div className="row-head"><h1 className="h1" style={{ fontSize: 20 }}>Customers</h1></div>
      <input placeholder="Search by name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
      {error && <p className="notice" role="alert">{error}</p>}
      {rows === null ? <p className="muted">Loading...</p> : (
        <div className="plist">
          {filtered.map((c) => (
            <div key={c.id} className="pitem" style={{ cursor: 'pointer' }} onClick={() => setSelected(c)}>
              <div>
                <strong>{c.full_name || 'No name'}</strong>
                <p className="meta">{c.phone || 'No phone'}</p>
              </div>
              <span className="meta">{new Date(c.created_at).toLocaleDateString('en-GB')}</span>
            </div>
          ))}
          {filtered.length === 0 && <p className="muted">No customers found.</p>}
        </div>
      )}
    </AdminLayout>
  );
                                                                    }
