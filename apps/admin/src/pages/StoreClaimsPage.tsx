import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

interface PendingClaim {
  id: string;
  storeId: string;
  storeName: string;
  userId: string;
  claimantName: string;
  note: string | null;
  createdAt: string;
}

interface StoreResult {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ClaimCodeTool() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StoreResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [generated, setGenerated] = useState<{ storeName: string; claimCode: string } | null>(null);

  const generate = useMutation({
    mutationFn: (store: StoreResult) =>
      api
        .post(`/v1/admin/stores/${store.id}/claim-code`)
        .then((r) => ({ storeName: store.name, claimCode: r.data.claimCode as string })),
    onSuccess: (data) => setGenerated(data),
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setGenerated(null);
    try {
      const { data } = await api.get('/v1/stores', { params: { q: query } });
      setResults(data);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="mod-detail-title" style={{ marginBottom: 12 }}>
        Generate a claim code
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Generate a one-time code for a store and relay it to the real owner offline (phone, email,
        in person). Entering it on the claim page instantly approves their ownership.
      </p>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Search by store name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-outline" type="submit" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((store) => (
            <div
              key={store.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 14,
              }}
            >
              <span>
                {store.name}
                {store.city ? ` — ${store.city}, ${store.state}` : ''}
              </span>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => generate.mutate(store)}
                disabled={generate.isPending}
              >
                Generate Code
              </button>
            </div>
          ))}
        </div>
      )}

      {generated && (
        <div className="alert" style={{ marginTop: 12 }}>
          Code for <strong>{generated.storeName}</strong>:{' '}
          <code style={{ fontSize: 16, fontWeight: 700 }}>{generated.claimCode}</code>
        </div>
      )}
    </div>
  );
}

function DetailPanel({ claim, onRemove }: { claim: PendingClaim; onRemove: () => void }) {
  const qc = useQueryClient();
  const [rejectExpanded, setRejectExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ['store-claims'] });
    void qc.invalidateQueries({ queryKey: ['store-claims-count'] });
  };

  const approve = useMutation({
    mutationFn: () => api.post(`/v1/admin/store-claims/${claim.id}/approve`),
    onSuccess: () => {
      invalidateAll();
      showToast('Approved — ownership granted.');
      onRemove();
    },
  });

  const reject = useMutation({
    mutationFn: () =>
      api.post(`/v1/admin/store-claims/${claim.id}/reject`, {
        ...(rejectReason.trim() ? { reason: rejectReason.trim() } : {}),
      }),
    onSuccess: () => {
      invalidateAll();
      showToast('Rejected.');
      onRemove();
    },
  });

  const isPending = approve.isPending || reject.isPending;

  return (
    <div className="mod-detail">
      {toast && <div className="toast">{toast}</div>}

      <div className="mod-detail-card">
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{claim.storeName}</div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          Claimed {relativeDate(claim.createdAt)} by{' '}
          <strong style={{ color: 'var(--text-secondary)' }}>{claim.claimantName}</strong>
        </div>
      </div>

      {claim.note && (
        <div className="mod-detail-card">
          <div className="mod-detail-title">Claimant Note</div>
          <blockquote
            style={{
              borderLeft: '3px solid var(--accent)',
              paddingLeft: 12,
              margin: 0,
              fontStyle: 'italic',
              color: 'var(--text-primary)',
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {claim.note}
          </blockquote>
        </div>
      )}

      <div className="mod-detail-card">
        <div className="mod-detail-title">Actions</div>

        {!rejectExpanded ? (
          <div className="mod-actions">
            <button
              className="btn btn-sm"
              style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}
              onClick={() => approve.mutate()}
              disabled={isPending}
            >
              ✓ Approve
            </button>
            <button
              className="btn btn-outline btn-sm"
              style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
              onClick={() => setRejectExpanded(true)}
              disabled={isPending}
            >
              ✕ Reject
            </button>
          </div>
        ) : (
          <div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="label">Reason (optional)</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Why is this being rejected?"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="mod-actions">
              <button
                className="btn btn-danger btn-sm"
                onClick={() => reject.mutate()}
                disabled={isPending}
              >
                Confirm Reject
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setRejectExpanded(false);
                  setRejectReason('');
                }}
                disabled={isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function StoreClaimsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: claims = [], isLoading } = useQuery<PendingClaim[]>({
    queryKey: ['store-claims'],
    queryFn: async () => {
      const r = await api.get('/v1/admin/store-claims');
      return r.data;
    },
    refetchInterval: 30_000,
  });

  const selected = claims.find((c) => c.id === selectedId) ?? null;

  const handleRemove = () => {
    const idx = claims.findIndex((c) => c.id === selectedId);
    const next = claims[idx + 1] ?? claims[idx - 1] ?? null;
    setSelectedId(next?.id ?? null);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Store Claims</div>
        <div className="page-sub">
          Review pending ownership claims, or generate a one-time code to fast-track a verified
          owner.
        </div>
      </div>

      <ClaimCodeTool />

      <div className="mod-layout">
        <div className="mod-queue">
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
              Pending
            </span>
            <span
              className="badge"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
            >
              {claims.length}
            </span>
          </div>

          <div className="mod-queue-list">
            {isLoading && (
              <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 14 }}>
                Loading…
              </div>
            )}
            {!isLoading && claims.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🏷️</div>
                <div className="empty-state-text">No pending claims</div>
              </div>
            )}
            {claims.map((c) => (
              <div
                key={c.id}
                className={`mod-queue-item${selectedId === c.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="mod-queue-item-name">{c.storeName}</div>
                <div className="mod-queue-item-meta">
                  {c.claimantName} · {relativeDate(c.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selected ? (
          <DetailPanel key={selected.id} claim={selected} onRemove={handleRemove} />
        ) : (
          <div
            className="mod-detail"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div className="empty-state">
              <div className="empty-state-icon">🏷️</div>
              <div className="empty-state-text">Select a claim to review</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
