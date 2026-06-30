import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

interface Analytics {
  totalCheckins: number;
  checkinsThisWeek: number;
  checkinsThisMonth: number;
  uniqueVisitors: number;
  activeOffers: number;
}

interface Offer {
  id: string;
  title: string;
  description: string | null;
  type: 'FIRST_VISIT' | 'STREAK';
  active: boolean;
  streakRequired: number | null;
  redemptionCode: string;
}

function useAnalytics(storeId: string) {
  return useQuery<Analytics>({
    queryKey: ['partner', 'analytics', storeId],
    queryFn: () => api.get(`/v1/partner/stores/${storeId}/analytics`).then((r) => r.data),
  });
}

function useOffers(storeId: string) {
  return useQuery<Offer[]>({
    queryKey: ['partner', 'offers', storeId],
    queryFn: () => api.get(`/v1/partner/stores/${storeId}/offers`).then((r) => r.data),
  });
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ flex: 1, textAlign: 'center', padding: '20px 16px' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function StoreDashboardPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const qc = useQueryClient();
  const { data: analytics, isLoading: loadingAnalytics } = useAnalytics(storeId!);
  const { data: offers, isLoading: loadingOffers } = useOffers(storeId!);

  const toggleOffer = useMutation({
    mutationFn: ({ offerId, active }: { offerId: string; active: boolean }) =>
      api.patch(`/v1/partner/stores/${storeId}/offers/${offerId}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner', 'offers', storeId] }),
  });

  const deleteOffer = useMutation({
    mutationFn: (offerId: string) => api.delete(`/v1/partner/stores/${storeId}/offers/${offerId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', 'offers', storeId] });
      qc.invalidateQueries({ queryKey: ['partner', 'analytics', storeId] });
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link
          to="/stores"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}
        >
          ← My Stores
        </Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Dashboard</h1>

      {loadingAnalytics ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading analytics…</p>
      ) : analytics ? (
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
          <StatCard label="Total Check-ins" value={analytics.totalCheckins} />
          <StatCard label="This Week" value={analytics.checkinsThisWeek} />
          <StatCard label="This Month" value={analytics.checkinsThisMonth} />
          <StatCard label="Unique Visitors" value={analytics.uniqueVisitors} />
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Reward Offers</h2>
        <Link
          to={`/stores/${storeId}/offers/new`}
          className="btn btn-primary"
          style={{ textDecoration: 'none', fontSize: 13 }}
        >
          + New Offer
        </Link>
      </div>

      {loadingOffers ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading offers…</p>
      ) : offers?.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: 'center', padding: '36px 24px', color: 'var(--text-secondary)' }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎁</div>
          <p style={{ marginBottom: 16 }}>
            No offers yet. Create one to start rewarding customers.
          </p>
          <Link
            to={`/stores/${storeId}/offers/new`}
            className="btn btn-primary"
            style={{ textDecoration: 'none' }}
          >
            Create first offer
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {offers?.map((offer) => (
            <div
              key={offer.id}
              className="card"
              style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{offer.title}</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 7px',
                      borderRadius: 12,
                      background:
                        offer.type === 'FIRST_VISIT' ? 'var(--success-bg)' : 'var(--primary-bg)',
                      color: offer.type === 'FIRST_VISIT' ? 'var(--success)' : 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    {offer.type === 'FIRST_VISIT'
                      ? 'First Visit'
                      : `Streak ×${offer.streakRequired}`}
                  </span>
                  {!offer.active && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 7px',
                        borderRadius: 12,
                        background: 'var(--muted-bg)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      Inactive
                    </span>
                  )}
                </div>
                {offer.description && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {offer.description}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Code:{' '}
                  <code
                    style={{
                      background: 'var(--muted-bg)',
                      padding: '1px 5px',
                      borderRadius: 4,
                      letterSpacing: 1,
                    }}
                  >
                    {offer.redemptionCode}
                  </code>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => toggleOffer.mutate({ offerId: offer.id, active: !offer.active })}
                  disabled={toggleOffer.isPending}
                >
                  {offer.active ? 'Deactivate' : 'Activate'}
                </button>
                <Link
                  to={`/stores/${storeId}/offers/${offer.id}/edit`}
                  className="btn btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  Edit
                </Link>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    if (confirm('Delete this offer?')) deleteOffer.mutate(offer.id);
                  }}
                  disabled={deleteOffer.isPending}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
