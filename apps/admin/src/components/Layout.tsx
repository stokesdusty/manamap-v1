import { NavLink, Outlet, useMatch } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export function Layout() {
  const { logout, role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const storeMatch = useMatch('/stores/:storeId/*');
  const currentStoreId = storeMatch?.params?.storeId;
  const inStore = currentStoreId && currentStoreId !== 'claim' && currentStoreId !== 'submissions';

  const { data: submissionCount = 0 } = useQuery<number>({
    queryKey: ['store-submissions-count'],
    queryFn: async () => {
      const r = await api.get('/v1/admin/stores/submissions');
      return (r.data as unknown[]).length;
    },
    enabled: isAdmin,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

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
            <NavLink
              to="/stores/submissions"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>Store Submissions</span>
              {submissionCount > 0 && (
                <span style={{
                  background: 'var(--accent)',
                  color: 'white',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 7px',
                  minWidth: 20,
                  textAlign: 'center',
                }}>
                  {submissionCount}
                </span>
              )}
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
