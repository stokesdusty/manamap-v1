import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import type { StoreDetail } from '@manamap/shared';
import { api } from '../api/client';
import { Icon } from '../components/Icon';

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

function useStoreProfile(storeId: string) {
  return useQuery<StoreDetail>({
    queryKey: ['store-detail', storeId],
    queryFn: () => api.get(`/v1/stores/${storeId}`).then((r) => r.data),
  });
}

function DiscordCard({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const { data: profile } = useStoreProfile(storeId);
  const [discordUrl, setDiscordUrl] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDiscordUrl(profile?.discordUrl ?? '');
  }, [profile?.discordUrl]);

  const save = useMutation({
    mutationFn: (value: string | null) =>
      api.patch(`/v1/partner/stores/${storeId}`, { discordUrl: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store-detail', storeId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => {
      setSaved(false);
      setError(
        axios.isAxiosError(err) && err.response?.status === 400
          ? 'Enter a valid link (e.g. https://discord.gg/yourserver)'
          : 'Failed to save',
      );
    },
  });

  function handleSave() {
    setError('');
    const trimmed = discordUrl.trim();
    save.mutate(trimmed === '' ? null : trimmed);
  }

  return (
    <div className="card" style={{ marginBottom: 32 }}>
      <div className="card-title" style={{ fontSize: 17 }}>
        Discord Server
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Share an invite link to your store's Discord server. It's shown on your store's map card
        and detail page in the app.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="https://discord.gg/yourserver"
          value={discordUrl}
          onChange={(e) => setDiscordUrl(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={save.isPending}>
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Icon name={icon} size={17} color="var(--primary)" />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div
        className="card card-hover"
        style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px' }}
      >
        <div className="store-card-icon" style={{ width: 36, height: 36 }}>
          <Icon name={icon} size={17} />
        </div>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{label}</div>
        <Icon name="chevronRight" size={16} color="var(--text-tertiary)" />
      </div>
    </Link>
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
      <Link to="/stores" className="page-back">
        <Icon name="chevronLeft" size={15} /> My Stores
      </Link>

      <div className="page-header">
        <div className="page-title">Dashboard</div>
      </div>

      {loadingAnalytics ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading analytics…</p>
      ) : analytics ? (
        <div className="stats-grid">
          <StatCard label="Total Check-ins" value={analytics.totalCheckins} icon="chart" />
          <StatCard label="This Week" value={analytics.checkinsThisWeek} icon="clock" />
          <StatCard label="This Month" value={analytics.checkinsThisMonth} icon="calendar" />
          <StatCard label="Unique Visitors" value={analytics.uniqueVisitors} icon="users" />
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        <QuickLink to={`/stores/${storeId}/events`} icon="calendar" label="Events" />
        <QuickLink to={`/stores/${storeId}/broadcast`} icon="megaphone" label="Broadcast" />
        <QuickLink to={`/stores/${storeId}/redeem`} icon="ticket" label="Redeem" />
      </div>

      <DiscordCard storeId={storeId!} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 0, fontSize: 17 }}>
          Reward Offers
        </div>
        <Link to={`/stores/${storeId}/offers/new`} className="btn btn-primary btn-sm">
          <Icon name="plus" size={14} color="#fff" /> New Offer
        </Link>
      </div>

      {loadingOffers ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading offers…</p>
      ) : offers?.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="empty-state-icon">
            <Icon name="gift" size={22} color="var(--text-tertiary)" />
          </div>
          <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
            No offers yet. Create one to start rewarding customers.
          </p>
          <Link to={`/stores/${storeId}/offers/new`} className="btn btn-primary">
            Create first offer
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {offers?.map((offer) => (
            <div key={offer.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 0 }}>
              <div className="store-card-icon" style={{ marginTop: 2 }}>
                <Icon name="gift" size={19} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>{offer.title}</span>
                  <span className={`badge ${offer.type === 'FIRST_VISIT' ? 'badge-active' : 'badge-accent'}`}>
                    {offer.type === 'FIRST_VISIT' ? 'First Visit' : `Streak ×${offer.streakRequired}`}
                  </span>
                  {!offer.active && <span className="badge badge-inactive">Inactive</span>}
                </div>
                {offer.description && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{offer.description}</div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Code: <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, letterSpacing: 1 }}>{offer.redemptionCode}</code>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => toggleOffer.mutate({ offerId: offer.id, active: !offer.active })}
                  disabled={toggleOffer.isPending}
                >
                  {offer.active ? 'Deactivate' : 'Activate'}
                </button>
                <Link to={`/stores/${storeId}/offers/${offer.id}/edit`} className="btn btn-sm btn-outline">
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
