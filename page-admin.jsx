import React from 'react';
import { AdminLayout } from './app-admin.jsx';

export const route = '/admin';

// Sub-pages are loaded automatically by main.jsx (admin-*.jsx files).
// This file just renders the AdminLayout wrapper for the /admin route.
export default function AdminPage() {
  return (
    <AdminLayout>
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)' }}>
        <p>Admin panel is ready. Use the tabs above to manage your store.</p>
      </div>
    </AdminLayout>
  );
}
