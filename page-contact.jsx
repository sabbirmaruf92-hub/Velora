import React, { useEffect, useState } from 'react';
import { loadSetting, waLink } from './app-pages.jsx';

export const route = '/contact';

const NAMES = { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok' };

export default function ContactPage() {
  const [contact, setContact] = useState(null);
  const [social, setSocial] = useState({});

  useEffect(() => {
    loadSetting('contact').then((v) => setContact(v || {}));
    loadSetting('social_links').then((v) => setSocial(v || {}));
  }, []);

  if (contact === null) return <div className="page center muted">Loading...</div>;
  const wa = waLink(social.whatsapp);
  const links = Object.keys(NAMES).filter((k) => social[k]);
  const empty = !contact.phone && !contact.email && !contact.address && !wa && links.length === 0;

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1 className="h1" style={{ marginTop: 16 }}>Contact us</h1>
      {empty && <p className="muted">Contact details will appear here soon.</p>}
      <div className="plist">
        {contact.phone && <a className="pitem" href={'tel:' + contact.phone}><span>Phone</span><strong>{contact.phone}</strong></a>}
        {wa && <a className="pitem" href={wa} target="_blank" rel="noreferrer"><span>WhatsApp</span><strong>Chat with us</strong></a>}
        {contact.email && <a className="pitem" href={'mailto:' + contact.email}><span>Email</span><strong>{contact.email}</strong></a>}
        {contact.address && <div className="pitem"><span>Address</span><strong style={{ textAlign: 'right', whiteSpace: 'pre-wrap' }}>{contact.address}</strong></div>}
        {links.map((k) => <a key={k} className="pitem" href={social[k]} target="_blank" rel="noreferrer"><span>{NAMES[k]}</span><strong>Open</strong></a>)}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>Have a question about an order? Please include your order number.</p>
    </div>
  );
}
