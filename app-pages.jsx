import React, { useEffect, useState } from 'react';
import { supabase } from './app-core.jsx';

// Editable page texts. The shop owner can change any of these in Admin > Pages.
// A short blank line starts a new paragraph. Lines starting with "- " become bullets, "# " a heading.
export const POLICY_SLUGS = ['privacy', 'shipping', 'exchange', 'return', 'refund', 'terms'];

export const DEFAULT_PAGES = {
  privacy: {
    title: 'Privacy Policy',
    body: `# What we collect
- Your name, phone number and delivery addresses
- Your email address, if you give it
- Your orders and messages to our support team

# Why we collect it
We use your details only to take and deliver your orders, to contact you about them, and to give you support.

# Who sees it
Our delivery partners receive your name, phone number and address so they can deliver your order. We do not sell your personal information.

# Passwords and payments
Your password is handled by our secure login system. We do not store card or wallet passwords. If you pay by bKash Send Money, we keep the sender number and Transaction ID so we can check the payment.

# Stored on your device
We save your cart, theme choice and login on your own phone or computer so the shop works the way you left it.

# Your choices
You can ask us to correct or delete your details at any time through the Contact page.`,
  },
  shipping: {
    title: 'Shipping Policy',
    body: `# Cash on Delivery
You pay the delivery person when your order arrives.

# Delivery charge
The delivery charge depends on your area. It is shown on the product page, in your cart, and again at checkout before you place the order.

# Confirmation and delivery time
After you order, we confirm it by phone or message. Delivery time depends on your area and the delivery partner.

# Tracking your order
You can follow your order in My Account. The status moves from Placed to Confirmed, Processing, Shipped and Delivered. We show tracking details only when we really have them.

# If something is wrong
If an item is missing or damaged when it arrives, please contact us straight away.`,
  },
  exchange: {
    title: 'Exchange Policy',
    body: `# Exchanges
If the size or colour is not right, contact us as soon as you receive your order and we will help you exchange it, depending on what is in stock.

# Conditions
- The item should be unused and in its original condition
- Please keep the packaging and any tags
- Items made specially for you may not be exchangeable

# How to ask
Use the Contact page or Help & Support, with your order number.`,
  },
  return: {
    title: 'Return Policy',
    body: `# Returns
If you receive a wrong or damaged item, contact us with your order number and a clear photo. We will tell you how to send it back.

# Conditions
- Returns must be approved by us first
- The item should be unused and in its original condition

# What happens next
When the returned item reaches us and is checked, we update your order. If a refund applies, see the Refund Policy.`,
  },
  refund: {
    title: 'Refund Policy',
    body: `# Refunds
When a return or cancellation is approved and a refund applies, we send the money back to you.

# How you get it
Refunds go to the method we agree with you, such as bKash. For Cash on Delivery orders we will ask for the number to send it to.

# Your order record
Every refund is recorded against your order, so the amounts always match.`,
  },
  terms: {
    title: 'Terms and Conditions',
    body: `# Using this shop
By placing an order you agree to these terms.

# Prices and stock
All prices are in Bangladeshi Taka (BDT). Prices and availability can change. An order is confirmed only after we accept it.

# Orders and cancellation
You may ask to cancel an order before it is shipped. We may cancel an order if an item is out of stock or the details are wrong, and we will tell you.

# Your account
Please keep your login details private and give correct delivery details.

# Limits
We do our best to show colours and sizes correctly, but they can look different on different screens.

# Law
These terms follow the laws of Bangladesh.`,
  },
};

export const DEFAULT_FAQ = [
  { q: 'How do I pay?', a: 'You pay in cash when the order arrives (Cash on Delivery).' },
  { q: 'How much is delivery?', a: 'The delivery charge depends on your area. You will see it on the product page, in your cart and at checkout, before you order.' },
  { q: 'How can I follow my order?', a: 'Log in and open My Account. Your orders and their latest status are listed there.' },
  { q: 'Can I change the size or colour?', a: 'Contact us as soon as you receive your order. See the Exchange Policy for the conditions.' },
  { q: 'Do I need an account to order?', a: 'Yes. An account lets you see your orders and save your addresses.' },
];

export async function loadSetting(key) {
  if (!supabase) return null;
  const { data } = await supabase.from('store_settings').select('value').eq('key', key).maybeSingle();
  return data ? data.value : null;
}

export function usePageText(slug) {
  const [page, setPage] = useState(null);
  useEffect(() => {
    let alive = true;
    setPage(null);
    loadSetting('page_' + slug).then((v) => {
      if (!alive) return;
      const d = DEFAULT_PAGES[slug] || { title: '', body: '' };
      setPage({ title: (v && v.title) || d.title, body: v && typeof v.body === 'string' ? v.body : d.body });
    });
    return () => { alive = false; };
  }, [slug]);
  return page;
}

export function Prose({ text }) {
  const blocks = String(text || '').split(/\n\s*\n/);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim() !== '');
        if (lines.length === 0) return null;
        const out = [];
        let list = [];
        const flush = () => {
          if (list.length) { out.push(<ul key={'u' + out.length} style={{ paddingLeft: 20, margin: '0 0 10px' }}>{list.map((l, n) => <li key={n}>{l}</li>)}</ul>); list = []; }
        };
        lines.forEach((l) => {
          if (l.startsWith('- ')) { list.push(l.slice(2)); return; }
          flush();
          if (l.startsWith('# ')) out.push(<h2 key={'h' + out.length} className="h2" style={{ fontSize: 17 }}>{l.slice(2)}</h2>);
          else out.push(<p key={'p' + out.length} style={{ margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>{l}</p>);
        });
        flush();
        return <React.Fragment key={i}>{out}</React.Fragment>;
      })}
    </>
  );
}

export function waLink(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^https?:/i.test(s)) return s;
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  return 'https://wa.me/' + (d.startsWith('01') ? '88' + d : d);
}
