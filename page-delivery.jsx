import React, { useEffect, useState } from 'react';
import { supabase, money } from './app-core.jsx';
import { usePageText, Prose } from './app-pages.jsx';

export const route = '/delivery';

export default function DeliveryPage() {
  const page = usePageText('shipping');
  const [zones, setZones] = useState(null);

  useEffect(() => {
    supabase.from('delivery_zones').select('name,fee').eq('is_active', true).order('sort_order').then(({ data }) => setZones(data || []));
  }, []);

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1 className="h1" style={{ marginTop: 16 }}>Delivery</h1>
      <div className="plist" style={{ marginBottom: 16 }}>
        {(zones || []).map((z) => <div key={z.name} className="pitem"><span>{z.name}</span><strong>{money(z.fee)}</strong></div>)}
        {zones && zones.length === 0 && <p className="muted">Delivery charges are shown at checkout.</p>}
      </div>
      {page && <Prose text={page.body} />}
    </div>
  );
}
