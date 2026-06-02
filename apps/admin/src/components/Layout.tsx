import { NavLink, Outlet, useMatch } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { logout, role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const storeMatch = useMatch('/stores/:storeId/*');
  const currentStoreId = storeMatch?.params?.storeId;
  const inStore = currentStoreId && currentStoreId !== 'claim';

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
        {inStore && (
          <>
            <NavLink to={`/stores/${currentStoreId}/events`} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              📅 Events
            </NavLink>
            <NavLink to={`/stores/${currentStoreId}/broadcast`} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              📢 Broadcast
            </NavLink>
            <NavLink to={`/stores/${currentStoreId}/redeem`} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              🎟 Redeem
            </NavLink>
          </>
        )}
        {isAdmin && (
          <>
            <div style={{ margin: '16px 8px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Admin
            </div>
            <NavLink to="/moderation" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              Moderation
            </NavLink>
            <NavLink to="/users" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} style={{ opacity: 0.45, pointerEvents: 'none' }}>
              Users
            </NavLink>
          </>
        )}
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
