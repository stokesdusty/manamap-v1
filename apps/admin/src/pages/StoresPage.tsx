import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>My Stores</h1>
        <Link to="/stores/claim" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          + Claim Store
        </Link>
      </div>

      {stores?.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
          <p style={{ marginBottom: 16 }}>You haven't claimed any stores yet.</p>
          <Link to="/stores/claim" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Claim your first store
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {stores?.map((store) => (
            <Link
              key={store.id}
              to={`/stores/${store.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="card card-hover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{store.name}</div>
                  {(store.city || store.state) && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {[store.city, store.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
