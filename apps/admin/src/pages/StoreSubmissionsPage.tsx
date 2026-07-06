import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Icon } from '../components/Icon';

interface StoreSubmission {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
  submitterNote: string | null;
  submittedAt: string;
  submittedBy: { displayName: string };
  confirmationCount: number;
  proximityConfirmationCount: number;
  lat: number | null;
  lng: number | null;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ConfirmBadge({ count }: { count: number }) {
  const cls = count >= 3 ? 'badge-active' : count > 0 ? 'badge-open' : 'badge-inactive';
  return (
    <span className={`badge ${cls}`}>
      {count} {count === 1 ? 'confirmation' : 'confirmations'}
    </span>
  );
}

function DetailPanel({
  submission,
  onRemove,
}: {
  submission: StoreSubmission;
  onRemove: () => void;
}) {
  const qc = useQueryClient();
  const [rejectExpanded, setRejectExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ['store-submissions'] });
    void qc.invalidateQueries({ queryKey: ['store-submissions-count'] });
  };

  const approve = useMutation({
    mutationFn: () => api.post(`/v1/admin/stores/${submission.id}/approve`),
    onSuccess: () => {
      invalidateAll();
      showToast('Approved — store is now live.');
      onRemove();
    },
  });

  const reject = useMutation({
    mutationFn: () =>
      api.post(`/v1/admin/stores/${submission.id}/reject`, {
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
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{submission.name}</div>
        {(submission.address || submission.city || submission.state) && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {[submission.address, submission.city, submission.state].filter(Boolean).join(', ')}
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          Submitted {relativeDate(submission.submittedAt)} by{' '}
          <strong style={{ color: 'var(--text-secondary)' }}>
            {submission.submittedBy.displayName}
          </strong>
        </div>
      </div>

      {submission.submitterNote && (
        <div className="mod-detail-card">
          <div className="mod-detail-title">Submitter Note</div>
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
            {submission.submitterNote}
          </blockquote>
        </div>
      )}

      {submission.lat != null && submission.lng != null && (
        <div className="mod-detail-card" style={{ padding: 0, overflow: 'hidden' }}>
          <iframe
            title="Store location"
            src={`https://maps.google.com/maps?q=${submission.lat},${submission.lng}&z=16&output=embed`}
            style={{ width: '100%', height: 280, border: 0, display: 'block' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}

      <div className="mod-detail-card">
        <div className="mod-detail-title">Confirmation Stats</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 800 }}>
            {submission.confirmationCount}
          </strong>{' '}
          confirmation{submission.confirmationCount !== 1 ? 's' : ''}
          {submission.proximityConfirmationCount > 0 && (
            <span style={{ marginLeft: 6, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              (<Icon name="pin" size={11} color="var(--text-tertiary)" /> {submission.proximityConfirmationCount} with proximity)
            </span>
          )}
        </div>
        {submission.website && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <a
              href={submission.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{ wordBreak: 'break-all' }}
            >
              {submission.website}
            </a>
          </div>
        )}
      </div>

      <div className="mod-detail-card">
        <div className="mod-detail-title">Actions</div>

        {!rejectExpanded ? (
          <div className="mod-actions">
            <button className="btn btn-success btn-sm" onClick={() => approve.mutate()} disabled={isPending}>
              <Icon name="check" size={14} /> Approve
            </button>
            <button
              className="btn btn-outline btn-sm"
              style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
              onClick={() => setRejectExpanded(true)}
              disabled={isPending}
            >
              <Icon name="x" size={14} /> Reject
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

export function StoreSubmissionsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: submissions = [], isLoading } = useQuery<StoreSubmission[]>({
    queryKey: ['store-submissions'],
    queryFn: async () => {
      const r = await api.get('/v1/admin/stores/submissions');
      return r.data;
    },
    refetchInterval: 30_000,
  });

  const sorted = [...submissions].sort((a, b) => b.confirmationCount - a.confirmationCount);
  const selected = sorted.find((s) => s.id === selectedId) ?? null;

  const handleRemove = () => {
    const idx = sorted.findIndex((s) => s.id === selectedId);
    const next = sorted[idx + 1] ?? sorted[idx - 1] ?? null;
    setSelectedId(next?.id ?? null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">
            <Icon name="inbox" size={22} color="var(--primary)" /> Store Submissions
          </div>
          <div className="page-sub">
            Review crowdsourced store suggestions and approve or reject them.
          </div>
        </div>
      </div>

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
            <span className="badge badge-accent">{sorted.length}</span>
          </div>

          <div className="mod-queue-list">
            {isLoading && (
              <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 14 }}>
                Loading…
              </div>
            )}
            {!isLoading && sorted.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Icon name="store" size={20} color="var(--text-tertiary)" />
                </div>
                <div className="empty-state-text">No pending submissions</div>
              </div>
            )}
            {sorted.map((s) => (
              <div
                key={s.id}
                className={`mod-queue-item${selectedId === s.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(s.id)}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <div className="mod-queue-item-name" style={{ minWidth: 0, flex: 1 }}>
                    {s.name}
                  </div>
                  <ConfirmBadge count={s.confirmationCount} />
                </div>
                <div className="mod-queue-item-meta">
                  {[s.city, s.state].filter(Boolean).join(', ') || '—'}
                  {s.proximityConfirmationCount > 0 && (
                    <span style={{ marginLeft: 6, display: 'inline-flex', verticalAlign: 'middle' }} title="Has proximity confirmation">
                      <Icon name="pin" size={11} color="var(--text-tertiary)" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selected ? (
          <DetailPanel key={selected.id} submission={selected} onRemove={handleRemove} />
        ) : (
          <div
            className="mod-detail"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div className="empty-state">
              <div className="empty-state-icon">
                <Icon name="store" size={20} color="var(--text-tertiary)" />
              </div>
              <div className="empty-state-text">Select a submission to review</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
