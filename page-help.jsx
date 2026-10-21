import React, { useEffect, useState } from 'react';
import { loadSetting, DEFAULT_FAQ, POLICY_SLUGS, DEFAULT_PAGES, waLink } from './app-pages.jsx';

export const route = '/help';

export default function HelpPage() {
  const [faq, setFaq] = useState(DEFAULT_FAQ);
  const [contact, setContact] = useState({});
  const [social, setSocial] = useState({});

  useEffect(() => {
    loadSetting('faq').then((v) => { if (Array.isArray(v) && v.length) setFaq(v); });
    loadSetting('contact').then((v) => setContact(v || {}));
    loadSetting('social_links').then((v) => setSocial(v || {}));
  }, []);

  const wa = waLink(social.whatsapp);

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1 className="h1" style={{ marginTop: 16 }}>Help and Support</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {wa && <a className="btn dark" href={wa} target="_blank" rel="noreferrer">WhatsApp us</a>}
        {contact.phone && <a className="btn" href={'tel:' + contact.phone}>Call us</a>}
        {social.facebook && <a className="btn" href={social.facebook} target="_blank" rel="noreferrer">Facebook</a>}
        <a className="btn" href="#/contact">Contact details</a>
      </div>

      <h2 className="h2">Common questions</h2>
      {faq.map((f, i) => (
        <details key={i} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{f.q}</summary>
          <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{f.a}</p>
        </details>
      ))}

      <h2 className="h2">Policies</h2>
      <div className="chips">
        {POLICY_SLUGS.map((s) => <a key={s} className="chip" href={'#/policy/' + s}>{DEFAULT_PAGES[s].title}</a>)}
        <a className="chip" href="#/delivery">Delivery</a>
      </div>
    </div>
  );
}
