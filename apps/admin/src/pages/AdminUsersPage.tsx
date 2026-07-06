import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AdminUserDetail, AdminUserSummary } from '@manamap/shared';
import { Icon } from '../components/Icon';

const MANA_COLORS: Record<string, string> = {
  W: '#E7D9A6',
  U: '#5B9EE8',
  B: '#9B7BE0',
  R: '#EC6B57',
  G: '#5FB97E',
};

function AvatarPill({ colors }: { colors: string[] }) {
  return (
    <span className="avatar-pill">
      {colors.slice(0, 5).map((c, i) => (
        <span
          key={i}
          className="avatar-dot"
          style={{ background: MANA_COLORS[c] ?? '#7E7492', border: '1px solid rgba(255,255,255,0.15)' }}
        />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'' | 'USER' | 'PARTNER' | 'ADMIN'>('');
  const [toast, setToast] = useState<string | null>(null);

  const { data: detail, isLoading } = useQuery<AdminUserDetail>({
    queryKey: ['admin-user', userId],
    queryFn: async () => {
      const r = await api.get(`/v1/admin/users/${userId}`);
      return r.data;
    },
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const act = useMutation({
    mutationFn: async (payload: { action: string; note?: string; suspendDays?: number }) => {
      await api.post(`/v1/admin/users/${userId}/moderation-action`, payload);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-user', userId] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      const labels: Record<string, string> = {
        WARN: 'Warning logged',
        SUSPEND: 'User suspended',
        BAN: 'User banned',
        UNBAN: 'User reinstated',
      };
      showToast(labels[vars.action] ?? 'Done');
      setNote('');
    },
  });

  const saveProfile = useMutation({
    mutationFn: async (payload: { displayName?: string; role?: string }) => {
      await api.patch(`/v1/admin/users/${userId}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user', userId] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      showToast('Profile updated');
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

  const nameValue = displayName || detail.displayName;
  const roleValue = role || detail.role;

  return (
    <div className="mod-detail">
      {toast && <div className="toast">{toast}</div>}

      <div className="mod-detail-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              {detail.displayName}
              {detail.handle && (
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                  @{detail.handle}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{detail.email}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <AvatarPill colors={detail.avatarColors} />
              <StatusBadge status={detail.moderationStatus} />
              <span className="badge badge-other">{detail.role}</span>
              {detail.isBot && <span className="badge badge-inactive">BOT</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
          <span>Checkins: <strong>{detail.counts.checkins}</strong></span>
          <span>Connections: <strong>{detail.counts.connections}</strong></span>
          <span>Games: <strong>{detail.counts.gamesPlayed}</strong></span>
        </div>
        {detail.suspendedUntil && (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            Suspended until {formatDate(detail.suspendedUntil)}
          </div>
        )}
      </div>

      <div className="mod-detail-card">
        <div className="mod-detail-title">Edit profile</div>
        <div className="form-group">
          <label className="label">Display name</label>
          <input
            className="input"
            value={nameValue}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="label">Role</label>
          <select
            className="input"
            value={roleValue}
            onChange={(e) => setRole(e.target.value as 'USER' | 'PARTNER' | 'ADMIN')}
          >
            <option value="USER">USER</option>
            <option value="PARTNER">PARTNER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <button
          className="btn btn-outline btn-sm"
          disabled={saveProfile.isPending}
          onClick={() =>
            saveProfile.mutate({
              ...(displayName ? { displayName } : {}),
              ...(role ? { role } : {}),
            })
          }
        >
          Save
        </button>
      </div>

      <div className="mod-detail-card">
        <div className="mod-detail-title">Moderation action</div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="label">Internal note (optional)</label>
          <textarea
            className="input"
            rows={3}
            placeholder="Add context for the audit log…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>
        <div className="mod-actions">
          <button
            className="btn btn-warn btn-sm"
            onClick={() => act.mutate({ action: 'WARN', ...(note ? { note } : {}) })}
            disabled={act.isPending}
          >
            Warn
          </button>
          <button
            className="btn btn-info btn-sm"
            onClick={() => act.mutate({ action: 'SUSPEND', suspendDays: 7, ...(note ? { note } : {}) })}
            disabled={act.isPending}
          >
            Suspend 7d
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => act.mutate({ action: 'BAN', ...(note ? { note } : {}) })}
            disabled={act.isPending}
          >
            Ban
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => act.mutate({ action: 'UNBAN', ...(note ? { note } : {}) })}
            disabled={act.isPending}
          >
            Unban / Reinstate
          </button>
        </div>
      </div>

      {detail.reportsAgainst.length > 0 && (
        <div className="mod-detail-card">
          <div className="mod-detail-title">Reports against this user</div>
          {detail.reportsAgainst.map((r) => (
            <div key={r.id} className="mod-signal">
              <span className="mod-signal-icon" style={{ background: 'var(--danger-bg)' }}>
                <Icon name="alert" size={14} color="var(--danger)" />
              </span>
              <div>
                <div style={{ fontWeight: 500 }}>
                  {r.reason} — {r.status}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(r.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail.moderationHistory.length > 0 && (
        <div className="mod-detail-card">
          <div className="mod-detail-title">Moderation history</div>
          {detail.moderationHistory.map((a) => (
            <div key={a.id} className="mod-signal">
              <span className="mod-signal-icon" style={{ background: 'var(--warning-bg)' }}>
                <Icon name="zap" size={14} color="var(--warning)" />
              </span>
              <div>
                <div style={{ fontWeight: 500 }}>
                  {a.action}
                  {a.note ? ` — ${a.note}` : ''}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(a.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail.storeOwnerships.length > 0 && (
        <div className="mod-detail-card">
          <div className="mod-detail-title">Owns stores</div>
          {detail.storeOwnerships.map((o) => (
            <div key={o.storeId} className="mod-signal">
              <span className="mod-signal-icon" style={{ background: 'var(--primary-bg)' }}>
                <Icon name="store" size={14} color="var(--primary)" />
              </span>
              <div style={{ fontWeight: 500 }}>{o.storeName}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<AdminUserSummary[]>({
    queryKey: ['admin-users', q],
    queryFn: async () => {
      const r = await api.get('/v1/admin/users', { params: q ? { q } : {} });
      return r.data;
    },
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">
            <Icon name="users" size={22} color="var(--primary)" /> Users
          </div>
          <div className="page-sub">Look up any player and take direct action on their account.</div>
        </div>
      </div>

      <div className="mod-layout">
        <div className="mod-queue">
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <input
              className="input"
              placeholder="Search by name, email, or Discord handle…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="mod-queue-list">
            {isLoading && (
              <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 14 }}>Loading…</div>
            )}
            {!isLoading && users.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Icon name="search" size={20} color="var(--text-tertiary)" />
                </div>
                <div className="empty-state-text">No users found</div>
              </div>
            )}
            {users.map((u) => (
              <div
                key={u.id}
                className={`mod-queue-item${selectedId === u.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(u.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="mod-queue-item-name">{u.displayName}</div>
                  <StatusBadge status={u.moderationStatus} />
                </div>
                <div className="mod-queue-item-meta">
                  <AvatarPill colors={u.avatarColors} />
                  <span style={{ marginLeft: 6 }}>{u.email}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedId ? (
          <DetailPanel key={selectedId} userId={selectedId} />
        ) : (
          <div className="mod-detail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <div className="empty-state-icon">
                <Icon name="users" size={20} color="var(--text-tertiary)" />
              </div>
              <div className="empty-state-text">Select a user to view details</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
