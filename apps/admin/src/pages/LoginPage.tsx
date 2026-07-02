const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string;
const REDIRECT_URI = `${window.location.origin}/auth/callback`;

function buildDiscordUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--paper)',
      }}
    >
      <div
        className="card"
        style={{ maxWidth: 420, width: '100%', textAlign: 'center', padding: '48px 36px' }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>ManaMap Partner Portal</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.5 }}>
          Sign in with Discord to manage your store and rewards program.
        </p>
        <a href={buildDiscordUrl()} className="btn btn-discord">
          Sign in with Discord
        </a>
        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-tertiary)' }}>
          First time? Claim your store after signing in.
        </p>
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
          By continuing, you agree to our{' '}
          <a href="/terms" style={{ color: 'var(--text-secondary)' }}>
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" style={{ color: 'var(--text-secondary)' }}>
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
