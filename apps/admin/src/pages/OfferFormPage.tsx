import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { RewardOffer } from '@manamap/shared';
import { api } from '../api/client';

interface OfferFormData {
  title: string;
  description: string;
  type: 'FIRST_VISIT' | 'STREAK';
  terms: string;
  streakRequired: string;
  active: boolean;
}

const defaults: OfferFormData = {
  title: '',
  description: '',
  type: 'FIRST_VISIT',
  terms: '',
  streakRequired: '3',
  active: true,
};

export function OfferFormPage() {
  const { storeId, offerId } = useParams<{ storeId: string; offerId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = offerId !== 'new' && !!offerId;

  const [form, setForm] = useState<OfferFormData>(defaults);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: existing } = useQuery({
    queryKey: ['partner', 'offer', storeId, offerId],
    queryFn: () =>
      api
        .get<RewardOffer[]>(`/v1/partner/stores/${storeId}/offers`)
        .then((r) => r.data.find((o) => o.id === offerId) ?? null),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title ?? '',
        description: existing.description ?? '',
        type: existing.type ?? 'FIRST_VISIT',
        terms: existing.terms ?? '',
        streakRequired: existing.streakRequired?.toString() ?? '3',
        active: existing.active ?? true,
      });
    }
  }, [existing]);

  function set(field: keyof OfferFormData, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      terms: form.terms.trim() || null,
      active: form.active,
      streakRequired: form.type === 'STREAK' ? parseInt(form.streakRequired, 10) : null,
    };

    try {
      if (isEdit) {
        await api.patch(`/v1/partner/stores/${storeId}/offers/${offerId}`, payload);
      } else {
        await api.post(`/v1/partner/stores/${storeId}/offers`, payload);
      }
      await qc.invalidateQueries({ queryKey: ['partner', 'offers', storeId] });
      await qc.invalidateQueries({ queryKey: ['partner', 'analytics', storeId] });
      navigate(`/stores/${storeId}`);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(msg ?? 'Save failed. Please check your inputs.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <Link
          to={`/stores/${storeId}`}
          style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}
        >
          ← Dashboard
        </Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
        {isEdit ? 'Edit Offer' : 'New Offer'}
      </h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label className="label">Title *</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. First Visit Discount"
            required
          />
        </div>

        <div>
          <label className="label">Description</label>
          <input
            className="input"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Short description shown to customers"
          />
        </div>

        <div>
          <label className="label">Offer Type *</label>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['FIRST_VISIT', 'STREAK'] as const).map((t) => (
              <label
                key={t}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={form.type === t}
                  onChange={() => set('type', t)}
                />
                <span style={{ fontSize: 14 }}>
                  {t === 'FIRST_VISIT' ? 'First Visit' : 'Streak'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {form.type === 'STREAK' && (
          <div>
            <label className="label">Streak Required *</label>
            <input
              className="input"
              type="number"
              min={2}
              max={365}
              value={form.streakRequired}
              onChange={(e) => set('streakRequired', e.target.value)}
              style={{ maxWidth: 120 }}
              required
            />
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Customer must check in this many days in a row.
            </p>
          </div>
        )}

        <div>
          <label className="label">Terms & Conditions</label>
          <textarea
            className="input"
            style={{ minHeight: 80, resize: 'vertical' }}
            value={form.terms}
            onChange={(e) => set('terms', e.target.value)}
            placeholder="Any restrictions or fine print…"
          />
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
            />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Active (visible to customers)</span>
          </label>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Offer'}
          </button>
          <Link to={`/stores/${storeId}`} className="btn" style={{ textDecoration: 'none' }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
