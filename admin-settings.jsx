import React, { useEffect, useState } from 'react';
import { supabase } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin/settings';
export const tab = { label: 'Settings', order: 10 };

function useSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('store_settings').select('key,value');
    const map = {};
    (data || []).forEach(row => { map[row.key] = row.value; });
    setSettings(map);
    setLoading(false);
  }

  async function save(key, value) {
    await supabase.from('store_settings').upsert({ key, value, is_public: true }, { onConflict: 'key' });
    load();
  }

  useEffect(() => { load(); }, []);
  return { settings, loading, save };
}

export default function AdminSettings() {
  const { settings, loading, save } = useSettings();
  const [msg, setMsg] = useState('');

  const [brandName, setBrandName] = useState('');
  const [bkash, setBkash] = useState('');
  const [contact, setContact] = useState({ phone: '', email: '', address: '' });
  const [social, setSocial] = useState({ whatsapp: '', facebook: '', instagram: '', youtube: '', tiktok: '' });
  const [loyalty, setLoyalty] = useState({ threshold: 50000, discount_percent: 0, valid_days: '', repeat: false });
  const [requireLogin, setRequireLogin] = useState(true);
  const [zones, setZones] = useState([]);
  const [zoneMsg, setZoneMsg] = useState('');

  useEffect(() => {
    if (loading) return;
    setBrandName(settings.brand_name || 'Velora');
    setBkash(settings.bkash_number || '');
    setContact(settings.contact || { phone: '', email: '', address: '' });
    setSocial(settings.social_links || { whatsapp: '', facebook: '', instagram: '', youtube: '', tiktok: '' });
    setLoyalty(settings.loyalty || { threshold: 50000, discount_percent: 0, valid_days: '', repeat: false });
    setRequireLogin(settings.require_login_for_checkout !== false);
  }, [loading, settings]);

  useEffect(() => {
    supabase.from('delivery_zones').select('*').order('sort_order').then(({ data }) => setZones(data || []));
  }, []);

  async function saveAll() {
    await save('brand_name', JSON.stringify(brandName));
    await save('bkash_number', JSON.stringify(bkash));
    await save('contact', contact);
    await save('social_links', social);
    await save('loyalty', loyalty);
    await save('require_login_for_checkout', requireLogin);
    setMsg('Settings saved!');
    setTimeout(() => setMsg(''), 2000);
  }

  async function saveZone(zone) {
    if (zone.id) {
      await supabase.from('delivery_zones').update({ name: zone.name, fee: Number(zone.fee) }).eq('id', zone.id);
    } else {
      await supabase.from('delivery_zones').insert({ name: zone.name, fee: Number(zone.fee) });
    }
    const { data } = await supabase.from('delivery_zones').select('*').order('sort_order');
    setZones(data || []);
    setZoneMsg('Zones saved!');
    setTimeout(() => setZoneMsg(''), 2000);
  }

  async function deleteZone(id) {
    await supabase.from('delivery_zones').delete().eq('id', id);
    setZones(z => z.filter(x => x.id !== id));
  }

  if (loading) return <AdminLayout><p className="muted">Loading…</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="h1" style={{ fontSize: 20, marginBottom: 16 }}>Settings</h1>

      <div className="fsec">
        <h2>Store Info</h2>
        <label>Brand Name</label>
        <input value={brandName} onChange={e => setBrandName(e.target.value)} />
        <label>bKash Number (for reseller payments)</label>
        <input value={bkash} onChange={e => setBkash(e.target.value)} placeholder="01XXXXXXXXX" />
      </div>

      <div className="fsec">
        <h2>Contact Info</h2>
        <label>Phone</label>
        <input value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} />
        <label>Email</label>
        <input value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} />
        <label>Address</label>
        <textarea value={contact.address} onChange={e => setContact(c => ({ ...c, address: e.target.value }))} />
      </div>

      <div className="fsec">
        <h2>Social Links</h2>
        {Object.keys(social).map(k => (
          <div key={k}>
            <label style={{ textTransform: 'capitalize' }}>{k}</label>
            <input value={social[k]} onChange={e => setSocial(s => ({ ...s, [k]: e.target.value }))} placeholder={`https://...`} />
          </div>
        ))}
      </div>

      <div className="fsec">
        <h2>Loyalty Settings</h2>
        <div className="two">
          <div>
            <label>Threshold (৳)</label>
            <input type="number" value={loyalty.threshold} onChange={e => setLoyalty(l => ({ ...l, threshold: Number(e.target.value) }))} />
          </div>
          <div>
            <label>Discount (%)</label>
            <input type="number" value={loyalty.discount_percent} onChange={e => setLoyalty(l => ({ ...l, discount_percent: Number(e.target.value) }))} />
          </div>
        </div>
        <label>Valid Days (leave blank = no expiry)</label>
        <input type="number" value={loyalty.valid_days || ''} onChange={e => setLoyalty(l => ({ ...l, valid_days: e.target.value ? Number(e.target.value) : null }))} />
        <label style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={loyalty.repeat} onChange={e => setLoyalty(l => ({ ...l, repeat: e.target.checked }))} />
          Allow repeat redemption
        </label>
      </div>

      <div className="fsec">
        <h2>Checkout Setting</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={requireLogin} onChange={e => setRequireLogin(e.target.checked)} />
          Require login to checkout
        </label>
      </div>

      {msg && <p className="okmsg">{msg}</p>}
      <div className="formbar">
        <button className="btn dark" onClick={saveAll}>Save All Settings</button>
      </div>

      <div className="fsec" style={{ marginTop: 24 }}>
        <div className="row-head">
          <h2>Delivery Zones</h2>
          <button className="btn small" onClick={() => setZones(z => [...z, { _key: Date.now(), name: '', fee: 0 }])}>+ Add Zone</button>
        </div>
        {zones.map((zone, i) => (
          <div key={zone.id || zone._key} className="vrow" style={{ gridTemplateColumns: '1fr 120px auto' }}>
            <input value={zone.name} placeholder="Zone name (e.g. Inside Dhaka)" onChange={e => {
              const z = [...zones]; z[i] = { ...z[i], name: e.target.value }; setZones(z);
            }} />
            <input type="number" value={zone.fee} placeholder="Fee ৳" onChange={e => {
              const z = [...zones]; z[i] = { ...z[i], fee: e.target.value }; setZones(z);
            }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn small" onClick={() => saveZone(zone)}>Save</button>
              {zone.id && <button className="btn small danger" onClick={() => deleteZone(zone.id)}>Del</button>}
            </div>
          </div>
        ))}
        {zoneMsg && <p className="okmsg">{zoneMsg}</p>}
      </div>
    </AdminLayout>
  );
      }
