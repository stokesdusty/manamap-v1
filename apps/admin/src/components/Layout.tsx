import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { logout } = useAuth();

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-brand">🗺️ ManaMap Partner</div>
        <NavLink to="/stores" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          My Stores
        </NavLink>
        <NavLink to="/stores/claim" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          + Claim Store
        </NavLink>
        <div style={{ flex: 1 }} />
        <button
          className="sidebar-link"
          style={{ textAlign: 'left', width: '100%', color: 'var(--text-tertiary)' }}
          onClick={logout}
        >
          Sign out
        </button>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
