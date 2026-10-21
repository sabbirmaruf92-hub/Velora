import React from 'react';
import { usePageText, Prose, POLICY_SLUGS, DEFAULT_PAGES } from './app-pages.jsx';

export const route = '/policy/:slug';

export default function PolicyPage({ params }) {
  const slug = params.slug;
  const known = POLICY_SLUGS.includes(slug);
  const page = usePageText(known ? slug : 'terms');

  if (!known) {
    return (
      <div className="page center">
        <h1 className="h1">Page not found</h1>
        <a className="btn" href="#/">Back to home</a>
      </div>
    );
  }
  if (!page) return <div className="page center muted">Loading...</div>;

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1 className="h1" style={{ marginTop: 16 }}>{page.title}</h1>
      <Prose text={page.body} />
      <div className="chips" style={{ marginTop: 24 }}>
        {POLICY_SLUGS.filter((s) => s !== slug).map((s) => (
          <a key={s} className="chip" href={'#/policy/' + s}>{DEFAULT_PAGES[s].title}</a>
        ))}
      </div>
    </div>
  );
}
