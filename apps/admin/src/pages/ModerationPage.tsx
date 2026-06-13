import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type {
  ModerationReport,
  ModerationDetail,
  ModerationStats,
} from '@manamap/shared';

const MANA_COLORS: Record<string, string> = {
  W: '#f9fafb',
  U: '#3b82f6',
  B: '#1f2937',
  R: '#ef4444',
  G: '#22c55e',
};

type StatusFilter = 'OPEN' | 'REVIEWED' | 'ACTIONED' | 'ALL';

function AvatarPill({ colors }: { colors: string[] }) {
  return (
    <span className="avatar-pill">
      {colors.slice(0, 5).map((c, i) => (
        <span key={i} className="avatar-dot" style={{ background: MANA_COLORS[c] ?? '#aaa', border: '1px solid #d1d5db' }} />
      ))}
    </span>
  );
}

function ReasonBadge({ reason }: { reason: string }) {
  const cls = `badge badge-${reason.toLowerCase()}`;
  const labels: Record<string, string> = {
    HARASSMENT: 'Harassment',
    SPAM: 'Spam',
    FAKE_PROFILE: 'Fake Profile',
    INAPPROPRIATE: 'Inappropriate',
    OTHER: 'Other',
  };
  return <span className={cls}>{labels[reason] ?? reason}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cls = `badge badge-${status.toLowerCase()}`;
  return <span className={cls}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

function ModerationStatusBadge({ status }: { status: string }) {
  const cls = `badge badge-${status.toLowerCase()}`;
  return <span className={cls}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatsRow({ stats }: { stats: ModerationStats }) {
  return (
    <div className="mod-stats">
      <div className="mod-stat">
        <div className="mod-stat-val">{stats.open}</div>
        <div className="mod-stat-lbl">Open</div>
      </div>
      <div className="mod-stat">
        <div className="mod-stat-val" style={{ color: '#b91c1c' }}>{stats.repeatOffenders}</div>
        <div className="mod-stat-lbl">Repeat</div>
      </div>
      <div className="mod-stat">
        <div className="mod-stat-val" style={{ color: '#3730a3' }}>{stats.reviewed}</div>
        <div className="mod-stat-lbl">Reviewed</div>
      </div>
      <div className="mod-stat">
        <div className="mod-stat-val" style={{ color: '#15803d' }}>{stats.actionedAllTime}</div>
        <div className="mod-stat-lbl">Actioned</div>
      </div>
    </div>
  );
}

function DetailPanel({
  reportId,
  onResolved,
}: {
  reportId: string;
  onResolved: (nextId: string | null) => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const { data: detail, isLoading } = useQuery<ModerationDetail>({
    queryKey: ['mod-report', reportId],
    queryFn: async () => {
      const r = await api.get(`/v1/admin/moderation/reports/${reportId}`);
      return r.data;
    },
  });

  const resolve = useMutation({
    mutationFn: async (payload: { action: string; note?: string; suspendDays?: number }) => {
      await api.post(`/v1/admin/moderation/reports/${reportId}/resolve`, payload);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['mod-reports'] });
      qc.invalidateQueries({ queryKey: ['mod-stats'] });
      qc.invalidateQueries({ queryKey: ['mod-report', reportId] });
      const labels: Record<string, string> = { DISMISS: 'Dismissed', WARN: 'Warning logged', SUSPEND: 'User suspended', BAN: 'User banned' };
      setToast(labels[vars.action] ?? 'Done');
      setTimeout(() => setToast(null), 2500);
      onResolved(null);
    },
  });

  const act = (action: string, extra?: { suspendDays?: number }) => {
    resolve.mutate({ action, ...(note ? { note } : {}), ...extra });
  };

  if (isLoading || !detail) {
    return (
      <div className="mod-detail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        Loading…
      </div>
    );
  }

  const isRepeat = detail.reported.priorReports >= 3;
  const resolved = detail.status !== 'OPEN';

  return (
    <div className="mod-detail">
      {toast && <div className="toast">{toast}</div>}

      <div className="mod-detail-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              {detail.reported.displayName}
              {detail.reported.handle && (
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                  @{detail.reported.handle}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <AvatarPill colors={detail.reported.avatarColors} />
              <ModerationStatusBadge status={detail.reported.moderationStatus} />
              {isRepeat && <span className="repeat-flag">⚠ Repeat Offender ({detail.reported.priorReports} reports)</span>}
            </div>
          </div>
          <StatusBadge status={detail.status} />
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
          <span>Prior reports: <strong>{detail.reported.priorReports}</strong></span>
          <span>Prior actions: <strong>{detail.reported.priorActions}</strong></span>
        </div>
      </div>

      <div className="mod-detail-card">
        <div className="mod-detail-title">Report</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <ReasonBadge reason={detail.reason} />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDate(detail.createdAt)}</span>
        </div>
        {detail.context && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <strong>Context:</strong> {detail.context}
          </div>
        )}
        {detail.detail && (
          <div style={{ background: 'var(--paper)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 14, fontStyle: 'italic', color: 'var(--text-primary)' }}>
            "{detail.detail}"
          </div>
        )}
      </div>

      {detail.signals.length > 0 && (
        <div className="mod-detail-card">
          <div className="mod-detail-title">Signals</div>
          {detail.signals.map((s: { type: string; label: string; createdAt: string }, i: number) => (
            <div key={i} className="mod-signal">
              <span style={{ fontSize: 16 }}>{s.type === 'open_report' ? '🚨' : '⚡'}</span>
              <div>
                <div style={{ fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(s.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved ? (
        <div className="mod-detail-card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Resolved {detail.resolvedAt ? formatDate(detail.resolvedAt) : ''}
            {detail.resolutionNote && <div style={{ marginTop: 6 }}><strong>Note:</strong> {detail.resolutionNote}</div>}
          </div>
        </div>
      ) : (
        <div className="mod-detail-card">
          <div className="mod-detail-title">Resolve</div>
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
              className="btn btn-outline btn-sm"
              onClick={() => act('DISMISS')}
              disabled={resolve.isPending}
            >
              Dismiss
            </button>
            <button
              className="btn btn-sm"
              style={{ background: '#fef3c7', color: '#b45309' }}
              onClick={() => act('WARN')}
              disabled={resolve.isPending}
            >
              Warn
            </button>
            <button
              className="btn btn-sm"
              style={{ background: '#e0e7ff', color: '#3730a3' }}
              onClick={() => act('SUSPEND', { suspendDays: 7 })}
              disabled={resolve.isPending}
            >
              Suspend 7d
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => act('BAN')}
              disabled={resolve.isPending}
            >
              Ban
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ModerationPage() {
  const [filter, setFilter] = useState<StatusFilter>('OPEN');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: stats } = useQuery<ModerationStats>({
    queryKey: ['mod-stats'],
    queryFn: async () => {
      const r = await api.get('/v1/admin/moderation/stats');
      return r.data;
    },
    refetchInterval: 30_000,
  });

  const { data: reports = [], isLoading } = useQuery<ModerationReport[]>({
    queryKey: ['mod-reports', filter],
    queryFn: async () => {
      const r = await api.get(`/v1/admin/moderation/reports?status=${filter}`);
      return r.data;
    },
  });

  useEffect(() => {
    if (reports.length && !selectedId) {
      setSelectedId(reports[0].id);
    }
  }, [reports, selectedId]);

  const handleResolved = () => {
    const idx = reports.findIndex((r) => r.id === selectedId);
    const next = reports[idx + 1] ?? reports[idx - 1] ?? null;
    setSelectedId(next?.id ?? null);
  };

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: 'Open', value: 'OPEN' },
    { label: 'Reviewed', value: 'REVIEWED' },
    { label: 'Actioned', value: 'ACTIONED' },
    { label: 'All', value: 'ALL' },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Moderation Queue</div>
        <div className="page-sub">Review player reports and take enforcement action.</div>
      </div>

      <div className="mod-layout">
        <div className="mod-queue">
          {stats && <StatsRow stats={stats} />}
          <div className="mod-filter-tabs">
            {tabs.map((t) => (
              <button
                key={t.value}
                className={`mod-tab${filter === t.value ? ' active' : ''}`}
                onClick={() => { setFilter(t.value); setSelectedId(null); }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mod-queue-list">
            {isLoading && (
              <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 14 }}>Loading…</div>
            )}
            {!isLoading && reports.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-text">No reports here</div>
              </div>
            )}
            {reports.map((r) => {
              const isRepeat = r.reported.priorReports >= 3;
              return (
                <div
                  key={r.id}
                  className={`mod-queue-item${selectedId === r.id ? ' selected' : ''}`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="mod-queue-item-name">
                      {r.reported.displayName}
                      {isRepeat && <span style={{ marginLeft: 6, fontSize: 11, color: '#b91c1c' }}>⚠</span>}
                    </div>
                    <ReasonBadge reason={r.reason} />
                  </div>
                  <div className="mod-queue-item-meta">
                    <AvatarPill colors={r.reported.avatarColors} />
                    <span style={{ marginLeft: 6 }}>{formatDate(r.createdAt)}</span>
                  </div>
                  {r.reported.priorReports > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      {r.reported.priorReports} prior report{r.reported.priorReports !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {selectedId ? (
          <DetailPanel key={selectedId} reportId={selectedId} onResolved={handleResolved} />
        ) : (
          <div className="mod-detail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <div className="empty-state-icon">🛡️</div>
              <div className="empty-state-text">Select a report to review</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
