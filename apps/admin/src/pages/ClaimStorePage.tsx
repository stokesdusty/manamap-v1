import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

interface StoreResult {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

function claimErrorMessage(err: any): string {
  const code = err.response?.data?.code;
  if (code === 'already_claimed') return 'This store has already been claimed by someone else.';
  if (code === 'invalid_claim_code') {
    return 'That claim code is incorrect. Double-check it, or leave it blank to submit for manual review instead.';
  }
  if (code === 'claim_already_pending') {
    return 'You already have a pending claim for this store — an admin will review it soon.';
  }
  return err.response?.data?.message ?? 'Claim failed. Please try again.';
}

export function ClaimStorePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StoreResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [selectedStore, setSelectedStore] = useState<StoreResult | null>(null);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      const { data } = await api.get('/v1/stores', { params: { q: query } });
      setResults(data);
    } catch {
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  function openClaimForm(store: StoreResult) {
    setSelectedStore(store);
    setCode('');
    setNote('');
    setClaimError('');
  }

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStore) return;
    if (!code.trim() && !note.trim()) {
      setClaimError(
        'Enter a claim code, or describe how you’re affiliated with this store for manual review.',
      );
      return;
    }
    setClaiming(true);
    setClaimError('');
    try {
      const { data } = await api.post('/v1/partner/stores/claim', {
        storeId: selectedStore.id,
        ...(code.trim() ? { code: code.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      if (data.status === 'APPROVED') {
        await qc.invalidateQueries({ queryKey: ['partner', 'stores'] });
        navigate(`/stores/${selectedStore.id}`);
      } else {
        setPendingMessage(
          `Claim submitted for ${selectedStore.name} — an admin will review it shortly.`,
        );
        setSelectedStore(null);
      }
    } catch (err: any) {
      setClaimError(claimErrorMessage(err));
    } finally {
      setClaiming(false);
    }
  }

  if (pendingMessage) {
    return (
      <div style={{ maxWidth: 600 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Claim a Store</h1>
        <div className="alert" style={{ marginBottom: 16 }}>
          {pendingMessage}
        </div>
        <button
          className="btn btn-outline"
          onClick={() => {
            setPendingMessage('');
            setQuery('');
            setResults([]);
          }}
        >
          Claim another store
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Claim a Store</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
        Search for your store by name and claim it to start managing rewards and promotions.
      </p>

      {!selectedStore && (
        <>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Search by store name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          {searchError && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {searchError}
            </div>
          )}

          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((store) => (
                <div
                  key={store.id}
                  className="card"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{store.name}</div>
                    {(store.city || store.state) && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {[store.city, store.state].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => openClaimForm(store)}
                    style={{ flexShrink: 0 }}
                  >
                    Claim
                  </button>
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && query && !searching && (
            <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 32 }}>
              No stores found for "{query}".
            </p>
          )}
        </>
      )}

      {selectedStore && (
        <form
          onSubmit={handleClaim}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div style={{ fontWeight: 700, fontSize: 16 }}>Claiming: {selectedStore.name}</div>

          <div>
            <label className="label">Claim code (if you have one)</label>
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 7F3KQX9P"
            />
          </div>

          <div>
            <label className="label">Why are you affiliated with this store?</label>
            <textarea
              className="input"
              style={{ minHeight: 80, resize: 'vertical' }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required if you don't have a claim code — an admin will review your claim."
            />
          </div>

          {claimError && <div className="alert alert-error">{claimError}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={claiming}>
              {claiming ? 'Submitting…' : 'Submit Claim'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setSelectedStore(null)}
              disabled={claiming}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
