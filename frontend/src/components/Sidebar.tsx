import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { UserSession } from '../types';

const MENU_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { label: 'Members', path: '/members', icon: '👥' },
  { label: 'Donations', path: '/donations', icon: '💰' },
  { label: 'Reports', path: '/reports', icon: '📋' },
];

const ADMIN_MENU_ITEMS = [
  { label: 'Files', path: '/files', icon: '📁' },
];

export default function Sidebar({ session, onLogout }: { session: UserSession | null; onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(false);

    const isSuperAdmin = session?.role === 'superadmin';
  const items = isSuperAdmin ? [...MENU_ITEMS, ...ADMIN_MENU_ITEMS] : MENU_ITEMS;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button className="toggle-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '→' : '←'}
        </button>
        {!collapsed && (
          <div className="sidebar-brand">
            <span className="brand-mark">
              <img src="/logo.png" alt="KALOOB logo" className="sidebar-brand-logo" />
            </span>
            <h2>KALOOB</h2>
          </div>
        )}
      </div>

      <nav className="sidebar-menu">
        {items.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
            <span className="icon">{item.icon}</span>
            {!collapsed && <span className="label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className={`user-info ${collapsed ? 'collapsed' : ''}`}>
          {!collapsed && (
            <div>
              <div className="user-role">{session?.role === 'superadmin' ? 'Super Admin' : 'Church Admin'}</div>
              <div className="user-name">{session?.label}</div>
            </div>
          )}
        </div>
        <button className="logout-btn" onClick={onLogout}>
          {collapsed ? '🚪' : 'Logout'}
        </button>
      </div>
    </aside>
  );
}
