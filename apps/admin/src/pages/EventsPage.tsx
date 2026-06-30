import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { EVENT_RECURRENCE_WEEKS } from '@manamap/shared';

interface Format {
  id: string;
  name: string;
  slug: string;
}

interface PartnerEvent {
  id: string;
  name: string;
  source: 'STORE' | 'DISCORD' | 'WIZARDS';
  description: string | null;
  formatId: string | null;
  formatName: string | null;
  startsAt: string;
  endsAt: string | null;
  eventChannelUrl: string | null;
  attendeeCount: number;
  createdAt: string;
}

interface FormState {
  name: string;
  formatId: string;
  startsAt: string;
  endsAt: string;
  description: string;
  eventChannelUrl: string;
  repeatWeekly: boolean;
}

const BLANK: FormState = {
  name: '',
  formatId: '',
  startsAt: '',
  endsAt: '',
  description: '',
  eventChannelUrl: '',
  repeatWeekly: false,
};

function toInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(startsAt: string): string {
  const d = new Date(startsAt);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isPast(e: PartnerEvent): boolean {
  const end = e.endsAt
    ? new Date(e.endsAt)
    : new Date(new Date(e.startsAt).getTime() + 4 * 60 * 60 * 1000);
  return end < new Date();
}

function SourceBadge({ event }: { event: PartnerEvent }) {
  if (isPast(event)) {
    return (
      <span
        className="badge"
        style={{ background: 'var(--muted-bg)', color: 'var(--text-tertiary)' }}
      >
        Past
      </span>
    );
  }
  if (event.source === 'DISCORD') {
    return (
      <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>
        Discord
      </span>
    );
  }
  if (event.source === 'WIZARDS') {
    return (
      <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
        Wizards
      </span>
    );
  }
  return <span className="badge badge-active">Store</span>;
}

export function EventsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');

  const { data: events, isLoading } = useQuery<PartnerEvent[]>({
    queryKey: ['partner', 'events', storeId],
    queryFn: () => api.get(`/v1/partner/stores/${storeId}/events`).then((r) => r.data),
  });

  const { data: formats } = useQuery<Format[]>({
    queryKey: ['partner', 'formats'],
    queryFn: () => api.get('/v1/partner/formats').then((r) => r.data),
  });

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editingId
        ? api.patch(`/v1/partner/stores/${storeId}/events/${editingId}`, payload)
        : api.post(`/v1/partner/stores/${storeId}/events`, payload),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ['partner', 'events', storeId] });
      setModalOpen(false);
      showToast(
        editingId
          ? 'Event updated.'
          : payload.repeatWeekly
            ? `Event created. It will repeat weekly for the next ${EVENT_RECURRENCE_WEEKS} weeks.`
            : 'Event created.',
      );
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message ?? 'Save failed. Check your inputs.');
    },
  });

  const del = useMutation({
    mutationFn: (eventId: string) => api.delete(`/v1/partner/stores/${storeId}/events/${eventId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', 'events', storeId] });
      showToast('Event deleted.');
    },
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function openCreate() {
    setEditingId(null);
    setForm(BLANK);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(e: PartnerEvent) {
    setEditingId(e.id);
    setForm({
      name: e.name,
      formatId: e.formatId ?? '',
      startsAt: toInputValue(e.startsAt),
      endsAt: e.endsAt ? toInputValue(e.endsAt) : '',
      description: e.description ?? '',
      eventChannelUrl: e.eventChannelUrl ?? '',
      repeatWeekly: false,
    });
    setFormError('');
    setModalOpen(true);
  }

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.startsAt) {
      setFormError('Start time is required.');
      return;
    }
    const startsAt = new Date(form.startsAt).toISOString();
    const endsAtVal = form.endsAt ? new Date(form.endsAt).toISOString() : undefined;

    if (editingId) {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        ...(form.formatId ? { formatId: form.formatId } : { formatId: null }),
        description: form.description.trim() || null,
        startsAt,
        endsAt: endsAtVal ?? null,
        eventChannelUrl: form.eventChannelUrl.trim() || null,
      };
      save.mutate(payload);
    } else {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        ...(form.formatId ? { formatId: form.formatId } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        startsAt,
        ...(endsAtVal ? { endsAt: endsAtVal } : {}),
        ...(form.eventChannelUrl.trim() ? { eventChannelUrl: form.eventChannelUrl.trim() } : {}),
        ...(form.repeatWeekly ? { repeatWeekly: true } : {}),
      };
      save.mutate(payload);
    }
  }

  function handleDelete(eventId: string) {
    if (confirm('Delete this event? All RSVPs will be removed.')) {
      del.mutate(eventId);
    }
  }

  const isEditable = (e: PartnerEvent) => e.source === 'STORE';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link
          to={`/stores/${storeId}`}
          style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}
        >
          ← Dashboard
        </Link>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Events</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + New Event
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <p style={{ padding: 24, color: 'var(--text-secondary)' }}>Loading events…</p>
        ) : !events?.length ? (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <p className="empty-state-text">No events yet. Create one to get players RSVPing.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Format</th>
                <th>When</th>
                <th>RSVPs</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.name}</div>
                    {e.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {e.description.length > 60
                          ? e.description.slice(0, 60) + '…'
                          : e.description}
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{e.formatName ?? '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatWhen(e.startsAt)}
                  </td>
                  <td style={{ textAlign: 'center' }}>{e.attendeeCount}</td>
                  <td>
                    <SourceBadge event={e} />
                  </td>
                  <td>
                    {isEditable(e) ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => openEdit(e)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(e.id)}
                          disabled={del.isPending}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Read-only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 0,
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
              {editingId ? 'Edit Event' : 'New Event'}
            </h2>
            <form
              onSubmit={handleSave}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Friday Night Magic"
                  required
                />
              </div>

              <div>
                <label className="label">Format</label>
                <select
                  className="input"
                  value={form.formatId}
                  onChange={(e) => set('formatId', e.target.value)}
                >
                  <option value="">— None —</option>
                  {formats?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Starts At *</label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => set('startsAt', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Ends At</label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => set('endsAt', e.target.value)}
                    min={form.startsAt}
                  />
                </div>
              </div>

              {!editingId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    id="repeatWeekly"
                    type="checkbox"
                    checked={form.repeatWeekly}
                    onChange={(e) => setForm((f) => ({ ...f, repeatWeekly: e.target.checked }))}
                  />
                  <label htmlFor="repeatWeekly" className="label" style={{ marginBottom: 0 }}>
                    Repeat weekly for the next {EVENT_RECURRENCE_WEEKS} weeks
                  </label>
                </div>
              )}

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  style={{ minHeight: 72, resize: 'vertical' }}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Optional details about the event…"
                />
              </div>

              <div>
                <label className="label">Discord Channel URL</label>
                <input
                  className="input"
                  type="url"
                  value={form.eventChannelUrl}
                  onChange={(e) => set('eventChannelUrl', e.target.value)}
                  placeholder="https://discord.com/channels/…"
                />
              </div>

              {formError && <div className="alert alert-error">{formError}</div>}

              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button className="btn btn-primary" type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Create Event'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
