import { NavLink, Outlet, useMatch } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Icon } from './Icon';

export function Layout() {
  const { logout, role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const storeMatch = useMatch('/stores/:storeId/*');
  const currentStoreId = storeMatch?.params?.storeId;
  const inStore =
    currentStoreId &&
    currentStoreId !== 'claim' &&
    currentStoreId !== 'submissions' &&
    currentStoreId !== 'claims';

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

  const { data: claimCount = 0 } = useQuery<number>({
    queryKey: ['store-claims-count'],
    queryFn: async () => {
      const r = await api.get('/v1/admin/store-claims');
      return (r.data as unknown[]).length;
    },
    enabled: isAdmin,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark" />
          <div>
            <div className="sidebar-brand-text">manamap</div>
            <div className="sidebar-brand-sub">Partner Portal</div>
          </div>
        </div>

        <NavLink to="/stores" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Icon name="store" size={17} /> My Stores
        </NavLink>
        <NavLink to="/stores/claim" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Icon name="plus" size={17} /> Claim Store
        </NavLink>

        {inStore && (
          <>
            <div className="sidebar-store-ctx">
              <div className="store-card-icon" style={{ width: 30, height: 30 }}>
                <Icon name="store" size={14} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="sidebar-store-ctx-label">Current store</div>
                <div className="sidebar-store-ctx-name">Dashboard</div>
              </div>
            </div>
            <NavLink
              to={`/stores/${currentStoreId}`}
              end
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon name="chart" size={17} /> Dashboard
            </NavLink>
            <NavLink
              to={`/stores/${currentStoreId}/events`}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon name="calendar" size={17} /> Events
            </NavLink>
            <NavLink
              to={`/stores/${currentStoreId}/broadcast`}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon name="megaphone" size={17} /> Broadcast
            </NavLink>
            <NavLink
              to={`/stores/${currentStoreId}/redeem`}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon name="ticket" size={17} /> Redeem
            </NavLink>
          </>
        )}

        {isAdmin && (
          <>
            <div className="sidebar-section-label">Admin</div>
            <NavLink to="/moderation" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon name="shield" size={17} />
              <span style={{ flex: 1 }}>Moderation</span>
            </NavLink>
            <NavLink
              to="/stores/submissions"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <Icon name="inbox" size={17} />
              <span style={{ flex: 1 }}>Store Submissions</span>
              {submissionCount > 0 && <span className="sidebar-link-badge">{submissionCount}</span>}
            </NavLink>
            <NavLink
              to="/stores/claims"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <Icon name="checkCircle" size={17} />
              <span style={{ flex: 1 }}>Store Claims</span>
              {claimCount > 0 && <span className="sidebar-link-badge">{claimCount}</span>}
            </NavLink>
            <NavLink to="/admin/stores" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon name="hash" size={17} /> All Stores
            </NavLink>
            <NavLink to="/admin/users" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <Icon name="users" size={17} /> Users
            </NavLink>
          </>
        )}

        <div style={{ flex: 1 }} />
        <div className="sidebar-foot">
          <div className="sidebar-foot-avatar">
            <Icon name="store" size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              {isAdmin ? 'Admin' : 'Partner'}
            </div>
            <button className="sidebar-signout" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
