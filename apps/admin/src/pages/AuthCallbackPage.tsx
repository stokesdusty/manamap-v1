import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export function AuthCallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) { navigate('/login'); return; }

    const key = `discord_exchanged_${code}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    api.post('/v1/auth/discord', {
      code,
      redirectUri: `${window.location.origin}/auth/callback`,
    })
      .then(({ data }) => {
        login(data.accessToken, data.refreshToken);
        navigate('/stores');
      })
      .catch(() => navigate('/login'));
  }, [login, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <p style={{ color: 'var(--text-secondary)' }}>Signing you in…</p>
      </div>
    </div>
  );
}
