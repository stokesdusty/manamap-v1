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

export function ClaimStorePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StoreResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      const { data } = await api.get('/v1/stores', { params: { q: query } });
      setResults(data);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleClaim(storeId: string) {
    setClaiming(storeId);
    setError('');
    try {
      await api.post('/v1/partner/stores/claim', { storeId });
      await qc.invalidateQueries({ queryKey: ['partner', 'stores'] });
      navigate(`/stores/${storeId}`);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Claim failed. You may already own this store.');
      setClaiming(null);
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Claim a Store</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
        Search for your store by name and claim it to start managing rewards and promotions.
      </p>

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

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((store) => (
            <div key={store.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                onClick={() => handleClaim(store.id)}
                disabled={claiming === store.id}
                style={{ flexShrink: 0 }}
              >
                {claiming === store.id ? 'Claiming…' : 'Claim'}
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
    </div>
  );
}
