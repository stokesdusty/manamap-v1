import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AdminStoreDetail, AdminStoreSummary } from '@manamap/shared';
import { Icon } from '../components/Icon';

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'ACTIVE' ? 'badge-active' : status === 'REJECTED' ? 'badge-banned' : 'badge-suspended';
  return <span className={`badge ${cls}`}>{status}</span>;
}

function DetailPanel({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const { data: detail, isLoading } = useQuery<AdminStoreDetail>({
    queryKey: ['admin-store', storeId],
    queryFn: async () => {
      const r = await api.get(`/v1/admin/stores/${storeId}`);
      return r.data;
    },
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-store', storeId] });
    qc.invalidateQueries({ queryKey: ['admin-stores'] });
  };

  const save = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      await api.patch(`/v1/admin/stores/${storeId}`, payload);
    },
    onSuccess: () => {
      invalidate();
      showToast('Store updated');
    },
  });

  const deactivate = useMutation({
    mutationFn: async () => {
      await api.post(`/v1/admin/stores/${storeId}/reject`, {});
    },
    onSuccess: () => {
      invalidate();
      showToast('Store deactivated');
    },
  });

  const reactivate = useMutation({
    mutationFn: async () => {
      await api.post(`/v1/admin/stores/${storeId}/reactivate`, {});
    },
    onSuccess: () => {
      invalidate();
      showToast('Store reactivated');
    },
  });

  const removeOwner = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/v1/admin/stores/${storeId}/owners/${userId}`);
    },
    onSuccess: () => {
      invalidate();
      showToast('Owner removed');
    },
  });

  if (isLoading || !detail) {
    return (
      <div
        className="mod-detail"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}
      >
        Loading…
      </div>
    );
  }

  const field = (key: keyof AdminStoreDetail, label: string) => (
    <div className="form-group">
      <label className="label">{label}</label>
      <input
        className="input"
        value={form[key] ?? (detail[key] as string) ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="mod-detail">
      {toast && <div className="toast">{toast}</div>}

      <div className="mod-detail-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{detail.name}</div>
          <StatusBadge status={detail.status} />
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
          <span>Active offers: <strong>{detail.counts.activeOffers}</strong></span>
          <span>Checkins: <strong>{detail.counts.checkins}</strong></span>
          <span>Upcoming events: <strong>{detail.counts.upcomingEvents}</strong></span>
        </div>
        <div className="mod-actions">
          {detail.status === 'ACTIVE' ? (
            <button className="btn btn-danger btn-sm" onClick={() => deactivate.mutate()} disabled={deactivate.isPending}>
              Deactivate
            </button>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
              Reactivate
            </button>
          )}
        </div>
      </div>

      <div className="mod-detail-card">
        <div className="mod-detail-title">Edit store info</div>
        {field('name', 'Name')}
        {field('address', 'Address')}
        {field('city', 'City')}
        {field('state', 'State')}
        {field('zip', 'ZIP')}
        {field('discordUrl', 'Discord URL')}
        <button
          className="btn btn-outline btn-sm"
          disabled={save.isPending}
          onClick={() => save.mutate(form)}
        >
          Save
        </button>
      </div>

      <div className="mod-detail-card">
        <div className="mod-detail-title">Owners</div>
        {detail.owners.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No owners claimed yet.</div>
        )}
        {detail.owners.map((o) => (
          <div
            key={o.userId}
            className="mod-signal"
            style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
          >
            <div>
              <div style={{ fontWeight: 500 }}>{o.displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{o.email}</div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => removeOwner.mutate(o.userId)}
              disabled={removeOwner.isPending}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminStoresPage() {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: stores = [], isLoading } = useQuery<AdminStoreSummary[]>({
    queryKey: ['admin-stores', q],
    queryFn: async () => {
      const r = await api.get('/v1/admin/stores', { params: q ? { q } : {} });
      return r.data;
    },
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">
            <Icon name="hash" size={22} color="var(--primary)" /> Stores
          </div>
          <div className="page-sub">Look up any store and manage it directly.</div>
        </div>
      </div>

      <div className="mod-layout">
        <div className="mod-queue">
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <input
              className="input"
              placeholder="Search by name, city, or state…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="mod-queue-list">
            {isLoading && (
              <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 14 }}>Loading…</div>
            )}
            {!isLoading && stores.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Icon name="store" size={20} color="var(--text-tertiary)" />
                </div>
                <div className="empty-state-text">No stores found</div>
              </div>
            )}
            {stores.map((s) => (
              <div
                key={s.id}
                className={`mod-queue-item${selectedId === s.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(s.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="mod-queue-item-name">{s.name}</div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mod-queue-item-meta">
                  {[s.city, s.state].filter(Boolean).join(', ') || '—'} · {s.ownerCount} owner
                  {s.ownerCount === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedId ? (
          <DetailPanel key={selectedId} storeId={selectedId} />
        ) : (
          <div className="mod-detail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <div className="empty-state-icon">
                <Icon name="store" size={20} color="var(--text-tertiary)" />
              </div>
              <div className="empty-state-text">Select a store to view details</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
