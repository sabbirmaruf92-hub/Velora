import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './app-core.jsx';
import { UPAZILAS } from './data-areas.js';
import './forms.css';

// Areas the shop owner added in Admin > Areas, remembered per district while the page is open.
const cache = new Map();
async function extraAreas(district) {
  if (cache.has(district)) return cache.get(district);
  const { data } = await supabase.from('extra_areas').select('name').eq('district', district).order('name');
  const names = (data || []).map((r) => r.name);
  cache.set(district, names);
  return names;
}

export function AreaPicker({ district, value, onChange, label = 'Upazila / Thana *' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [more, setMore] = useState([]);

  useEffect(() => {
    let alive = true;
    extraAreas(district).then((n) => { if (alive) setMore(n); });
    return () => { alive = false; };
  }, [district]);

  const all = useMemo(() => {
    const base = UPAZILAS[district] || [];
    const seen = new Set(base.map((x) => x.toLowerCase()));
    return [...base, ...more.filter((x) => !seen.has(x.toLowerCase()))];
  }, [district, more]);

  const s = q.trim().toLowerCase();
  const shown = s ? all.filter((x) => x.toLowerCase().includes(s)) : all;
  const exact = all.some((x) => x.toLowerCase() === s);

  function pick(v) {
    onChange(v);
    setOpen(false);
    setQ('');
  }

  return (
    <>
      <label>{label}</label>
      <button type="button" className="area-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span style={{ color: value ? 'var(--black)' : 'var(--muted)' }}>{value || 'Choose or search your area'}</span>
        <span aria-hidden="true">&#9662;</span>
      </button>
      {open && (
        <div className="sheet-back" onClick={() => setOpen(false)} role="presentation">
          <div className="sheet" role="dialog" aria-label={'Choose your area in ' + district} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong>{district}</strong>
              <button type="button" className="btn small" onClick={() => setOpen(false)}>Close</button>
            </div>
            <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your upazila, thana or area" aria-label="Search area" />
            <div className="sheet-list">
              {s && !exact && <button type="button" className="sheet-item use" onClick={() => pick(q.trim())}>Use "{q.trim()}" as my area</button>}
              {shown.map((x) => (
                <button type="button" key={x} className={'sheet-item' + (x === value ? ' on' : '')} onClick={() => pick(x)}>{x}</button>
              ))}
              {shown.length === 0 && !s && <p className="muted" style={{ padding: 8 }}>No areas listed yet. Type your area above.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
