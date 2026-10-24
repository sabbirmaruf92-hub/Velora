import React, { useEffect, useState } from 'react';
import { supabase } from './app-core.jsx';
import { AdminLayout } from './app-admin.jsx';
import { DIVISIONS, DISTRICTS, UPAZILAS } from './data-areas.js';

export const route = '/admin/areas';
export const tab = { label: 'Areas', order: 12 };

export default function AdminAreas() {
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('Dhaka');
  const [rows, setRows] = useState(null);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.from('extra_areas').select('id,name').eq('district', district).order('name');
    if (error) setMsg({ bad: true, text: error.message.includes('extra_areas') ? 'Run the 11a SQL file first.' : error.message });
    setRows(data || []);
  }
  useEffect(() => { setRows(null); load(); }, [district]);

  async function add() {
    const names = [...new Set(text.split('\n').map((s) => s.trim()).filter(Boolean))];
    if (names.length === 0) { setMsg({ bad: true, text: 'Type at least one area name.' }); return; }
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from('extra_areas').upsert(names.map((name) => ({ district, name })), { onConflict: 'district,name', ignoreDuplicates: true });
    setBusy(false);
    if (error) {
      // the unique index is on lower-case names, so fall back to adding one by one
      let added = 0;
      for (const name of names) {
        const r = await supabase.from('extra_areas').insert({ district, name });
        if (!r.error) added += 1;
      }
      setMsg({ bad: false, text: added + ' of ' + names.length + ' added (names that already exist are skipped).' });
    } else {
      setMsg({ bad: false, text: names.length + ' area(s) added to ' + district + '.' });
    }
    setText('');
    load();
  }

  async function remove(r) {
    const { error } = await supabase.from('extra_areas').delete().eq('id', r.id);
    if (error) setMsg({ bad: true, text: error.message }); else setMsg({ bad: false, text: 'Removed.' });
    load();
  }

  const builtIn = UPAZILAS[district] || [];

  return (
    <AdminLayout>
      <div className="row-head"><h1 className="h1" style={{ fontSize: 20 }}>Areas</h1></div>
      <p className="meta">Customers choose their upazila / thana from a list. If a local area is missing (a market, a village), add it here and it appears for customers straight away.</p>

      <div className="two" style={{ margin: '10px 0' }}>
        <div>
          <label>Division</label>
          <select value={division} onChange={(e) => { const d = e.target.value; setDivision(d); setDistrict(DISTRICTS[d][0]); }}>
            {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label>District</label>
          <select value={district} onChange={(e) => setDistrict(e.target.value)}>
            {DISTRICTS[division].map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="fsec">
        <h2>Add areas to {district}</h2>
        <label>One name on each line</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'Dalibari\nSome Bazar'} />
        {msg && <p className={msg.bad ? 'notice' : 'okmsg'} role={msg.bad ? 'alert' : 'status'} style={{ marginTop: 8 }}>{msg.text}</p>}
        <button className="btn dark" style={{ marginTop: 10 }} onClick={add} disabled={busy}>{busy ? 'Adding...' : 'Add areas'}</button>
      </div>

      <div className="fsec">
        <h2>Areas you added ({rows ? rows.length : '...'})</h2>
        {(rows || []).map((r) => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{r.name}</span>
            <button className="btn small danger" onClick={() => remove(r)}>Remove</button>
          </div>
        ))}
        {rows && rows.length === 0 && <p className="muted">None yet.</p>}
      </div>

      <details className="fsec">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Built-in areas of {district} ({builtIn.length})</summary>
        <p className="meta" style={{ marginTop: 8 }}>{builtIn.join(', ') || 'None'}</p>
      </details>
    </AdminLayout>
  );
    }
