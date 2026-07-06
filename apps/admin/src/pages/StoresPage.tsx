import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Icon } from '../components/Icon';

interface Store {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

function useMyStores() {
  return useQuery<Store[]>({
    queryKey: ['partner', 'stores'],
    queryFn: () => api.get('/v1/partner/stores').then((r) => r.data),
  });
}

export function StoresPage() {
  const { data: stores, isLoading, error } = useMyStores();

  if (isLoading) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;
  if (error) return <p style={{ color: 'var(--danger)' }}>Failed to load stores.</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">My Stores</div>
          <div className="page-sub">Manage the stores you've claimed on manamap.</div>
        </div>
        <Link to="/stores/claim" className="btn btn-primary">
          <Icon name="plus" size={16} color="#fff" /> Claim Store
        </Link>
      </div>

      {stores?.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div className="empty-state-icon">
            <Icon name="store" size={24} color="var(--text-tertiary)" />
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 18 }}>
            You haven't claimed any stores yet.
          </p>
          <Link to="/stores/claim" className="btn btn-primary">
            Claim your first store
          </Link>
        </div>
      ) : (
        <div className="store-grid">
          {stores?.map((store) => (
            <Link key={store.id} to={`/stores/${store.id}`} style={{ textDecoration: 'none' }}>
              <div className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 0 }}>
                <div className="store-card-icon">
                  <Icon name="store" size={19} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="store-name">{store.name}</div>
                  {(store.city || store.state) && (
                    <div className="store-location">{[store.city, store.state].filter(Boolean).join(', ')}</div>
                  )}
                </div>
                <Icon name="chevronRight" size={17} color="var(--text-tertiary)" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
