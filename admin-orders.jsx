import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin/orders';
export const tab = { label: 'Orders', order: 1 };

const STATUSES = ['pending','confirmed','processing','shipped','delivered','cancelled','return_requested','returned','refunded'];
const STATUS_BN = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
  return_requested: 'Return Req.', returned: 'Returned', refunded: 'Refunded',
};
const PAY_BN = { unpaid: 'Unpaid', pending_verification: 'Verifying', paid: 'Paid', failed: 'Failed', refunded: 'Refunded' };

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.3;
    o.start(); o.stop(ctx.currentTime + 0.3);
  } catch (_) {}
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [newCount, setNewCount] = useState(0);
  const knownIds = useRef(new Set());

  async function load() {
    setLoading(true);
    let q = supabase
      .from('orders')
      .select('id,order_no,customer_name,customer_phone,status,payment_status,total,delivery_fee,placed_at,division,district,upazila,address_line,customer_note')
      .order('placed_at', { ascending: false })
      .limit(200);
    if (filterStatus) q = q.eq('status', filterStatus);
    const { data } = await q;
    setOrders(data || []);
    setLoading(false);
    (data || []).forEach(o => knownIds.current.add(o.id));
  }

  useEffect(() => { load(); }, [filterStatus]);

  useEffect(() => {
    const ch = supabase
      .channel('admin-orders-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const o = payload.new;
        if (!knownIds.current.has(o.id)) {
          knownIds.current.add(o.id);
          setNewCount(c => c + 1);
          playBeep();
          load();
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function updateStatus(orderId, newStatus) {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    await supabase.from('order_events').insert({ order_id: orderId, status: newStatus, note: 'Updated by admin' });
    load();
    if (selected?.id === orderId) setSelected(s => ({ ...s, status: newStatus }));
  }

  async function openOrder(order) {
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);
    setSelected({ ...order, items: items || [] });
  }

  const filtered = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.order_no?.toLowerCase().includes(s) ||
      o.customer_name?.toLowerCase().includes(s) ||
      o.customer_phone?.includes(s);
  });

  return (
    <AdminLayout>
      <div className="row-head">
        <h1 className="h1" style={{ fontSize: 20 }}>
          Orders {newCount > 0 && <span className="badge" style={{ background: 'red', color: '#fff' }}>{newCount} new</span>}
        </h1>
        {newCount > 0 && <button className="btn small" onClick={() => setNewCount(0)}>Clear</button>}
      </div>

      <div className="two" style={{ marginBottom: 12 }}>
        <input placeholder="Search by order no, name, phone…" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_BN[s]}</option>)}
        </select>
      </div>

      {loading ? <p className="muted">Loading…</p> : (
        <div className="plist">
          {filtered.map(o => (
            <div key={o.id} className="pitem" style={{ cursor: 'pointer' }} onClick={() => openOrder(o)}>
              <div>
                <strong>{o.order_no}</strong>
                <p style={{ margin: '2px 0 0', fontSize: 14 }}>{o.customer_name} · {o.customer_phone}</p>
                <p className="meta">{new Date(o.placed_at).toLocaleString('bn-BD')}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>৳{Number(o.total).toLocaleString()}</div>
                <span className="badge">{STATUS_BN[o.status]}</span>
                <span className="badge" style={{ background: o.payment_status === 'paid' ? '#e7f4ea' : '#fde' }}>
                  {PAY_BN[o.payment_status]}
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="muted">No orders found.</p>}
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, overflowY: 'auto' }}>
          <div style={{ background: 'var(--white)', maxWidth: 520, margin: '24px auto', borderRadius: 16, padding: 20 }}>
            <div className="row-head">
              <h2 className="h1" style={{ fontSize: 18 }}>{selected.order_no}</h2>
              <button className="btn small" onClick={() => setSelected(null)}>Close</button>
            </div>

            <div className="fsec">
              <p><strong>{selected.customer_name}</strong> · {selected.customer_phone}</p>
              <p className="meta">{selected.division}, {selected.district}, {selected.upazila}</p>
              <p className="meta">{selected.address_line}</p>
              {selected.customer_note && <p className="meta">Note: {selected.customer_note}</p>}
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a className="btn small" href={`tel:${selected.customer_phone}`}>📞 Call</a>
                <a className="btn small" href={`https://wa.me/88${selected.customer_phone}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
              </div>
            </div>

            <div className="fsec">
              <h2>Items</h2>
              {(selected.items || []).map(item => (
                <div key={item.id} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  {item.image_url && <img src={item.image_url} style={{ width: 56, height: 70, objectFit: 'cover', borderRadius: 8 }} alt="" />}
                  <div>
                    <strong style={{ fontSize: 14 }}>{item.product_name}</strong>
                    <p className="meta">{item.color} · {item.size} · {item.qty} pcs</p>
                    <p className="meta">৳{Number(item.unit_price).toLocaleString()} × {item.qty} = ৳{Number(item.line_total).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              <p style={{ marginTop: 8, fontSize: 14 }}>Delivery: ৳{Number(selected.delivery_fee).toLocaleString()}</p>
              <p><strong>Total: ৳{Number(selected.total).toLocaleString()}</strong></p>
            </div>

            <div className="fsec">
              <h2>Update Status</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {STATUSES.map(s => (
                  <button key={s} className={`btn small${selected.status === s ? ' dark' : ''}`}
                    onClick={() => updateStatus(selected.id, s)}>
                    {STATUS_BN[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
