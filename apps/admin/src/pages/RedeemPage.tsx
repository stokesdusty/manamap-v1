import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '../api/client';
import { Icon } from '../components/Icon';

interface RedemptionResult {
  id: string;
  code: string;
  status: 'PENDING' | 'REDEEMED' | 'VOID';
  offer: { id: string; title: string; type: 'FIRST_VISIT' | 'STREAK' };
  player: { id: string; displayName: string; pronouns: string | null };
  qualifyingReason: string;
  createdAt: string;
  redeemedAt: string | null;
}

interface RedemptionListItem {
  id: string;
  code: string;
  status: 'PENDING' | 'REDEEMED' | 'VOID';
  offerTitle: string;
  offerType: 'FIRST_VISIT' | 'STREAK';
  player: { id: string; displayName: string; avatarColors: string[] };
  createdAt: string;
  redeemedAt: string | null;
}

const ERROR_LABELS: Record<string, string> = {
  not_found: 'Code not found or invalid.',
  wrong_store: 'This code belongs to a different store.',
  already_redeemed: 'This code has already been used.',
  expired_offer: 'The associated offer has expired.',
  not_eligible: 'Player no longer meets the offer requirements.',
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function RedeemPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState('');
  const [verifyResult, setVerifyResult] = useState<RedemptionResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  const { data: recent = [] } = useQuery<RedemptionListItem[]>({
    queryKey: ['partner', 'redemptions', storeId],
    queryFn: () => api.get(`/v1/partner/stores/${storeId}/redemptions?limit=20`).then((r) => r.data),
    refetchInterval: 10_000,
  });

  const redeemMutation = useMutation({
    mutationFn: (c: string) => api.post(`/v1/partner/stores/${storeId}/redemptions/redeem`, { code: c }).then((r) => r.data),
    onSuccess: () => {
      setVerifyResult(null);
      setCode('');
      setRedeemSuccess(true);
      setTimeout(() => setRedeemSuccess(false), 3000);
      qc.invalidateQueries({ queryKey: ['partner', 'redemptions', storeId] });
      inputRef.current?.focus();
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.message ?? 'redeem_failed') : 'redeem_failed';
      setVerifyError(ERROR_LABELS[msg] ?? 'Redemption failed. Please try again.');
      setVerifyResult(null);
    },
  });

  async function handleVerify() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 8) return;
    setIsVerifying(true);
    setVerifyError(null);
    setVerifyResult(null);
    setRedeemSuccess(false);
    try {
      const { data } = await api.get<RedemptionResult>(`/v1/partner/stores/${storeId}/redemptions/verify?code=${encodeURIComponent(trimmed)}`);
      setVerifyResult(data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message ?? 'not_found';
        setVerifyError(ERROR_LABELS[msg] ?? 'Unknown error. Check the code and try again.');
      } else {
        setVerifyError('Network error. Please try again.');
      }
    } finally {
      setIsVerifying(false);
    }
  }

  function handleCodeChange(raw: string) {
    setCode(raw.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8));
    if (verifyResult || verifyError) {
      setVerifyResult(null);
      setVerifyError(null);
    }
  }

  const trimmed = code.trim().toUpperCase();
  const canVerify = trimmed.length === 8 && !isVerifying;

  return (
    <div>
      <Link to={`/stores/${storeId}`} className="page-back">
        <Icon name="chevronLeft" size={15} /> Dashboard
      </Link>

      <div className="page-header">
        <div>
          <div className="page-title">
            <Icon name="ticket" size={22} color="var(--primary)" /> Redeem Offer
          </div>
          <div className="page-sub">Enter the 8-character code shown in the player's app to verify and redeem a reward.</div>
        </div>
      </div>

      {/* Code entry — big, counter-friendly */}
      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canVerify && void handleVerify()}
            placeholder="XXXXXXXX"
            maxLength={8}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 6,
              width: 220,
              padding: '12px 14px',
              border: '1.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              outline: 'none',
            }}
            autoComplete="off"
            autoFocus
          />
          <button className="btn btn-primary" style={{ padding: '13px 26px', fontSize: 15 }} onClick={() => void handleVerify()} disabled={!canVerify}>
            {isVerifying ? 'Checking…' : 'Verify'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10, marginBottom: 0 }}>
          Type or paste the code — letters and numbers only, case-insensitive
        </p>
      </div>

      {/* Success flash */}
      {redeemSuccess && (
        <div className="card" style={{ background: 'var(--success-bg)', border: '1px solid rgba(74,222,128,0.35)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="checkCircle" size={18} color="var(--success)" />
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>Redeemed! The offer has been marked as used.</span>
        </div>
      )}

      {/* Verify error */}
      {verifyError && (
        <div className="card" style={{ background: 'var(--danger-bg)', border: '1px solid rgba(242,105,92,0.35)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="alert" size={18} color="var(--danger)" />
          <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{verifyError}</span>
        </div>
      )}

      {/* Valid result card */}
      {verifyResult && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
            <Icon name="checkCircle" size={19} color="var(--success)" />
            <span style={{ fontWeight: 800, fontSize: 16 }}>Valid Code</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px 12px', marginBottom: 16, fontSize: 14 }}>
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Player</span>
            <span style={{ fontWeight: 700 }}>
              {verifyResult.player.displayName}
              {verifyResult.player.pronouns ? (
                <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>({verifyResult.player.pronouns})</span>
              ) : null}
            </span>

            <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Offer</span>
            <span>{verifyResult.offer.title}</span>

            <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Qualifies</span>
            <span style={{ color: 'var(--success)' }}>{verifyResult.qualifyingReason}</span>

            <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Code</span>
            <code style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-elevated)', padding: '2px 7px', borderRadius: 4, letterSpacing: 2 }}>
              {verifyResult.code}
            </code>
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => redeemMutation.mutate(verifyResult.code)} disabled={redeemMutation.isPending}>
            {redeemMutation.isPending ? 'Redeeming…' : 'Mark as Redeemed'}
          </button>
        </div>
      )}

      {/* Recent redemptions */}
      <div className="card-title" style={{ fontSize: 16, marginTop: 8 }}>Recent Redemptions</div>

      {recent.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--text-tertiary)' }}>
          No redemptions yet for this store.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.map((r) => (
            <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', marginBottom: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{r.player.displayName}</span>
                  <span className={`badge ${r.offerType === 'FIRST_VISIT' ? 'badge-active' : 'badge-accent'}`}>
                    {r.offerType === 'FIRST_VISIT' ? 'First Visit' : 'Streak'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.offerTitle}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  <code style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>{r.code}</code>
                  {' · '}
                  {formatRelative(r.createdAt)}
                </div>
              </div>
              <span className={`badge ${r.status === 'REDEEMED' ? 'badge-active' : 'badge-inactive'}`}>
                {r.status === 'REDEEMED' ? 'Redeemed' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
