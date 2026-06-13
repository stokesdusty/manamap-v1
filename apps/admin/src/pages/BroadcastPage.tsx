import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

interface AudienceCounts {
  CHECKED_IN_NOW: number;
  TODAY: number;
  EVENT_RSVPS: { count: number; eventId: string | null; eventName: string | null };
  RECENT_30D: number;
}

interface BroadcastResult {
  id: string;
  recipientCount: number;
}

interface BroadcastHistory {
  id: string;
  audience: 'CHECKED_IN_NOW' | 'TODAY' | 'EVENT_RSVPS' | 'RECENT_30D';
  title: string;
  body: string;
  eventId: string | null;
  recipientCount: number;
  createdAt: string;
}

type Audience = 'CHECKED_IN_NOW' | 'TODAY' | 'EVENT_RSVPS' | 'RECENT_30D';

const AUDIENCE_LABELS: Record<Audience, string> = {
  CHECKED_IN_NOW: 'Checked in now',
  TODAY: 'Here today',
  EVENT_RSVPS: 'Event RSVPs',
  RECENT_30D: 'Recent visitors',
};

const AUDIENCE_DESCRIPTIONS: Record<Audience, string> = {
  CHECKED_IN_NOW: 'Players with an active presence at your store right now',
  TODAY: "Players who have checked in today (store's local time)",
  EVENT_RSVPS: 'Players who RSVPed to your next upcoming event',
  RECENT_30D: 'Players who visited in the last 30 days',
};

function audienceCount(counts: AudienceCounts, audience: Audience): number {
  if (audience === 'EVENT_RSVPS') return counts.EVENT_RSVPS.count;
  return counts[audience];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function PushPreview({ title, body, storeName }: { title: string; body: string; storeName?: string }) {
  const displayTitle = title || 'Notification title';
  const displayBody = body || 'Your message will appear here…';

  return (
    <div style={{
      background: 'var(--paper)',
      borderRadius: 16,
      padding: '10px 14px',
      border: '1px solid var(--border)',
      maxWidth: 320,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Push preview
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(10px)',
        borderRadius: 12,
        padding: '10px 12px',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 2px 8px rgba(0,0,0,.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
          }}>
            🗺️
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayTitle}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
              {storeName ? `${storeName} · ` : ''}ManaMap
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>now</div>
        </div>
        <div style={{ fontSize: 12, color: '#1a1a1a', lineHeight: 1.4, marginLeft: 36 }}>
          {displayBody}
        </div>
      </div>
    </div>
  );
}

export function BroadcastPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const qc = useQueryClient();

  const [audience, setAudience] = useState<Audience>('CHECKED_IN_NOW');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: counts, isLoading: loadingCounts } = useQuery<AudienceCounts>({
    queryKey: ['partner', 'broadcast', 'audiences', storeId],
    queryFn: () => api.get(`/v1/partner/stores/${storeId}/broadcast/audiences`).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: history, isLoading: loadingHistory } = useQuery<BroadcastHistory[]>({
    queryKey: ['partner', 'broadcast', 'history', storeId],
    queryFn: () => api.get(`/v1/partner/stores/${storeId}/broadcast`).then((r) => r.data),
  });

  const send = useMutation<BroadcastResult, { response?: { data?: { message?: string } } }>({
    mutationFn: () => {
      const payload: Record<string, unknown> = { audience, title, body };
      if (audience === 'EVENT_RSVPS' && counts?.EVENT_RSVPS.eventId) {
        payload.eventId = counts.EVENT_RSVPS.eventId;
      }
      return api.post(`/v1/partner/stores/${storeId}/broadcast`, payload).then((r) => r.data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['partner', 'broadcast', 'history', storeId] });
      setTitle('');
      setBody('');
      showToast('success', `Sent to ${data.recipientCount} player${data.recipientCount !== 1 ? 's' : ''}`);
    },
    onError: (err) => {
      const msg = err.response?.data?.message ?? 'Failed to send broadcast';
      showToast('error', msg);
    },
  });

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const recipientCount = counts ? audienceCount(counts, audience) : 0;
  const canSend = title.trim().length > 0 && body.trim().length > 0 && !send.isPending;

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000,
          background: toast.type === 'success' ? 'var(--success)' : 'var(--danger)',
          color: '#fff', padding: '10px 18px', borderRadius: 10,
          fontWeight: 600, fontSize: 14, boxShadow: 'var(--shadow)',
          maxWidth: 340,
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link to={`/stores/${storeId}`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          ← Dashboard
        </Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>📢 Broadcast</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
        Send a push notification to players connected to your store.
      </p>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 380px', minWidth: 0 }}>

          {/* Audience Picker */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Who receives this?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['CHECKED_IN_NOW', 'TODAY', 'EVENT_RSVPS', 'RECENT_30D'] as Audience[]).map((a) => {
                const count = counts ? audienceCount(counts, a) : null;
                const eventName = a === 'EVENT_RSVPS' ? counts?.EVENT_RSVPS.eventName : null;
                const isSelected = audience === a;
                return (
                  <label
                    key={a}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--primary-bg)' : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="audience"
                      value={a}
                      checked={isSelected}
                      onChange={() => setAudience(a)}
                      style={{ accentColor: 'var(--primary)', width: 16, height: 16, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                        {AUDIENCE_LABELS[a]}
                        {eventName && (
                          <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 12, marginLeft: 6 }}>
                            ({eventName})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {AUDIENCE_DESCRIPTIONS[a]}
                      </div>
                    </div>
                    <div style={{
                      fontWeight: 700,
                      fontSize: 18,
                      color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                      minWidth: 32,
                      textAlign: 'right',
                      flexShrink: 0,
                    }}>
                      {loadingCounts ? '…' : (count ?? 0)}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Message Composer */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Message</h2>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Title</label>
                <span style={{ fontSize: 12, color: title.length > 35 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                  {title.length}/40
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 40))}
                placeholder="e.g. Friday Night Magic tonight!"
                maxLength={40}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Body</label>
                <span style={{ fontSize: 12, color: body.length > 120 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                  {body.length}/140
                </span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 140))}
                placeholder="e.g. Spots still open — come join us at 6pm!"
                maxLength={140}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Send Button */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 700 }}
            onClick={() => send.mutate()}
            disabled={!canSend}
          >
            {send.isPending
              ? 'Sending…'
              : `Send to ${recipientCount} player${recipientCount !== 1 ? 's' : ''}`}
          </button>
          {counts?.EVENT_RSVPS.count === 0 && audience === 'EVENT_RSVPS' && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
              No upcoming event or RSVPs found
            </p>
          )}
        </div>

        {/* Preview */}
        <div style={{ flexShrink: 0 }}>
          <PushPreview title={title} body={body} />
        </div>
      </div>

      {/* Recent Broadcasts */}
      <div style={{ marginTop: 36 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Recent broadcasts</h2>
        {loadingHistory ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading…</p>
        ) : !history?.length ? (
          <div className="card" style={{ textAlign: 'center', padding: '28px 24px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <p>No broadcasts sent yet.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--paper)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Message</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Audience</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Delivered</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Sent</th>
                </tr>
              </thead>
              <tbody>
                {history.map((b, i) => (
                  <tr
                    key={b.id}
                    style={{ borderBottom: i < history.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{b.title}</div>
                      <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                        {b.body}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 12,
                        background: 'var(--primary-bg)', color: 'var(--primary)', fontWeight: 600, whiteSpace: 'nowrap',
                      }}>
                        {AUDIENCE_LABELS[b.audience]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                      {b.recipientCount}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {formatDate(b.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
